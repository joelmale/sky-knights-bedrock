import { describe, expect, it, vi } from "vitest";

vi.mock("@minecraft/server", () => ({
  // Minimal stand-ins. The service only constructs volumes and calls fillBlocks,
  // so the executor is provable without the engine.
  BlockVolume: class {
    public constructor(
      public readonly from: { x: number; y: number; z: number },
      public readonly to: { x: number; y: number; z: number },
    ) {}
  },
  Dimension: class {},
  system: { waitTicks: vi.fn(async () => {}) },
}));

import {
  ISLAND_FAMILY_BLOCKS,
  fillIslandTerrain,
} from "../scripts/generation/island-terrain-service";
import {
  IslandTier,
  createIslandField,
} from "../scripts/generation/island-field";
import { planIslandTerrain } from "../scripts/generation/island-terrain-plan";
import { Logger } from "../scripts/diagnostics/logger";

const SEED = 2026;
const TIERS: IslandTier[] = ["islet", "standard", "crag", "landmark"];

interface Call {
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  block: string;
  filtered: boolean;
}

function target(failOn?: (call: number) => boolean) {
  const calls: Call[] = [];
  let index = 0;

  return {
    calls,
    fillBlocks: ((volume: any, block: string, options?: any) => {
      index += 1;

      if (failOn?.(index)) {
        throw new Error("simulated fill failure");
      }

      calls.push({
        from: volume.from,
        to: volume.to,
        block,
        filtered: options?.blockFilter?.includeTypes?.[0] === "minecraft:air",
      });
      return undefined as never;
    }) as never,
  };
}

function field(tier: IslandTier, index = 11) {
  return createIslandField(SEED, { index, tier, deck: 1, x: 0, z: 0 });
}

const logger = new Logger("island-terrain-test", () => {});
const noWait = async (): Promise<void> => {};

describe("island terrain executor", () => {
  // The property the whole design rests on. Air-only writes are what let
  // overlapping islands merge instead of erasing each other, and what stop
  // generation destroying a player build or a placed continent.
  it("writes terrain air-only, so nothing it writes can overwrite", async () => {
    for (const tier of TIERS) {
      const dimension = target();
      const plan = planIslandTerrain(field(tier));

      await fillIslandTerrain(field(tier), "verdant", dimension, logger, {
        plan,
        waitTicks: noWait,
      });

      // Every terrain call is filtered. The only unfiltered calls are the two
      // bounded dock-pad writes at the end.
      const terrain = dimension.calls.slice(0, plan.volumes);
      expect(terrain.length, tier).toBe(plan.volumes);
      expect(
        terrain.every((call) => call.filtered),
        `${tier} unfiltered terrain write`,
      ).toBe(true);
    }
  });

  it("issues exactly one fill per planned volume", async () => {
    const dimension = target();
    const plan = planIslandTerrain(field("crag"));

    const result = await fillIslandTerrain(
      field("crag"),
      "verdant",
      dimension,
      logger,
      { plan, waitTicks: noWait },
    );

    expect(result.volumes).toBe(plan.volumes);
    expect(result.blocks).toBe(plan.blocks);
    expect(result.batches).toBe(plan.batches.length);
    expect(result.failures).toBe(0);
    // Terrain volumes plus the two dock-pad writes.
    expect(dimension.calls.length).toBe(plan.volumes + 2);
  });

  it("uses the family palette", async () => {
    for (const family of ["verdant", "desert", "tundra", "volcanic"] as const) {
      const dimension = target();
      await fillIslandTerrain(field("islet"), family, dimension, logger, {
        waitTicks: noWait,
      });

      const used = new Set(dimension.calls.map((call) => call.block));
      const palette = ISLAND_FAMILY_BLOCKS[family];
      // Listed rather than derived with Object.values, which this project's
      // TypeScript target does not provide.
      const allowed = [
        palette.core,
        palette.subsurface,
        palette.surface,
        palette.water,
      ];

      expect(used.has(palette.surface), `${family} surface`).toBe(true);
      for (const block of used) {
        if (block === "minecraft:air") continue;
        expect(allowed, `${family} used ${block}`).toContain(block);
      }
    }
  });

  // Idempotence is what replaces the multipart cursor. A part could be marked
  // done after a place() that never landed and was then skipped forever; a
  // re-run here writes the identical set, so a resume can safely replay.
  it("is idempotent: a re-run issues identical writes", async () => {
    const first = target();
    const second = target();

    await fillIslandTerrain(field("standard"), "tundra", first, logger, {
      waitTicks: noWait,
    });
    await fillIslandTerrain(field("standard"), "tundra", second, logger, {
      waitTicks: noWait,
    });

    expect(second.calls).toEqual(first.calls);
  });

  // A fill that throws must not abandon the island. Because writes are
  // idempotent, the remaining batches are still worth issuing and a later pass
  // completes whatever this one missed.
  it("continues past a failed fill and reports it", async () => {
    const dimension = target((call) => call === 3);
    const plan = planIslandTerrain(field("standard"));

    const result = await fillIslandTerrain(
      field("standard"),
      "verdant",
      dimension,
      logger,
      { plan, waitTicks: noWait },
    );

    expect(result.failures).toBe(1);
    expect(dimension.calls.length).toBe(plan.volumes + 2 - 1);
  });

  it("yields once between batches, never after the last", async () => {
    let waits = 0;
    const plan = planIslandTerrain(field("crag"));

    await fillIslandTerrain(field("crag"), "verdant", target(), logger, {
      plan,
      waitTicks: async () => {
        waits += 1;
      },
    });

    expect(waits).toBe(plan.batches.length - 1);
  });

  describe("arrival pad", () => {
    it("lays a solid floor and clears headroom above it", async () => {
      const dimension = target();
      const plan = planIslandTerrain(field("crag"));

      await fillIslandTerrain(field("crag"), "verdant", dimension, logger, {
        plan,
        waitTicks: noWait,
      });

      const [floor, clearance] = dimension.calls.slice(-2);

      expect(floor.block).toBe(ISLAND_FAMILY_BLOCKS.verdant.surface);
      expect(floor.from).toEqual(plan.dockPad.from);
      expect(floor.to).toEqual(plan.dockPad.to);

      expect(clearance.block).toBe("minecraft:air");
      expect(clearance.from.y).toBe(plan.dockPad.from.y + 1);
      expect(clearance.to.y).toBe(plan.dockPad.to.y + 3);
    });

    // The pad is the single deliberate exception to air-only writing, because
    // it must flatten whatever the field left. It has to stay bounded.
    it("is the only unfiltered write, and is bounded", async () => {
      const dimension = target();
      const plan = planIslandTerrain(field("landmark"));

      await fillIslandTerrain(field("landmark"), "verdant", dimension, logger, {
        plan,
        waitTicks: noWait,
      });

      const unfiltered = dimension.calls.filter((call) => !call.filtered);
      expect(unfiltered).toHaveLength(2);

      for (const call of unfiltered) {
        const width = call.to.x - call.from.x + 1;
        const depth = call.to.z - call.from.z + 1;
        const height = call.to.y - call.from.y + 1;
        expect(width).toBeLessThanOrEqual(7);
        expect(depth).toBeLessThanOrEqual(7);
        expect(height).toBeLessThanOrEqual(3);
      }
    });
  });
});
