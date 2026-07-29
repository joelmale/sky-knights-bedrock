import {
  BlockVolume,
  Dimension,
  EntityComponentTypes,
  EntityHealthComponent,
  EntityInventoryComponent,
  EntityRideableComponent,
} from "@minecraft/server";
import { Tags, Test, register } from "@minecraft/server-gametest";

const FILLBLOCKS_MARKER_PREFIX = "SKY_KNIGHTS_FILLBLOCKS ";
const FILLBLOCKS_REGION = { minX: 1_000_000, minZ: 1_000_000 };
const FILLBLOCKS_REGION_SIZE = 128;
const FILLBLOCKS_UNLOADED_OFFSET_BLOCKS = 4_096;
const FILLBLOCKS_FOOTPRINT = 16;
const FILLBLOCKS_CEILING_HEIGHTS = [16, 40, 128, 160, 256, 384];
const FILLBLOCKS_LEGACY_FILL_CAP_BLOCKS = 32_768;
const FILLBLOCKS_ABOVE_CAP_DIMENSIONS = { x: 9, y: 331, z: 11 };
const FILLBLOCKS_REALISTIC_BAND_HEIGHT = 40;
const FILLBLOCKS_REALISTIC_SAMPLE_COUNT = 6;
const FILLBLOCKS_BATCH_TOTAL_HEIGHT = 128;
const FILLBLOCKS_BATCH_BAND_HEIGHT = 32;
const FILLBLOCKS_COLUMNS_PER_SIDE =
  FILLBLOCKS_REGION_SIZE / FILLBLOCKS_FOOTPRINT;

function fillBlocksMarker(value: Record<string, unknown>): void {
  console.warn(`${FILLBLOCKS_MARKER_PREFIX}${JSON.stringify(value)}`);
}

function column(index: number): { x: number; z: number } {
  return {
    x:
      FILLBLOCKS_REGION.minX +
      (index % FILLBLOCKS_COLUMNS_PER_SIDE) * FILLBLOCKS_FOOTPRINT,
    z:
      FILLBLOCKS_REGION.minZ +
      Math.floor(index / FILLBLOCKS_COLUMNS_PER_SIDE) * FILLBLOCKS_FOOTPRINT,
  };
}

function volumeAt(
  columnIndex: number,
  minY: number,
  height: number,
): BlockVolume {
  const position = column(columnIndex);
  return new BlockVolume(
    { x: position.x, y: minY, z: position.z },
    {
      x: position.x + FILLBLOCKS_FOOTPRINT - 1,
      y: minY + height - 1,
      z: position.z + FILLBLOCKS_FOOTPRINT - 1,
    },
  );
}

function rectangularVolumeAt(
  columnIndex: number,
  minY: number,
  dimensions: { readonly x: number; readonly y: number; readonly z: number },
): BlockVolume {
  const position = column(columnIndex);
  return new BlockVolume(
    { x: position.x, y: minY, z: position.z },
    {
      x: position.x + dimensions.x - 1,
      y: minY + dimensions.y - 1,
      z: position.z + dimensions.z - 1,
    },
  );
}

function requireFillBlocksRegionLoaded(
  test: Test,
  dimension: Dimension,
): boolean {
  try {
    dimension.getBlock({
      x: FILLBLOCKS_REGION.minX,
      y: 0,
      z: FILLBLOCKS_REGION.minZ,
    });
    return true;
  } catch {
    test.fail(
      "The fillBlocks benchmark region is not loaded. Run it only via tools/bds/run-fillblocks-benchmark.mjs.",
    );
    return false;
  }
}

function fillBlocksVolumeCeiling(test: Test): void {
  const dimension = test.getDimension();
  if (!requireFillBlocksRegionLoaded(test, dimension)) return;
  const { min: minY, max: maxY } = dimension.heightRange;
  const attempts: Record<string, unknown>[] = [];

  for (const [index, height] of FILLBLOCKS_CEILING_HEIGHTS.entries()) {
    const blocks = FILLBLOCKS_FOOTPRINT * FILLBLOCKS_FOOTPRINT * height;
    if (height > maxY - minY) {
      attempts.push({ height, blocks, outcome: "skipped-exceeds-height" });
      continue;
    }
    const startedAt = Date.now();
    try {
      const filled = dimension.fillBlocks(
        volumeAt(index, minY, height),
        "minecraft:stone",
      );
      attempts.push({
        height,
        blocks,
        outcome: "filled",
        filledBlocks: filled.getCapacity(),
        durationMs: Date.now() - startedAt,
        column: index,
      });
    } catch (error) {
      attempts.push({
        height,
        blocks,
        outcome: "threw",
        errorName: error instanceof Error ? error.name : "unknown",
        durationMs: Date.now() - startedAt,
        column: index,
      });
    }
  }
  const aboveCapBlocks =
    FILLBLOCKS_ABOVE_CAP_DIMENSIONS.x *
    FILLBLOCKS_ABOVE_CAP_DIMENSIONS.y *
    FILLBLOCKS_ABOVE_CAP_DIMENSIONS.z;
  const aboveCapStartedAt = Date.now();
  try {
    const filled = dimension.fillBlocks(
      rectangularVolumeAt(
        FILLBLOCKS_CEILING_HEIGHTS.length,
        minY,
        FILLBLOCKS_ABOVE_CAP_DIMENSIONS,
      ),
      "minecraft:stone",
    );
    attempts.push({
      case: "exact_above_cap",
      dimensions: FILLBLOCKS_ABOVE_CAP_DIMENSIONS,
      blocks: aboveCapBlocks,
      outcome: "filled",
      filledBlocks: filled.getCapacity(),
      durationMs: Date.now() - aboveCapStartedAt,
      column: FILLBLOCKS_CEILING_HEIGHTS.length,
    });
  } catch (error) {
    attempts.push({
      case: "exact_above_cap",
      dimensions: FILLBLOCKS_ABOVE_CAP_DIMENSIONS,
      blocks: aboveCapBlocks,
      outcome: "threw",
      errorName: error instanceof Error ? error.name : "unknown",
      durationMs: Date.now() - aboveCapStartedAt,
      column: FILLBLOCKS_CEILING_HEIGHTS.length,
    });
  }
  fillBlocksMarker({
    metric: "volume_ceiling",
    footprint: FILLBLOCKS_FOOTPRINT,
    legacyFillCapBlocks: FILLBLOCKS_LEGACY_FILL_CAP_BLOCKS,
    attempts,
  });

  const exactCapSucceeded = attempts.some(
    (attempt) =>
      attempt.blocks === FILLBLOCKS_LEGACY_FILL_CAP_BLOCKS &&
      attempt.outcome === "filled",
  );
  const exactAboveCapThrew = attempts.some(
    (attempt) =>
      attempt.case === "exact_above_cap" &&
      attempt.blocks === FILLBLOCKS_LEGACY_FILL_CAP_BLOCKS + 1 &&
      attempt.outcome === "threw",
  );

  if (!exactCapSucceeded || !exactAboveCapThrew) {
    test.fail(
      "fillBlocks cap contract failed: 32,768 must fill and 32,769 must throw.",
    );
    return;
  }

  test.succeed();
}

function fillBlocksRealisticColumnThroughput(test: Test): void {
  const dimension = test.getDimension();
  if (!requireFillBlocksRegionLoaded(test, dimension)) return;
  const { min: minY } = dimension.heightRange;
  const durationsMs: number[] = [];
  for (let index = 0; index < FILLBLOCKS_REALISTIC_SAMPLE_COUNT; index += 1) {
    const startedAt = Date.now();
    dimension.fillBlocks(
      volumeAt(8 + index, minY, FILLBLOCKS_REALISTIC_BAND_HEIGHT),
      "minecraft:dirt",
    );
    durationsMs.push(Date.now() - startedAt);
  }
  const averageMs =
    durationsMs.reduce((sum, duration) => sum + duration, 0) /
    durationsMs.length;
  fillBlocksMarker({
    metric: "realistic_column_throughput",
    footprint: FILLBLOCKS_FOOTPRINT,
    bandHeight: FILLBLOCKS_REALISTIC_BAND_HEIGHT,
    blocksPerFill:
      FILLBLOCKS_FOOTPRINT *
      FILLBLOCKS_FOOTPRINT *
      FILLBLOCKS_REALISTIC_BAND_HEIGHT,
    samples: durationsMs.length,
    durationsMs,
    averageMs,
    blocksPerSecond:
      averageMs > 0
        ? (FILLBLOCKS_FOOTPRINT *
            FILLBLOCKS_FOOTPRINT *
            FILLBLOCKS_REALISTIC_BAND_HEIGHT *
            1000) /
          averageMs
        : null,
  });
  test.succeed();
}

function fillBlocksIgnoreChunkBoundErrors(test: Test): void {
  const dimension = test.getDimension();
  if (!requireFillBlocksRegionLoaded(test, dimension)) return;
  const { min: minY } = dimension.heightRange;
  const start = column(16);
  const farX = start.x + FILLBLOCKS_UNLOADED_OFFSET_BLOCKS;
  const results: Record<string, unknown>[] = [];
  for (const ignoreChunkBoundErrors of [false, true]) {
    const volume = new BlockVolume(
      { x: start.x, y: minY, z: start.z },
      { x: farX, y: minY + 3, z: start.z + 3 },
    );
    const startedAt = Date.now();
    try {
      const filled = dimension.fillBlocks(volume, "minecraft:stone", {
        ignoreChunkBoundErrors,
      });
      results.push({
        ignoreChunkBoundErrors,
        outcome: "filled",
        filledBlocks: filled.getCapacity(),
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      results.push({
        ignoreChunkBoundErrors,
        outcome: "threw",
        errorName: error instanceof Error ? error.name : "unknown",
        durationMs: Date.now() - startedAt,
      });
    }
  }
  fillBlocksMarker({
    metric: "ignore_chunk_bound_errors",
    unloadedOffsetBlocks: FILLBLOCKS_UNLOADED_OFFSET_BLOCKS,
    results,
  });
  test.succeed();
}

function timedFill(
  dimension: Dimension,
  columnIndex: number,
  material: string,
  many: boolean,
): number {
  const { min: minY } = dimension.heightRange;
  const startedAt = Date.now();
  if (many) {
    for (
      let index = 0;
      index < FILLBLOCKS_BATCH_TOTAL_HEIGHT / FILLBLOCKS_BATCH_BAND_HEIGHT;
      index += 1
    ) {
      const volume = volumeAt(
        columnIndex,
        minY + index * FILLBLOCKS_BATCH_BAND_HEIGHT,
        FILLBLOCKS_BATCH_BAND_HEIGHT,
      );
      dimension.fillBlocks(volume, material);
    }
  } else {
    dimension.fillBlocks(
      volumeAt(columnIndex, minY, FILLBLOCKS_BATCH_TOTAL_HEIGHT),
      material,
    );
  }
  return Date.now() - startedAt;
}

function fillBlocksBatchVsBulkCost(test: Test): void {
  const dimension = test.getDimension();
  if (!requireFillBlocksRegionLoaded(test, dimension)) return;
  // Each operation has a virgin column. Reversing the order in the second
  // pair prevents one method from always receiving the warm-up advantage.
  const trials = [
    {
      order: "batch-then-bulk",
      batchMs: timedFill(dimension, 24, "minecraft:stone", true),
      bulkMs: timedFill(dimension, 25, "minecraft:dirt", false),
    },
    {
      order: "bulk-then-batch",
      bulkMs: timedFill(dimension, 26, "minecraft:stone", false),
      batchMs: timedFill(dimension, 27, "minecraft:dirt", true),
    },
  ];
  const batchAverageMs = (trials[0].batchMs + trials[1].batchMs) / 2;
  const bulkAverageMs = (trials[0].bulkMs + trials[1].bulkMs) / 2;
  fillBlocksMarker({
    metric: "batch_vs_bulk_cost",
    totalBlocks:
      FILLBLOCKS_FOOTPRINT *
      FILLBLOCKS_FOOTPRINT *
      FILLBLOCKS_BATCH_TOTAL_HEIGHT,
    manySmallFillsCount:
      FILLBLOCKS_BATCH_TOTAL_HEIGHT / FILLBLOCKS_BATCH_BAND_HEIGHT,
    trials,
    batchAverageMs,
    bulkAverageMs,
    batchToBulkRatio: bulkAverageMs > 0 ? batchAverageMs / bulkAverageMs : null,
  });
  test.succeed();
}

function skiffHasPilotAndPassengerSeats(test: Test): void {
  const skiff = test.spawn("skyknights:skiff", {
    x: 2,
    y: 2,
    z: 2,
  });
  const rideable = skiff.getComponent(EntityComponentTypes.Rideable) as
    EntityRideableComponent | undefined;

  test.assert(rideable !== undefined, "Skiff must be rideable.");
  test.assert(
    rideable?.seatCount === 2,
    `Expected two skiff seats; received ${String(rideable?.seatCount)}.`,
  );
  test.assert(
    rideable?.controllingSeat === 0,
    "The forward seat must control the skiff.",
  );
  test.succeed();
}

function skycutterHasSeatsAndCargo(test: Test): void {
  const skycutter = test.spawn("skyknights:skycutter", {
    x: 2,
    y: 2,
    z: 2,
  });
  const rideable = skycutter.getComponent(EntityComponentTypes.Rideable) as
    EntityRideableComponent | undefined;
  const inventory = skycutter.getComponent(EntityComponentTypes.Inventory) as
    EntityInventoryComponent | undefined;

  test.assert(rideable !== undefined, "Skycutter must be rideable.");
  test.assert(
    rideable?.seatCount === 4,
    `Expected four Skycutter seats; received ${String(rideable?.seatCount)}.`,
  );
  test.assert(
    rideable?.controllingSeat === 0,
    "The forward seat must control the Skycutter.",
  );
  test.assert(inventory !== undefined, "Skycutter must expose cargo.");
  test.assert(
    inventory?.inventorySize === 18,
    `Expected 18 cargo slots; received ${String(inventory?.inventorySize)}.`,
  );
  test.succeed();
}

function skycutterAdvancedCargoExpandsInventory(test: Test): void {
  const skycutter = test.spawn("skyknights:skycutter", {
    x: 2,
    y: 2,
    z: 2,
  });
  skycutter.triggerEvent("skyknights:apply_expanded_cargo_hold");
  const inventory = skycutter.getComponent(EntityComponentTypes.Inventory) as
    EntityInventoryComponent | undefined;

  test.assert(
    inventory?.inventorySize === 27,
    `Expected 27 expanded cargo slots; received ${String(
      inventory?.inventorySize,
    )}.`,
  );
  test.succeed();
}

function skyRaiderHasCombatHull(test: Test): void {
  const raider = test.spawn("skyknights:sky_raider", {
    x: 2,
    y: 4,
    z: 2,
  });
  const health = raider.getComponent(EntityComponentTypes.Health) as
    EntityHealthComponent | undefined;

  test.assert(health !== undefined, "Ashwing Raider must expose health.");
  test.assert(
    health?.effectiveMax === 120,
    `Expected 120 Raider hull; received ${String(health?.effectiveMax)}.`,
  );
  test.succeed();
}

register(
  "skyknights",
  "skiff_has_pilot_and_passenger_seats",
  skiffHasPilotAndPassengerSeats,
)
  .structureName("skyknights_tests:platform")
  .maxTicks(20)
  .required(true)
  .tag(Tags.suiteDefault);

register(
  "skyknights",
  "skycutter_advanced_cargo_has_27_slots",
  skycutterAdvancedCargoExpandsInventory,
)
  .structureName("skyknights_tests:platform")
  .maxTicks(20)
  .required(true)
  .tag(Tags.suiteDefault);

register("skyknights", "sky_raider_has_120_hull", skyRaiderHasCombatHull)
  .structureName("skyknights_tests:platform")
  .maxTicks(20)
  .required(true)
  .tag(Tags.suiteDefault);

register(
  "skyknights",
  "skycutter_has_four_seats_and_cargo",
  skycutterHasSeatsAndCargo,
)
  .structureName("skyknights_tests:platform")
  .maxTicks(20)
  .required(true)
  .tag(Tags.suiteDefault);

// fillBlocks benchmark registrations: intentionally excluded from suiteDefault.
register("skyknights", "fillblocks_volume_ceiling", fillBlocksVolumeCeiling)
  .structureName("skyknights_tests:platform")
  .maxTicks(400)
  .required(true)
  .tag("skyknights:fillblocks_benchmark");

register(
  "skyknights",
  "fillblocks_realistic_column_throughput",
  fillBlocksRealisticColumnThroughput,
)
  .structureName("skyknights_tests:platform")
  .maxTicks(400)
  .required(true)
  .tag("skyknights:fillblocks_benchmark");

register(
  "skyknights",
  "fillblocks_ignore_chunk_bound_errors",
  fillBlocksIgnoreChunkBoundErrors,
)
  .structureName("skyknights_tests:platform")
  .maxTicks(400)
  .required(true)
  .tag("skyknights:fillblocks_benchmark");

register(
  "skyknights",
  "fillblocks_batch_vs_bulk_cost",
  fillBlocksBatchVsBulkCost,
)
  .structureName("skyknights_tests:platform")
  .maxTicks(400)
  .required(true)
  .tag("skyknights:fillblocks_benchmark");
