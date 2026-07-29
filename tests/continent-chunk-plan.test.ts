import { describe, expect, it } from "vitest";

import {
  columnAt,
  createContinentField,
  maxColumnHeight,
  strataAt,
  type ContinentField,
} from "../scripts/generation/continent-field";
import {
  CHUNK_SIZE,
  chunkBlockCeiling,
  continentChunkBounds,
  planContinentChunk,
  type ContinentChunkPlan,
} from "../scripts/generation/continent-chunk-plan";

const SEED = 0x5c07f1ed;

function field(span: number): ContinentField {
  return createContinentField(SEED, 0, {
    span,
    center: { x: 0, z: 0 },
  });
}

function chunkOfCentre(target: ContinentField): { x: number; z: number } {
  return { x: target.centerX >> 4, z: target.centerZ >> 4 };
}

/** Every chunk the footprint can touch. */
function eachChunk(
  target: ContinentField,
  visit: (plan: ContinentChunkPlan) => void,
  step = 1,
): void {
  const bounds = continentChunkBounds(target);
  for (let cz = bounds.minChunkZ; cz <= bounds.maxChunkZ; cz += step) {
    for (let cx = bounds.minChunkX; cx <= bounds.maxChunkX; cx += step) {
      visit(planContinentChunk(target, cx, cz));
    }
  }
}

describe("chunk rejection", () => {
  it("rejects chunks the continent cannot reach", () => {
    const target = field(600);
    const far = planContinentChunk(
      target,
      (target.centerX + target.radius * 4) >> 4,
      (target.centerZ + target.radius * 4) >> 4,
    );

    expect(far.empty).toBe(true);
    expect(far.volumes).toHaveLength(0);
    expect(far.blocks).toBe(0);
    expect(far.landColumns).toBe(0);
  });

  it("reports empty for chunks inside the radius but off the warped coast", () => {
    const target = field(600);
    let empties = 0;
    let filled = 0;

    eachChunk(target, (plan) => {
      if (plan.empty) empties += 1;
      else filled += 1;
    });

    // The warped coastline leaves a large part of the bounding square empty.
    expect(empties).toBeGreaterThan(0);
    expect(filled).toBeGreaterThan(0);
  }, 120000);

  it("fills the chunk at the centre of the continent", () => {
    const target = field(600);
    const centre = chunkOfCentre(target);
    const plan = planContinentChunk(target, centre.x, centre.z);

    expect(plan.empty).toBe(false);
    expect(plan.landColumns).toBe(CHUNK_SIZE * CHUNK_SIZE);
    expect(plan.blocks).toBeGreaterThan(0);
  });
});

describe("volumes describe the field exactly", () => {
  it.each([600, 1800])(
    "tiles every chunk cell with no gap or overlap at span %i",
    (span) => {
      const target = field(span);
      const centre = chunkOfCentre(target);
      let checked = 0;

      // A block of chunks spanning centre, mid-slope and coastline.
      for (let cz = centre.z; cz <= centre.z + 12; cz += 4) {
        for (let cx = centre.x; cx <= centre.x + 12; cx += 4) {
          const plan = planContinentChunk(target, cx, cz);
          if (plan.empty) continue;
          checked += 1;

          const written = new Map<string, string>();
          for (const volume of plan.volumes) {
            expect(volume.from.x).toBeLessThanOrEqual(volume.to.x);
            expect(volume.from.y).toBeLessThanOrEqual(volume.to.y);
            expect(volume.from.z).toBeLessThanOrEqual(volume.to.z);
            expect(volume.from.x).toBeGreaterThanOrEqual(plan.originX);
            expect(volume.to.x).toBeLessThan(plan.originX + CHUNK_SIZE);
            expect(volume.from.z).toBeGreaterThanOrEqual(plan.originZ);
            expect(volume.to.z).toBeLessThan(plan.originZ + CHUNK_SIZE);
            expect(volume.from.y).toBeGreaterThanOrEqual(plan.minY);
            expect(volume.to.y).toBeLessThanOrEqual(plan.maxY);

            let counted = 0;
            for (let y = volume.from.y; y <= volume.to.y; y += 1) {
              for (let z = volume.from.z; z <= volume.to.z; z += 1) {
                for (let x = volume.from.x; x <= volume.to.x; x += 1) {
                  const key = `${x},${y},${z}`;
                  // No overlap: a cell is never written twice.
                  expect(written.has(key), `overlap at ${key}`).toBe(false);
                  written.set(key, volume.band);
                  counted += 1;
                }
              }
            }
            expect(volume.blocks).toBe(counted);
          }

          // No gap and no stray: the written set matches the field exactly.
          for (let z = 0; z < CHUNK_SIZE; z += 1) {
            for (let x = 0; x < CHUNK_SIZE; x += 1) {
              const column = columnAt(
                target,
                plan.originX + x,
                plan.originZ + z,
              );
              for (let y = plan.minY - 1; y <= plan.maxY + 1; y += 1) {
                const band = strataAt(target, column, y);
                const key = `${plan.originX + x},${y},${plan.originZ + z}`;
                if (band === "air") {
                  expect(written.has(key), `stray fill at ${key}`).toBe(false);
                } else {
                  expect(written.get(key), `missing ${band} at ${key}`).toBe(
                    band,
                  );
                }
              }
            }
          }
        }
      }

      expect(checked).toBeGreaterThan(2);
    },
    120000,
  );

  it("reports a block total matching the sum of its volumes", () => {
    const target = field(1200);
    const centre = chunkOfCentre(target);

    for (let cz = centre.z; cz < centre.z + 6; cz += 1) {
      for (let cx = centre.x; cx < centre.x + 6; cx += 1) {
        const plan = planContinentChunk(target, cx, cz);
        const summed = plan.volumes.reduce(
          (total, volume) => total + volume.blocks,
          0,
        );
        expect(plan.blocks).toBe(summed);
      }
    }
  }, 120000);

  it("counts water separately and only inside lake columns", () => {
    const target = field(600);
    let waterChunks = 0;

    eachChunk(target, (plan) => {
      if (plan.empty) return;
      const water = plan.volumes
        .filter((volume) => volume.band === "water")
        .reduce((total, volume) => total + volume.blocks, 0);
      expect(water).toBe(plan.waterBlocks);
      if (water > 0) {
        expect(plan.lakeColumns).toBeGreaterThan(0);
        waterChunks += 1;
      }
    });

    expect(waterChunks).toBeGreaterThan(0);
  }, 120000);
});

describe("block budget", () => {
  it.each([600, 1800])(
    "stays under the stated ceiling at span %i",
    (span) => {
      const target = field(span);
      const ceiling = chunkBlockCeiling(target);
      let worst = 0;
      let worstVolumes = 0;

      eachChunk(
        target,
        (plan) => {
          if (plan.empty) return;
          expect(plan.blocks).toBeLessThanOrEqual(ceiling);
          if (plan.blocks > worst) worst = plan.blocks;
          if (plan.volumes.length > worstVolumes) {
            worstVolumes = plan.volumes.length;
          }
        },
        span === 600 ? 1 : 3,
      );

      // The ceiling is 256 * maxColumnHeight; a real chunk gets close to it in
      // the interior but can never exceed it.
      expect(ceiling).toBe(CHUNK_SIZE * CHUNK_SIZE * maxColumnHeight(target));
      expect(worst).toBeGreaterThan(ceiling / 2);
      expect(worst).toBeLessThanOrEqual(ceiling);

      // A single chunk also stays under the legacy /fill limit of 32,768, so no
      // chunk can need a split even under the most pessimistic fillBlocks cap.
      expect(ceiling).toBeLessThan(32768);

      // Guard against a decomposition regression: one fill per column per band
      // would be 768.
      expect(worstVolumes).toBeLessThan(600);
    },
    180000,
  );
});

describe("plan determinism", () => {
  it("returns an identical plan for repeated calls", () => {
    const target = field(600);
    const centre = chunkOfCentre(target);

    for (let index = 0; index < 12; index += 1) {
      const cx = centre.x + index;
      const cz = centre.z + (index % 5);
      expect(planContinentChunk(target, cx, cz)).toEqual(
        planContinentChunk(target, cx, cz),
      );
    }
  });

  it("is independent of the order chunks are planned in", () => {
    const target = field(600);
    const centre = chunkOfCentre(target);
    const coords: [number, number][] = [];
    for (let cz = centre.z - 2; cz <= centre.z + 2; cz += 1) {
      for (let cx = centre.x - 2; cx <= centre.x + 2; cx += 1) {
        coords.push([cx, cz]);
      }
    }

    const forward = coords.map(([cx, cz]) =>
      planContinentChunk(target, cx, cz),
    );
    const reversed = [...coords]
      .reverse()
      .map(([cx, cz]) => planContinentChunk(target, cx, cz));

    expect(reversed.reverse()).toEqual(forward);
  });
});

describe("chunk bounds", () => {
  it("covers every non-empty chunk of the footprint", () => {
    const target = field(600);
    const bounds = continentChunkBounds(target);

    // One ring outside the reported bounds must be empty in every direction.
    for (let cz = bounds.minChunkZ - 1; cz <= bounds.maxChunkZ + 1; cz += 1) {
      expect(planContinentChunk(target, bounds.minChunkX - 1, cz).empty).toBe(
        true,
      );
      expect(planContinentChunk(target, bounds.maxChunkX + 1, cz).empty).toBe(
        true,
      );
    }
    for (let cx = bounds.minChunkX - 1; cx <= bounds.maxChunkX + 1; cx += 1) {
      expect(planContinentChunk(target, cx, bounds.minChunkZ - 1).empty).toBe(
        true,
      );
      expect(planContinentChunk(target, cx, bounds.maxChunkZ + 1).empty).toBe(
        true,
      );
    }
  }, 120000);
});
