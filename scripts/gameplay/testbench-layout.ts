import { TEST_BENCH } from "../config/constants";

export interface TestBenchStallPlacement {
  id: string;
  label: string;
  barrel: { x: number; y: number; z: number };
  sign: { x: number; y: number; z: number };
}

export interface TestBenchState {
  schemaVersion: 1;
  stallIds: string[];
}

export function parseTestBenchState(value: unknown): TestBenchState {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1 ||
    !("stallIds" in value) ||
    !Array.isArray(value.stallIds)
  ) {
    return { schemaVersion: 1, stallIds: [] };
  }

  const knownIds: Set<string> = new Set(
    TEST_BENCH.stalls.map((stall) => stall.id),
  );
  const stallIds = value.stallIds
    .filter(
      (entry): entry is string =>
        typeof entry === "string" && knownIds.has(entry),
    )
    .filter((entry, index, entries) => entries.indexOf(entry) === index)
    .sort();

  return { schemaVersion: 1, stallIds };
}

export function markTestBenchStall(
  state: TestBenchState,
  stallId: string,
): TestBenchState {
  return {
    schemaVersion: 1,
    stallIds: [...new Set([...state.stallIds, stallId])].sort(),
  };
}

export function unmarkTestBenchStall(
  state: TestBenchState,
  stallId: string,
): TestBenchState {
  return {
    schemaVersion: 1,
    stallIds: state.stallIds.filter((entry) => entry !== stallId),
  };
}

/**
 * Compute the world position of every test-bench stall.
 *
 * Pure and free of `@minecraft/server` imports so host tests can assert the
 * layout without a running engine, matching the split used by
 * `skiff-placement.ts`.
 */
export function planTestBench(): TestBenchStallPlacement[] {
  const { row, stalls } = TEST_BENCH;

  return stalls.map((stall, index) => {
    const x = row.startX + index * row.spacing;
    return {
      id: stall.id,
      label: stall.label,
      barrel: { x, y: row.y, z: row.z },
      sign: { x, y: row.y + 1, z: row.z },
    };
  });
}
