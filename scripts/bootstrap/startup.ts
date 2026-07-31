import { Player, system, world } from "@minecraft/server";

import {
  RECOVERY_INTERVAL_TICKS,
  STARTER_ISLAND,
  WORLD_STATE_SEED_SALT,
} from "../config/constants";
import { registerDevelopmentCommands } from "../diagnostics/commands";
import { Logger } from "../diagnostics/logger";
import {
  ensureRequiredIslandsQueued,
  resumeGeneration,
} from "../generation/service";
import {
  STABLE_ARCHIPELAGO_DIMENSION,
  queueNextArchipelagoIsland,
} from "../generation/archipelago-runtime";
import { isArchipelagoGenerationPaused } from "../generation/archipelago-control";
import { resumeContinentStreaming } from "../generation/continent-service";
import { registerIslandModificationTracking } from "../generation/modification-tracking";
import {
  ensureDockmaster,
  registerDockyardInteractions,
} from "../gameplay/dockyard";
import { runDestinationDiscoverySweep } from "../gameplay/exploration";
import { initializePrototypeCraftCameraAssist } from "../gameplay/prototype-craft-camera";
import { runRecoverySweep } from "../gameplay/recovery";
import {
  registerSkyRaiderEvents,
  runSkyRaiderSweep,
} from "../gameplay/sky-raider";
import { registerCombatItemComponents } from "../gameplay/ship-combat";
import { initializeSpawnedShip } from "../gameplay/skiff";
import {
  registerShipEvents,
  runShipSystemsSweep,
} from "../gameplay/ship-systems";
import {
  announceObjective,
  playIntroduction,
  runTutorialSweep,
} from "../gameplay/tutorial";
import {
  ensureApprenticeBerth,
  registerSkycraftRuntime,
  runSkycraftSweep,
} from "../skycraft/controller";
import {
  PlayerStateRepository,
  WorldStateRepository,
} from "../persistence/repositories";
import { fnv1a32 } from "../util/hash";
import { validateRegistries } from "./validation";
import { initialPlayerRetryDelayTicks } from "./retry";

const logger = new Logger("runtime", undefined, () => system.currentTick);
const worldRepository = new WorldStateRepository(world, () =>
  fnv1a32(`${WORLD_STATE_SEED_SALT}:standard`),
);
let runtimeStatus: "pending" | "ready" | "failed" = "pending";
const preparingPlayers = new Map<string, Player>();
const STARTUP_VALIDATION_MAX_ATTEMPTS = 5;
const STARTUP_VALIDATION_RETRY_TICKS = 20;
const INITIAL_PLAYER_FAST_RETRY_ATTEMPTS = 120;

registerDockyardInteractions(logger.child("dockyard"));
registerShipEvents(logger.child("ships"));
registerSkyRaiderEvents(worldRepository, logger.child("sky-raider"));
registerSkycraftRuntime(logger.child("skycraft"));
initializePrototypeCraftCameraAssist(logger.child("prototype-camera"));
registerIslandModificationTracking(
  worldRepository,
  logger.child("island-modifications"),
);

system.beforeEvents.startup.subscribe(
  ({ customCommandRegistry, itemComponentRegistry }) => {
    registerCombatItemComponents(
      itemComponentRegistry,
      logger.child("ship-combat"),
    );
    registerDevelopmentCommands(
      customCommandRegistry,
      worldRepository,
      logger.child("commands"),
    );
  },
);

world.afterEvents.worldLoad.subscribe(() => {
  system.run(() => initializeRuntime(1));
});

function initializeRuntime(validationAttempt: number): void {
  try {
    const state = worldRepository.load();
    logger.info("Behavior pack loaded.", {
      schemaVersion: state.schemaVersion,
      seed: state.seed,
      migrations: state.migrations,
      validationAttempt,
    });

    const validation = validateRegistries(logger.child("validation"));

    if (!validation.ok) {
      retryOrFailRuntime(
        validationAttempt,
        `Packaged content is incomplete: ${validation.missing.join(", ")}`,
      );
      return;
    }

    ensureRequiredIslandsQueued(worldRepository, logger.child("generation"));
    resumeGeneration(worldRepository, logger.child("generation"));
    system.runInterval(() => {
      runRecoverySweep(worldRepository, logger.child("recovery"));
      runDestinationDiscoverySweep(
        worldRepository,
        logger.child("exploration"),
      );
      runShipSystemsSweep(logger.child("ships"));
      runSkyRaiderSweep(worldRepository, logger.child("sky-raider"));
      runTutorialSweep();
    }, RECOVERY_INTERVAL_TICKS);
    system.runInterval(() => runSkycraftSweep(logger.child("skycraft")), 20);
    // Every 10 ticks, not 40. The sweep queues exactly one island and only one
    // generation job runs at a time, so the interval is a hard ceiling on how
    // fast the sky fills. At 40 ticks that ceiling was one island per two
    // seconds, which was invisible while an island was a single structure
    // place() call and became the dominant cost once islands became field
    // terrain spread over many ticks. With roughly 48 islands inside the query
    // radius of any position, 40 ticks meant over 90 seconds of hovering before
    // the field looked populated, which reads as sparse rather than slow.
    system.runInterval(runArchipelagoGenerationSweep, 10);
    system.runInterval(() => {
      try {
        ensureDockmaster(worldRepository, logger.child("dockyard"));
      } catch {
        // The dock chunk can be temporarily unavailable during a reload.
      }
    }, 200);
    prepareDockmaster(0);
    prepareSkycraftBerth(0);
    runtimeStatus = "ready";
  } catch (error) {
    retryOrFailRuntime(
      validationAttempt,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function retryOrFailRuntime(attempt: number, error: string): void {
  if (attempt < STARTUP_VALIDATION_MAX_ATTEMPTS) {
    logger.warn("Runtime initialization will retry.", {
      attempt,
      error,
    });
    system.runTimeout(
      () => initializeRuntime(attempt + 1),
      STARTUP_VALIDATION_RETRY_TICKS,
    );
    return;
  }

  runtimeStatus = "failed";
  logger.error("Runtime startup stopped after repeated failures.", {
    attempt,
    error,
  });
}

world.afterEvents.entitySpawn.subscribe(({ entity }) => {
  initializeSpawnedShip(entity);
});

world.afterEvents.entityLoad.subscribe(({ entity }) => {
  initializeSpawnedShip(entity);
});

world.afterEvents.playerSpawn.subscribe(({ initialSpawn, player }) => {
  // BDS GameTest can emit a transient player-spawn callback without a usable
  // player while a SimulatedPlayer is being created or removed.
  if (player === undefined) {
    return;
  }

  preparePlayerAfterStartup(player, initialSpawn, 0);
});

function preparePlayerAfterStartup(
  player: Player,
  initialSpawn: boolean,
  attempt: number,
): void {
  if (!player.isValid) {
    return;
  }

  if (runtimeStatus === "pending" && attempt < 120) {
    system.runTimeout(
      () => preparePlayerAfterStartup(player, initialSpawn, attempt + 1),
      1,
    );
    return;
  }

  if (runtimeStatus !== "ready") {
    player.sendMessage(
      "§cSky Knights startup validation failed. Check the Content Log before continuing.§r",
    );
    return;
  }

  prepareDockmaster(0);

  const playerState = new PlayerStateRepository(
    player,
    STARTER_ISLAND.safeDock,
  ).load();

  if (initialSpawn || !playerState.initialized) {
    const pendingPlayer = preparingPlayers.get(player.id);

    if (pendingPlayer?.isValid) {
      return;
    }

    preparingPlayers.set(player.id, player);
    prepareInitialPlayer(player, 0, player.id);
  }
}

function prepareInitialPlayer(
  player: Player,
  attempt: number,
  playerId: string,
): void {
  if (preparingPlayers.get(playerId) !== player) {
    return;
  }

  if (!player.isValid) {
    preparingPlayers.delete(playerId);
    return;
  }

  const worldState = worldRepository.load();

  if (!worldState.generatedIslandIds.includes(STARTER_ISLAND.id)) {
    if (attempt === INITIAL_PLAYER_FAST_RETRY_ATTEMPTS) {
      player.sendMessage(
        "§eSky Knights is still preparing the starter island. You will be moved to the dock automatically when it is ready.§r",
      );
      logger.warn("Initial player is waiting for starter-island recovery.", {
        playerId: player.id,
        activeGeneration: worldState.activeGeneration,
      });
    }

    system.runTimeout(
      () => prepareInitialPlayer(player, attempt + 1, playerId),
      initialPlayerRetryDelayTicks(attempt, INITIAL_PLAYER_FAST_RETRY_ATTEMPTS),
    );
    return;
  }

  try {
    const repository = new PlayerStateRepository(
      player,
      STARTER_ISLAND.safeDock,
    );
    const state = repository.load();
    const dimension = world.getDimension(state.lastSafeDock.dimensionId);

    const justInitialized = !state.initialized;

    if (!state.initialized) {
      player.teleport(
        {
          x: state.lastSafeDock.x,
          y: state.lastSafeDock.y,
          z: state.lastSafeDock.z,
        },
        { dimension },
      );
      state.initialized = true;
      state.recoveryEnabled = true;
      repository.save(state);
    }

    player.setSpawnPoint({
      dimension,
      x: state.lastSafeDock.x,
      y: state.lastSafeDock.y,
      z: state.lastSafeDock.z,
    });
    if (justInitialized) {
      playIntroduction(player, state.objective);
    } else {
      announceObjective(player, state.objective, false);
    }

    preparingPlayers.delete(playerId);
  } catch (error) {
    logger.warn("Initial player placement will retry.", {
      playerId,
      error: error instanceof Error ? error.message : String(error),
    });
    system.runTimeout(
      () => prepareInitialPlayer(player, attempt + 1, playerId),
      initialPlayerRetryDelayTicks(attempt, INITIAL_PLAYER_FAST_RETRY_ATTEMPTS),
    );
  }
}

function prepareDockmaster(attempt: number): void {
  try {
    if (
      ensureDockmaster(worldRepository, logger.child("dockyard")) ||
      attempt >= 120
    ) {
      return;
    }
  } catch (error) {
    logger.warn("Dockmaster preparation will retry.", {
      attempt,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  system.runTimeout(() => prepareDockmaster(attempt + 1), 5);
}

function prepareSkycraftBerth(attempt: number): void {
  try {
    if (
      ensureApprenticeBerth(logger.child("skycraft-berth")) ||
      attempt >= 120
    ) {
      return;
    }
  } catch (error) {
    logger.warn("Skycraft berth preparation will retry.", {
      attempt,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  system.runTimeout(() => prepareSkycraftBerth(attempt + 1), 5);
}

function runArchipelagoGenerationSweep(): void {
  try {
    if (isArchipelagoGenerationPaused()) {
      return;
    }

    const observers = world.getAllPlayers().map((player) => ({
      dimensionId: player.dimension.id,
      x: player.location.x,
      z: player.location.z,
    }));

    if (
      resumeContinentStreaming(
        worldRepository,
        observers,
        logger.child("continents"),
        STABLE_ARCHIPELAGO_DIMENSION,
      )
    ) {
      return;
    }

    const state = worldRepository.load();
    const next = queueNextArchipelagoIsland(
      state,
      observers,
      STABLE_ARCHIPELAGO_DIMENSION,
    );

    if (next === state) {
      return;
    }

    worldRepository.save(next);
    resumeGeneration(worldRepository, logger.child("archipelago"));
  } catch (error) {
    logger.warn("Archipelago generation sweep deferred.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
