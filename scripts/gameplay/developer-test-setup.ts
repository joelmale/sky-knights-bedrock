import { Dimension, Entity, Player, system, world } from "@minecraft/server";

import { IDENTIFIERS, REQUIRED_ISLANDS } from "../config/constants";
import { Logger } from "../diagnostics/logger";
import { ensureRequiredIslandsQueued } from "../generation/service";
import { WorldStateRepository } from "../persistence/repositories";
import { DockLocation } from "../persistence/schema";
import { REFERENCE_BLUEPRINTS } from "../skycraft/catalog";
import { prepareDeveloperSkycraftBerths } from "../skycraft/controller";
import { SKYCRAFT_EXPERIMENTAL_CERTIFICATION_TAG } from "../skycraft/progression";
import { ensureDockmaster } from "./dockyard";
import {
  DEVELOPER_TEST_ENTITY_TAG,
  DEVELOPER_TEST_RAIDER_TICKING_AREA,
  DEVELOPER_TEST_SETUP,
  DEVELOPER_TEST_SETUP_TIMEOUT_TICKS,
  DeveloperTestCraftPlacement,
  DeveloperTestRaiderPlacement,
} from "./developer-test-setup-layout";
import { spawnSkyRaiderForPlayer } from "./sky-raider";
import { spawnSkiffForPlayer, spawnSkycutterForPlayer } from "./skiff";
import { placeTestBench } from "./testbench";

export interface DeveloperTestSetupReport {
  replacedEntities: number;
  spawnedCraft: string[];
  benchStalls: {
    placed: number;
    skipped: string[];
  };
  berths: {
    prepared: number;
    skipped: string[];
  };
  dockmasterReady: boolean;
  raiderReady: boolean;
  raiderLocation?: DockLocation;
  raiderWarning?: string;
  referenceBlueprints: string[];
}

interface DeveloperRaiderResult {
  readonly entity?: Entity;
  readonly location?: DockLocation;
  readonly warning?: string;
}

let activePlayerId: string | undefined;

/**
 * Build the predictable, starter-island developer inspection hub.
 *
 * This is intentionally an asynchronous orchestration layer around existing
 * gameplay services. It never stamps a second island or bypasses Skycraft
 * construction/runtime contracts.
 */
export async function prepareDeveloperTestSetup(
  player: Player,
  repository: WorldStateRepository,
  logger: Logger,
): Promise<DeveloperTestSetupReport> {
  if (activePlayerId !== undefined) {
    throw new Error(
      `Developer setup is already running for player ${activePlayerId}.`,
    );
  }

  activePlayerId = player.id;

  try {
    await waitForRequiredIslands(repository, logger.child("generation"));

    if (!player.isValid) {
      throw new Error("The requesting player left before setup completed.");
    }

    const dimension = world.getDimension(DEVELOPER_TEST_SETUP.dimensionId);
    player.teleport(DEVELOPER_TEST_SETUP.landing, { dimension });
    await system.waitTicks(10);
    assertFleetSlotsClear(dimension);

    const clearedEntities = clearPreviousSetupEntities(dimension);
    player.addTag(SKYCRAFT_EXPERIMENTAL_CERTIFICATION_TAG);

    const bench = placeTestBench(logger.child("testbench"));
    const berths = prepareDeveloperSkycraftBerths(logger.child("berths"));
    const dockmasterReady = ensureDockmaster(
      repository,
      logger.child("dockmaster"),
    );
    const spawnedCraft = spawnDeveloperFleet(player, logger.child("fleet"));
    const raider = await spawnDeveloperRaider(
      player,
      repository,
      logger.child("raider"),
      dimension,
    );
    const replacedEntities =
      clearedEntities.removed +
      (raider.entity === undefined ? 0 : clearedEntities.retainedRaiders);

    const report: DeveloperTestSetupReport = {
      replacedEntities,
      spawnedCraft,
      benchStalls: {
        placed: bench.placed.length,
        skipped: bench.skipped.map((stall) => `${stall.id}: ${stall.reason}`),
      },
      berths: {
        prepared: berths.prepared.length,
        skipped: [...berths.skipped],
      },
      dockmasterReady,
      raiderReady: raider.entity !== undefined,
      raiderLocation: raider.location,
      raiderWarning: raider.warning,
      referenceBlueprints: REFERENCE_BLUEPRINTS.map(
        (reference) => reference.name,
      ),
    };

    logger.info("Developer test setup prepared.", {
      playerId: player.id,
      replacedEntities,
      spawnedCraft,
      benchStalls: report.benchStalls,
      berths: report.berths,
      dockmasterReady,
      raiderReady: report.raiderReady,
      raiderLocation: report.raiderLocation,
      raiderWarning: report.raiderWarning,
      referenceBlueprints: report.referenceBlueprints,
    });
    return report;
  } finally {
    activePlayerId = undefined;
  }
}

async function waitForRequiredIslands(
  repository: WorldStateRepository,
  logger: Logger,
): Promise<void> {
  const intervalTicks = 5;

  for (
    let elapsedTicks = 0;
    elapsedTicks < DEVELOPER_TEST_SETUP_TIMEOUT_TICKS;
    elapsedTicks += intervalTicks
  ) {
    const state = repository.load();
    const pending = REQUIRED_ISLANDS.filter(
      (island) => !state.generatedIslandIds.includes(island.id),
    );

    if (pending.length === 0) {
      return;
    }

    if (elapsedTicks % 20 === 0) {
      ensureRequiredIslandsQueued(repository, logger);
    }

    await system.waitTicks(intervalTicks);
  }

  const pendingIds = REQUIRED_ISLANDS.filter(
    (island) => !repository.load().generatedIslandIds.includes(island.id),
  ).map((island) => island.id);

  if (pendingIds.length === 0) {
    return;
  }

  throw new Error(
    `Required islands did not finish within ${
      DEVELOPER_TEST_SETUP_TIMEOUT_TICKS / 20
    } seconds: ${pendingIds.join(", ")}. Run the command again after generation settles.`,
  );
}

function assertFleetSlotsClear(dimension: Dimension): void {
  for (const placement of DEVELOPER_TEST_SETUP.craft) {
    const obstruction = firstBlockObstruction(dimension, placement);

    if (obstruction !== undefined) {
      throw new Error(
        `${placement.id} test slot is blocked at ${obstruction}. Move the block and run the command again.`,
      );
    }
  }
}

function firstBlockObstruction(
  dimension: Dimension,
  placement: DeveloperTestCraftPlacement | DeveloperTestRaiderPlacement,
): string | undefined {
  const centerX = Math.floor(placement.location.x);
  const centerY = Math.floor(placement.location.y);
  const centerZ = Math.floor(placement.location.z);

  for (
    let x = centerX - placement.clearance.horizontalRadius;
    x <= centerX + placement.clearance.horizontalRadius;
    x += 1
  ) {
    for (let y = centerY; y < centerY + placement.clearance.height; y += 1) {
      for (
        let z = centerZ - placement.clearance.horizontalRadius;
        z <= centerZ + placement.clearance.horizontalRadius;
        z += 1
      ) {
        let block;

        try {
          block = dimension.getBlock({ x, y, z });
        } catch {
          return `${x},${y},${z} (chunk not loaded)`;
        }

        if (block === undefined) {
          return `${x},${y},${z} (chunk not loaded)`;
        }

        if (!block.isAir) {
          return `${x},${y},${z} (${block.typeId})`;
        }
      }
    }
  }

  return undefined;
}

async function spawnDeveloperRaider(
  player: Player,
  repository: WorldStateRepository,
  logger: Logger,
  dimension: Dimension,
): Promise<DeveloperRaiderResult> {
  const manager = world.tickingAreaManager;
  const candidates = DEVELOPER_TEST_SETUP.raiderCandidates;
  const clearance = candidates[0].clearance;
  const options = {
    dimension,
    from: {
      x:
        Math.min(...candidates.map(({ location }) => location.x)) -
        clearance.horizontalRadius,
      y: Math.min(...candidates.map(({ location }) => location.y)),
      z:
        Math.min(...candidates.map(({ location }) => location.z)) -
        clearance.horizontalRadius,
    },
    to: {
      x:
        Math.max(...candidates.map(({ location }) => location.x)) +
        clearance.horizontalRadius,
      y:
        Math.max(...candidates.map(({ location }) => location.y)) +
        clearance.height -
        1,
      z:
        Math.max(...candidates.map(({ location }) => location.z)) +
        clearance.horizontalRadius,
    },
  };
  let tickingAreaCreated = false;

  try {
    if (manager.hasTickingArea(DEVELOPER_TEST_RAIDER_TICKING_AREA)) {
      manager.removeTickingArea(DEVELOPER_TEST_RAIDER_TICKING_AREA);
    }

    if (!manager.hasCapacity(options)) {
      return warnAndSkipRaider(
        logger,
        "No ticking-area capacity is available to load the Raider test lane.",
      );
    }

    await manager.createTickingArea(
      DEVELOPER_TEST_RAIDER_TICKING_AREA,
      options,
    );
    tickingAreaCreated = true;
    await system.waitTicks(1);

    const blocked: string[] = [];

    for (const candidate of candidates) {
      const obstruction = firstBlockObstruction(dimension, candidate);

      if (obstruction !== undefined) {
        blocked.push(`Y ${candidate.location.y}: ${obstruction}`);
        continue;
      }

      const location: DockLocation = { ...candidate.location };
      const entity = spawnSkyRaiderForPlayer(
        player,
        repository,
        logger,
        true,
        location,
      );

      if (entity === undefined) {
        return warnAndSkipRaider(
          logger,
          `The Raider service did not create an entity at ${formatLocation(
            location,
          )}.`,
        );
      }

      entity.addTag(DEVELOPER_TEST_ENTITY_TAG);
      return { entity, location };
    }

    return warnAndSkipRaider(
      logger,
      "Every deterministic Raider position at X 54, Z 54 is blocked. Use the void test realm or clear the Y 176-211 lane.",
      { blocked },
    );
  } catch (error) {
    return warnAndSkipRaider(
      logger,
      `The Raider lane could not be loaded: ${errorMessage(error)}.`,
    );
  } finally {
    if (tickingAreaCreated) {
      try {
        if (manager.hasTickingArea(DEVELOPER_TEST_RAIDER_TICKING_AREA)) {
          manager.removeTickingArea(DEVELOPER_TEST_RAIDER_TICKING_AREA);
        }
      } catch (error) {
        logger.warn("Could not release the developer Raider ticking area.", {
          error: errorMessage(error),
        });
      }
    }
  }
}

function warnAndSkipRaider(
  logger: Logger,
  warning: string,
  fields?: Readonly<Record<string, unknown>>,
): DeveloperRaiderResult {
  logger.warn("Developer setup skipped the Raider.", { warning, ...fields });
  return { warning };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatLocation(location: DockLocation): string {
  return `${location.x}, ${location.y}, ${location.z}`;
}

function clearPreviousSetupEntities(dimension: Dimension): {
  readonly removed: number;
  readonly retainedRaiders: number;
} {
  const entities = dimension.getEntities({
    tags: [DEVELOPER_TEST_ENTITY_TAG],
  });
  let removed = 0;
  let retainedRaiders = 0;

  for (const entity of entities) {
    if (entity.typeId === IDENTIFIERS.skyRaider) {
      retainedRaiders += 1;
      continue;
    }

    entity.remove();
    removed += 1;
  }

  return { removed, retainedRaiders };
}

function spawnDeveloperFleet(player: Player, logger: Logger): string[] {
  const entities: Entity[] = [];

  for (const placement of DEVELOPER_TEST_SETUP.craft) {
    let entity: Entity;

    if (placement.id === "skiff") {
      entity = spawnSkiffForPlayer(
        player,
        logger.child(placement.id),
        placement.location,
        undefined,
        { trackAsPrimary: false },
      );
    } else if (placement.id === "skycutter") {
      entity = spawnSkycutterForPlayer(
        player,
        logger.child(placement.id),
        placement.location,
        {
          hull: IDENTIFIERS.armoredHull,
          engine: IDENTIFIERS.frostfireEngine,
          cargo: IDENTIFIERS.expandedCargoHold,
          utility: IDENTIFIERS.aetherCannon,
        },
        { trackAsPrimary: false },
      );
    } else {
      entity = player.dimension.spawnEntity(
        placement.typeId,
        placement.location,
        { initialPersistence: true },
      );
      entity.nameTag =
        placement.id === "aether_outrigger"
          ? "Aether Outrigger Prototype"
          : "Steampunk Blimp Prototype";
    }

    entity.addTag(DEVELOPER_TEST_ENTITY_TAG);
    entities.push(entity);
  }

  return entities.map((entity) => entity.typeId);
}
