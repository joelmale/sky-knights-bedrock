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
  DEVELOPER_TEST_SETUP,
  DEVELOPER_TEST_SETUP_TIMEOUT_TICKS,
  DeveloperTestCraftPlacement,
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
  referenceBlueprints: string[];
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

    const replacedEntities = clearPreviousSetupEntities(dimension);
    player.addTag(SKYCRAFT_EXPERIMENTAL_CERTIFICATION_TAG);

    const bench = placeTestBench(logger.child("testbench"));
    const berths = prepareDeveloperSkycraftBerths(logger.child("berths"));
    const dockmasterReady = ensureDockmaster(
      repository,
      logger.child("dockmaster"),
    );
    const spawnedCraft = spawnDeveloperFleet(player, logger.child("fleet"));
    const raider = spawnSkyRaiderForPlayer(
      player,
      repository,
      logger.child("raider"),
      true,
      DEVELOPER_TEST_SETUP.raider,
    );

    raider?.addTag(DEVELOPER_TEST_ENTITY_TAG);

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
      raiderReady: raider !== undefined,
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

  const raiderObstruction = firstBlockObstruction(dimension, {
    id: "raider",
    typeId: IDENTIFIERS.skyRaider,
    location: DEVELOPER_TEST_SETUP.raider,
    clearance: DEVELOPER_TEST_SETUP.raider.clearance,
  });

  if (raiderObstruction !== undefined) {
    throw new Error(
      `Raider test lane is blocked at ${raiderObstruction}. Move the block and run the command again.`,
    );
  }
}

function firstBlockObstruction(
  dimension: Dimension,
  placement:
    | DeveloperTestCraftPlacement
    | {
        readonly id: "raider";
        readonly typeId: string;
        readonly location: DockLocation;
        readonly clearance: {
          readonly horizontalRadius: number;
          readonly height: number;
        };
      },
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

function clearPreviousSetupEntities(dimension: Dimension): number {
  const entities = dimension.getEntities({
    tags: [DEVELOPER_TEST_ENTITY_TAG],
  });

  for (const entity of entities) {
    entity.remove();
  }

  return entities.length;
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
