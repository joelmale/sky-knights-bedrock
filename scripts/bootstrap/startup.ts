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
  ensureDockmaster,
  registerDockyardInteractions,
} from "../gameplay/dockyard";
import { runDestinationDiscoverySweep } from "../gameplay/exploration";
import { runRecoverySweep } from "../gameplay/recovery";
import { initializeSpawnedShip } from "../gameplay/skiff";
import {
  registerShipEvents,
  runShipSystemsSweep,
} from "../gameplay/ship-systems";
import { objectiveText, runTutorialSweep } from "../gameplay/tutorial";
import {
  PlayerStateRepository,
  WorldStateRepository,
} from "../persistence/repositories";
import { fnv1a32 } from "../util/hash";
import { validateRegistries } from "./validation";

const logger = new Logger("runtime", undefined, () => system.currentTick);
const worldRepository = new WorldStateRepository(world, () =>
  fnv1a32(`${WORLD_STATE_SEED_SALT}:${Math.random()}`),
);

registerDockyardInteractions(logger.child("dockyard"));
registerShipEvents(logger.child("ships"));

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
  registerDevelopmentCommands(
    customCommandRegistry,
    worldRepository,
    logger.child("commands"),
  );
});

world.afterEvents.worldLoad.subscribe(() => {
  system.run(() => {
    const state = worldRepository.load();
    logger.info("Behavior pack loaded.", {
      schemaVersion: state.schemaVersion,
      seed: state.seed,
      migrations: state.migrations,
    });

    validateRegistries(logger.child("validation"));
    ensureRequiredIslandsQueued(worldRepository, logger.child("generation"));
    resumeGeneration(worldRepository, logger.child("generation"));
    system.runInterval(() => {
      runRecoverySweep(logger.child("recovery"));
      runDestinationDiscoverySweep();
      runShipSystemsSweep(logger.child("ships"));
      runTutorialSweep();
    }, RECOVERY_INTERVAL_TICKS);
    system.runInterval(() => {
      try {
        ensureDockmaster(worldRepository, logger.child("dockyard"));
      } catch {
        // The dock chunk can be temporarily unavailable during a reload.
      }
    }, 200);
    prepareDockmaster(0);
  });
});

world.afterEvents.entitySpawn.subscribe(({ entity }) => {
  initializeSpawnedShip(entity);
});

world.afterEvents.playerSpawn.subscribe(({ initialSpawn, player }) => {
  prepareDockmaster(0);

  if (!initialSpawn) {
    return;
  }

  prepareInitialPlayer(player, 0);
});

function prepareInitialPlayer(player: Player, attempt: number): void {
  if (!player.isValid) {
    return;
  }

  const worldState = worldRepository.load();

  if (
    !worldState.generatedIslandIds.includes(STARTER_ISLAND.id) &&
    attempt < 120
  ) {
    system.runTimeout(() => prepareInitialPlayer(player, attempt + 1), 5);
    return;
  }

  if (!worldState.generatedIslandIds.includes(STARTER_ISLAND.id)) {
    player.sendMessage(
      "§cSky Knights could not prepare the safe starter island. Check the Content Log before continuing.§r",
    );
    logger.error("Initial player remained at vanilla spawn.", {
      playerId: player.id,
      activeGeneration: worldState.activeGeneration,
    });
    return;
  }

  const repository = new PlayerStateRepository(player, STARTER_ISLAND.safeDock);
  const state = repository.load();
  const dimension = world.getDimension(state.lastSafeDock.dimensionId);

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
  player.sendMessage("§bSky Knights§r Crystal-to-Cutter expedition is active.");
  player.sendMessage(`Objective: ${objectiveText(state.objective)}`);
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
