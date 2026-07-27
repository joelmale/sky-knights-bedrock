import {
  Block,
  BlockComponentTypes,
  BlockInventoryComponent,
  BlockSignComponent,
  Dimension,
  ItemStack,
  world,
} from "@minecraft/server";

import { TEST_BENCH } from "../config/constants";
import { Logger } from "../diagnostics/logger";
import {
  TestBenchStallPlacement,
  TestBenchState,
  markTestBenchStall,
  parseTestBenchState,
  planTestBench,
  unmarkTestBenchStall,
} from "./testbench-layout";

export interface TestBenchReport {
  placed: string[];
  skipped: { id: string; reason: string }[];
}

const TEST_BENCH_STATE_PROPERTY = "skyknights:test_bench_state";

/**
 * Place or restock the developer test bench on the starter island.
 *
 * A new stall requires authored grass plus two empty target cells. A restock
 * requires both a persisted ownership marker and the exact labelled sign and
 * barrel pair created by this service.
 */
export function placeTestBench(logger: Logger): TestBenchReport {
  const dimension = world.getDimension(TEST_BENCH.dimensionId);
  const report: TestBenchReport = { placed: [], skipped: [] };
  const placements = planTestBench();
  let state = loadTestBenchState();

  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index];
    const definition = TEST_BENCH.stalls[index];

    try {
      if (state.stallIds.includes(placement.id)) {
        if (!matchesOwnedStall(dimension, placement)) {
          state = unmarkTestBenchStall(state, placement.id);
          saveTestBenchState(state);
          throw new Error(
            "Recorded stall was changed; stale ownership was cleared.",
          );
        }

        restockOwnedStall(dimension, placement, definition);
      } else {
        placeNewStall(dimension, placement, definition);
        const nextState = markTestBenchStall(state, placement.id);

        try {
          saveTestBenchState(nextState);
          state = nextState;
        } catch (error) {
          removeMatchingStall(dimension, placement);
          throw error;
        }
      }

      report.placed.push(placement.id);
    } catch (error) {
      report.skipped.push({
        id: placement.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("Test bench placement finished.", {
    placed: report.placed.length,
    skipped: report.skipped.length,
  });
  return report;
}

/**
 * Remove only stalls whose ownership marker, block types, and label match.
 *
 * A changed stall loses its stale marker but its blocks and inventory remain.
 */
export function clearTestBench(logger: Logger): number {
  const dimension = world.getDimension(TEST_BENCH.dimensionId);
  let state = loadTestBenchState();
  let removed = 0;

  for (const placement of planTestBench()) {
    if (!state.stallIds.includes(placement.id)) {
      continue;
    }

    if (!matchesOwnedStall(dimension, placement)) {
      state = unmarkTestBenchStall(state, placement.id);
      continue;
    }

    dimension.getBlock(placement.sign)?.setType("minecraft:air");
    dimension.getBlock(placement.barrel)?.setType("minecraft:air");
    removed += 2;
    state = unmarkTestBenchStall(state, placement.id);
  }

  saveTestBenchState(state);
  logger.info("Test bench cleared.", { removed });
  return removed;
}

function placeNewStall(
  dimension: Dimension,
  placement: TestBenchStallPlacement,
  definition: (typeof TEST_BENCH.stalls)[number],
): void {
  const { barrelBlock, signBlock } = preflightNewStall(dimension, placement);
  const stacks = definition.items.map(
    (entry) => new ItemStack(entry.itemId, entry.count),
  );

  try {
    barrelBlock.setType("minecraft:barrel");
    signBlock.setType("minecraft:standing_sign");

    const container = barrelInventory(barrelBlock);
    const sign = signComponent(signBlock);

    for (let slot = 0; slot < stacks.length; slot += 1) {
      container.setItem(slot, stacks[slot]);
    }

    sign.setText(stallSignText(placement.label));
    sign.setWaxed(true);
  } catch (error) {
    signBlock.setType("minecraft:air");
    barrelBlock.setType("minecraft:air");
    throw error;
  }
}

function restockOwnedStall(
  dimension: Dimension,
  placement: TestBenchStallPlacement,
  definition: (typeof TEST_BENCH.stalls)[number],
): void {
  const barrelBlock = dimension.getBlock(placement.barrel);

  if (barrelBlock === undefined) {
    throw new Error("Recorded barrel position is not loaded.");
  }

  const container = barrelInventory(barrelBlock);
  const previous = Array.from({ length: container.size }, (_, slot) =>
    container.getItem(slot),
  );
  const stacks = definition.items.map(
    (entry) => new ItemStack(entry.itemId, entry.count),
  );

  try {
    container.clearAll();

    for (let slot = 0; slot < stacks.length; slot += 1) {
      container.setItem(slot, stacks[slot]);
    }
  } catch (error) {
    container.clearAll();

    for (let slot = 0; slot < previous.length; slot += 1) {
      container.setItem(slot, previous[slot]);
    }

    throw error;
  }
}

function removeMatchingStall(
  dimension: Dimension,
  placement: TestBenchStallPlacement,
): void {
  if (!matchesOwnedStall(dimension, placement)) {
    return;
  }

  dimension.getBlock(placement.sign)?.setType("minecraft:air");
  dimension.getBlock(placement.barrel)?.setType("minecraft:air");
}

function preflightNewStall(
  dimension: Dimension,
  placement: TestBenchStallPlacement,
): { barrelBlock: Block; signBlock: Block } {
  const support = dimension.getBlock({
    x: placement.barrel.x,
    y: placement.barrel.y + TEST_BENCH.supportOffsetY,
    z: placement.barrel.z,
  });

  if (support === undefined) {
    throw new Error("Support block is not loaded.");
  }

  if (support.typeId !== "minecraft:grass_block") {
    throw new Error(
      `Expected authored grass support at ${support.location.x},${support.location.y},${support.location.z}; found ${support.typeId}.`,
    );
  }

  const barrelBlock = dimension.getBlock(placement.barrel);
  const signBlock = dimension.getBlock(placement.sign);

  if (barrelBlock === undefined || signBlock === undefined) {
    throw new Error("Test bench target cells are not loaded.");
  }

  if (!barrelBlock.isAir || !signBlock.isAir) {
    throw new Error("Test bench target cells are occupied.");
  }

  return { barrelBlock, signBlock };
}

function matchesOwnedStall(
  dimension: Dimension,
  placement: TestBenchStallPlacement,
): boolean {
  const barrel = dimension.getBlock(placement.barrel);
  const signBlock = dimension.getBlock(placement.sign);

  if (
    barrel?.typeId !== "minecraft:barrel" ||
    signBlock?.typeId !== "minecraft:standing_sign"
  ) {
    return false;
  }

  const sign = signBlock.getComponent(BlockComponentTypes.Sign) as
    BlockSignComponent | undefined;
  return (
    sign?.isWaxed === true && sign.getText() === stallSignText(placement.label)
  );
}

function barrelInventory(barrelBlock: Block) {
  const inventory = barrelBlock.getComponent(BlockComponentTypes.Inventory) as
    BlockInventoryComponent | undefined;

  if (inventory?.container === undefined) {
    throw new Error("Placed barrel exposed no inventory.");
  }

  return inventory.container;
}

function signComponent(signBlock: Block): BlockSignComponent {
  const sign = signBlock.getComponent(BlockComponentTypes.Sign) as
    BlockSignComponent | undefined;

  if (sign === undefined) {
    throw new Error("Placed sign exposed no sign component.");
  }

  return sign;
}

function stallSignText(label: string): string {
  return `§l${label}§r`;
}

function loadTestBenchState(): TestBenchState {
  const serialized = world.getDynamicProperty(TEST_BENCH_STATE_PROPERTY);

  if (typeof serialized !== "string") {
    return parseTestBenchState(undefined);
  }

  try {
    return parseTestBenchState(JSON.parse(serialized) as unknown);
  } catch {
    return parseTestBenchState(undefined);
  }
}

function saveTestBenchState(state: TestBenchState): void {
  world.setDynamicProperty(TEST_BENCH_STATE_PROPERTY, JSON.stringify(state));
}
