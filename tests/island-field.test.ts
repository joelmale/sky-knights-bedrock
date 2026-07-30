import { describe, expect, it } from "vitest";

import {
  ISLAND_TIER_SPAN,
  IslandTier,
  createIslandField,
  islandAmplitudeFor,
  islandColumns,
  islandTerrainMetrics,
} from "../scripts/generation/island-field";
import {
  CONTINENT_MIN_SPAN,
  createContinentField,
  isLand,
  surfaceY,
} from "../scripts/generation/continent-field";
import { ARCHIPELAGO_V4_DECK_CENTER_Y } from "../scripts/generation/archipelago-v4";

const TIERS: IslandTier[] = ["islet", "standard", "crag", "landmark"];
const SEED = 2026;

function source(tier: IslandTier, index = 7, deck = 1) {
  return { index, tier, deck, x: 0, z: 0 };
}

describe("ambient island terrain field", () => {
  // The defect this module exists to fix: the authored generator wrote a
  // surface block only at a single constant Y, so an island's surface height
  // was a constant and relief was exactly zero.
  it("gives every tier real vertical relief", () => {
    for (const tier of TIERS) {
      const metrics = islandTerrainMetrics(
        createIslandField(SEED, source(tier)),
      );

      expect(metrics.landColumns, tier).toBeGreaterThan(0);
      expect(metrics.relief, `${tier} relief`).toBeGreaterThan(0);
    }
  });

  // The second defect: a linear radius ramp with circular cross-sections is a
  // cone. A warped coastline must not be a circle.
  it("gives every tier a non-circular coastline", () => {
    for (const tier of TIERS) {
      const field = createIslandField(SEED, source(tier));
      const radii: number[] = [];

      for (let degrees = 0; degrees < 360; degrees += 15) {
        const radians = (degrees * Math.PI) / 180;
        let furthest = 0;

        for (let step = 1; step <= field.radius; step += 1) {
          const x = field.centerX + Math.round(Math.cos(radians) * step);
          const z = field.centerZ + Math.round(Math.sin(radians) * step);

          if (isLand(field, x, z)) {
            furthest = step;
          }
        }

        radii.push(furthest);
      }

      const spread = Math.max(...radii) - Math.min(...radii);
      expect(spread, `${tier} coastline spread`).toBeGreaterThan(0);
    }
  });

  // The third defect: 16 catalogue entries served over a thousand islands, so
  // roughly nineteen islands shared byte-identical terrain. Distinct indices
  // must give distinct terrain.
  it("gives distinct islands distinct terrain", () => {
    const signatures = new Set<string>();

    for (let index = 0; index < 24; index += 1) {
      const field = createIslandField(SEED, source("standard", index));
      const columns = islandColumns(field);
      signatures.add(
        columns
          .map(
            (column) =>
              `${column.x - field.centerX}:${column.z - field.centerZ}:${column.surfaceY - field.baseY}`,
          )
          .join("|"),
      );
    }

    expect(signatures.size).toBe(24);
  });

  it("is deterministic for one seed and index", () => {
    for (const tier of TIERS) {
      const a = islandTerrainMetrics(createIslandField(SEED, source(tier)));
      const b = islandTerrainMetrics(createIslandField(SEED, source(tier)));
      expect(b, tier).toEqual(a);
    }
  });

  it("keeps land inside the tier footprint", () => {
    for (const tier of TIERS) {
      const field = createIslandField(SEED, source(tier));
      expect(field.span).toBe(ISLAND_TIER_SPAN[tier] & ~1);

      for (const column of islandColumns(field)) {
        expect(
          Math.abs(column.x - field.centerX),
          `${tier} x bound`,
        ).toBeLessThanOrEqual(field.radius);
        expect(
          Math.abs(column.z - field.centerZ),
          `${tier} z bound`,
        ).toBeLessThanOrEqual(field.radius);
      }
    }
  });

  // An island taller than it is wide reads as a pillar, not an island. The
  // continent elevation curve produced exactly that at island scale: a 24-block
  // islet would have been 33 blocks tall.
  it("never makes an island taller than it is wide", () => {
    for (const tier of TIERS) {
      const field = createIslandField(SEED, source(tier));
      expect(field.amplitude, tier).toBeLessThan(field.span);
    }
  });

  it("mirrors the field's own amplitude choice", () => {
    for (const tier of TIERS) {
      const field = createIslandField(SEED, source(tier));
      expect(islandAmplitudeFor(ISLAND_TIER_SPAN[tier]), tier).toBe(
        field.amplitude,
      );
    }
  });

  it("centres each island on its planner-assigned deck", () => {
    for (let deck = 0; deck < ARCHIPELAGO_V4_DECK_CENTER_Y.length; deck += 1) {
      const field = createIslandField(SEED, source("crag", 3, deck));
      const metrics = islandTerrainMetrics(field);
      const target = ARCHIPELAGO_V4_DECK_CENTER_Y[deck];

      expect(field.baseY).toBeLessThanOrEqual(target);
      expect(metrics.maxSurfaceY).toBeGreaterThanOrEqual(field.baseY);
      // The island straddles its deck rather than sitting entirely above it.
      expect(Math.abs(field.baseY - target)).toBeLessThanOrEqual(
        field.amplitude,
      );
    }
  });

  it("rejects a deck or tier the planner does not define", () => {
    expect(() => createIslandField(SEED, source("crag", 1, 99))).toThrow(
      /deck/u,
    );
    expect(() =>
      createIslandField(SEED, {
        ...source("crag"),
        tier: "continent" as unknown as IslandTier,
      }),
    ).toThrow(/span/u);
  });

  // Continent terrain is shipping and its tests pin its constants. The island
  // profile must be additive: the default profile has to stay exactly as it was.
  it("leaves continent behaviour untouched", () => {
    const continent = createContinentField(SEED, 0, { span: 600 });

    expect(continent.span).toBe(600);
    expect(continent.radius).toBe(300);
    // The original fixed 8-block edge margin, not the scaled island margin.
    expect(continent.falloffRadius).toBe(
      continent.radius - continent.warpAmplitude - 8,
    );
    // The original elevation curve.
    expect(continent.amplitude).toBe(40);
    // The continent span floor still clamps upward.
    expect(createContinentField(SEED, 0, { span: 10 }).span).toBe(
      CONTINENT_MIN_SPAN,
    );
  });

  it("reports solid blocks consistent with its own columns", () => {
    const field = createIslandField(SEED, source("crag"));
    const metrics = islandTerrainMetrics(field);
    const expected = islandColumns(field).reduce(
      (total, column) => total + column.surfaceY - field.baseY + 1,
      0,
    );

    expect(metrics.solidBlocks).toBe(expected);
    expect(metrics.relief).toBe(metrics.maxSurfaceY - metrics.minSurfaceY);
  });

  it("keeps surfaceY inside the world and above the base", () => {
    for (const tier of TIERS) {
      const field = createIslandField(SEED, source(tier));

      for (const column of islandColumns(field)) {
        expect(column.surfaceY).toBeGreaterThanOrEqual(field.baseY);
        expect(column.surfaceY).toBeLessThan(320);
        expect(surfaceY(field, column.x, column.z)).toBe(column.surfaceY);
      }
    }
  });
});
