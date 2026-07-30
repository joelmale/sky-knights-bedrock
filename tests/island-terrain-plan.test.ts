import { describe, expect, it } from "vitest";

import {
  ISLAND_DOCK_PAD_RADIUS,
  ISLAND_FILL_BLOCK_BUDGET,
  ISLAND_FILL_CALL_BUDGET,
  islandChunkSpan,
  islandDockSurfaceY,
  planIslandTerrain,
} from "../scripts/generation/island-terrain-plan";
import {
  IslandTier,
  createIslandField,
  islandTerrainMetrics,
} from "../scripts/generation/island-field";
import { surfaceY } from "../scripts/generation/continent-field";

const TIERS: IslandTier[] = ["islet", "standard", "crag", "landmark"];
const SEED = 2026;

/** The ceiling the BDS benchmark established for a single fillBlocks call. */
const FILL_BLOCK_CAP = 32_768;

function field(tier: IslandTier, index = 11, deck = 1) {
  return createIslandField(SEED, { index, tier, deck, x: 0, z: 0 });
}

describe("island terrain fill plan", () => {
  it("never emits a volume above the fillBlocks ceiling", () => {
    for (const tier of TIERS) {
      for (const batch of planIslandTerrain(field(tier)).batches) {
        for (const volume of batch.volumes) {
          const blocks =
            (volume.to.x - volume.from.x + 1) *
            (volume.to.y - volume.from.y + 1) *
            (volume.to.z - volume.from.z + 1);
          expect(blocks, tier).toBeLessThanOrEqual(FILL_BLOCK_CAP);
        }
      }
    }
  });

  it("respects both budgets in every batch", () => {
    for (const tier of TIERS) {
      const plan = planIslandTerrain(field(tier));

      for (const batch of plan.batches) {
        expect(batch.volumes.length, `${tier} calls`).toBeLessThanOrEqual(
          ISLAND_FILL_CALL_BUDGET,
        );

        // A batch may exceed the block budget only when it holds a single
        // volume that is larger than the budget on its own, which is emitted
        // whole rather than split.
        if (batch.volumes.length > 1) {
          expect(batch.blocks, `${tier} blocks`).toBeLessThanOrEqual(
            ISLAND_FILL_BLOCK_BUDGET,
          );
        }
      }
    }
  });

  it("writes every block the terrain metrics describe", () => {
    for (const tier of TIERS) {
      const target = field(tier);
      const plan = planIslandTerrain(target);
      const metrics = islandTerrainMetrics(target);

      expect(plan.blocks, tier).toBe(metrics.solidBlocks);
      expect(
        plan.batches.reduce((total, batch) => total + batch.blocks, 0),
        `${tier} batch total`,
      ).toBe(plan.blocks);
      expect(
        plan.batches.reduce((total, batch) => total + batch.volumes.length, 0),
        `${tier} volume total`,
      ).toBe(plan.volumes);
    }
  });

  // A four-call-per-tick rule, the conservative continent setting, spent 1,377
  // ticks on a landmark - about 69 seconds. The budgets here bring that to
  // roughly 58 ticks, under three seconds.
  //
  // Note which budget actually binds: a landmark is 100,883 blocks, only 4.1
  // block budgets, but 5,506 volumes, which is 58 call budgets. The call guard
  // is the constraint at every tier, because relief fragments the merge into
  // 18-block volumes. Raising ISLAND_FILL_CALL_BUDGET is therefore the lever
  // for faster generation - but per-call overhead has NOT been measured on
  // device, only block throughput has, so it should not be raised on the
  // strength of this test alone.
  it("keeps a landmark inside a few seconds of generation", () => {
    const plan = planIslandTerrain(field("landmark"));

    // At span 168 a landmark is ~10,400 volumes, so ~108 batches: about 5.4
    // seconds of background generation for the rarest tier (17 of 1,214
    // islands). The bound is generous because the exact count moves with span.
    expect(plan.batches.length).toBeLessThan(150);
    expect(plan.batches.length).toBe(
      Math.ceil(plan.volumes / ISLAND_FILL_CALL_BUDGET),
    );
  });

  it("is deterministic", () => {
    for (const tier of TIERS) {
      const a = planIslandTerrain(field(tier));
      const b = planIslandTerrain(field(tier));

      expect(b.blocks, tier).toBe(a.blocks);
      expect(b.volumes, tier).toBe(a.volumes);
      expect(b.batches.length, tier).toBe(a.batches.length);
      expect(b.dock, tier).toEqual(a.dock);
      expect(b.dockPad, tier).toEqual(a.dockPad);
    }
  });

  // A real height field breaks the arrival assumption the authored islands
  // satisfied by accident: they had one constant surface height, so any anchor
  // was valid. With relief, the pad must be explicitly levelled.
  describe("arrival pad", () => {
    it("sits one block above the levelled surface, at the island centre", () => {
      for (const tier of TIERS) {
        const target = field(tier);
        const plan = planIslandTerrain(target);
        const level = islandDockSurfaceY(target);

        expect(plan.dock.x, tier).toBe(target.centerX);
        expect(plan.dock.z, tier).toBe(target.centerZ);
        expect(plan.dock.y, tier).toBe(level + 1);
        expect(plan.dockPad.from.y, tier).toBe(level);
        expect(plan.dockPad.to.y, tier).toBe(level);
      }
    });

    it("is derived from the field, never stored", () => {
      for (const tier of TIERS) {
        const target = field(tier);
        expect(islandDockSurfaceY(target), tier).toBe(
          surfaceY(target, target.centerX, target.centerZ),
        );
      }
    });

    it("covers a square pad of the declared radius", () => {
      const plan = planIslandTerrain(field("crag"));
      const width = plan.dockPad.to.x - plan.dockPad.from.x + 1;
      const depth = plan.dockPad.to.z - plan.dockPad.from.z + 1;

      expect(width).toBe(ISLAND_DOCK_PAD_RADIUS * 2 + 1);
      expect(depth).toBe(ISLAND_DOCK_PAD_RADIUS * 2 + 1);
    });

    // The pad is only meaningful if the terrain under it is uneven enough to
    // need levelling. If the island centre were always flat this would be dead
    // code, and the flat-top defect would be back.
    it("levels terrain that is genuinely uneven", () => {
      let uneven = 0;

      for (let index = 0; index < 40; index += 1) {
        const target = createIslandField(SEED, {
          index,
          tier: "crag",
          deck: 1,
          x: 0,
          z: 0,
        });
        const level = islandDockSurfaceY(target);
        let differs = false;

        for (
          let dx = -ISLAND_DOCK_PAD_RADIUS;
          dx <= ISLAND_DOCK_PAD_RADIUS;
          dx += 1
        ) {
          for (
            let dz = -ISLAND_DOCK_PAD_RADIUS;
            dz <= ISLAND_DOCK_PAD_RADIUS;
            dz += 1
          ) {
            if (
              surfaceY(target, target.centerX + dx, target.centerZ + dz) !==
              level
            ) {
              differs = true;
            }
          }
        }

        if (differs) {
          uneven += 1;
        }
      }

      expect(uneven).toBeGreaterThan(0);
    });
  });

  it("reports a chunk span large enough to cover the island", () => {
    for (const tier of TIERS) {
      const target = field(tier);
      const span = islandChunkSpan(target);
      const plan = planIslandTerrain(target);

      expect(span.chunksX, tier).toBeGreaterThan(0);
      expect(span.chunksZ, tier).toBeGreaterThan(0);
      expect(plan.chunks, tier).toBeLessThanOrEqual(
        span.chunksX * span.chunksZ,
      );
    }
  });

  it("scales work with tier", () => {
    const blocks = TIERS.map((tier) => planIslandTerrain(field(tier)).blocks);

    for (let index = 1; index < blocks.length; index += 1) {
      expect(blocks[index]).toBeGreaterThan(blocks[index - 1]);
    }
  });
});
