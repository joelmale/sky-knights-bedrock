import { describe, expect, it } from "vitest";

import {
  ARCHIPELAGO_CONFIG,
  archipelagoClusters,
  archipelagoIslandsWithinRadius,
  deriveArchipelagoIsland,
  parseArchipelagoIslandId,
  planArchipelago,
} from "../scripts/generation/archipelago";

describe("archipelago planner", () => {
  const seed = 12345;
  const version = 1;
  const plan = planArchipelago(seed, version);

  it("is deterministic, sorted, massive, bounded, and seed-separated", () => {
    expect(planArchipelago(seed, version)).toEqual(plan);
    expect(planArchipelago(seed + 1, version)).not.toEqual(plan);
    expect(plan.length).toBeGreaterThan(900);
    expect(plan.length).toBeLessThan(1200);
    expect(plan.map((island) => island.id)).toEqual(
      [...plan.map((island) => island.id)].sort(),
    );

    for (const island of plan) {
      expect(Math.abs(island.cellX)).toBeLessThanOrEqual(
        ARCHIPELAGO_CONFIG.maxCellRadius,
      );
      expect(Math.abs(island.cellZ)).toBeLessThanOrEqual(
        ARCHIPELAGO_CONFIG.maxCellRadius,
      );
      expect(island.y).toBeGreaterThanOrEqual(ARCHIPELAGO_CONFIG.minY);
      expect(island.y).toBeLessThanOrEqual(ARCHIPELAGO_CONFIG.maxY);
    }
  });

  it("keeps every island outside protected space and conservatively spaced", () => {
    for (const island of plan) {
      expect(island.x * island.x + island.z * island.z).toBeGreaterThanOrEqual(
        ARCHIPELAGO_CONFIG.protectedRadius ** 2,
      );
    }

    let nearestPairDistanceSquared = Number.POSITIVE_INFINITY;
    for (let left = 0; left < plan.length; left += 1) {
      for (let right = left + 1; right < plan.length; right += 1) {
        const island = plan[left];
        const other = plan[right];
        const dx = island.x - other.x;
        const dz = island.z - other.z;
        nearestPairDistanceSquared = Math.min(
          nearestPairDistanceSquared,
          dx * dx + dz * dz,
        );
      }
    }

    expect(nearestPairDistanceSquared).toBeGreaterThanOrEqual(
      ARCHIPELAGO_CONFIG.minSpacing ** 2,
    );
  });

  it("assigns each island to its nearest deterministic biome cluster", () => {
    const clusters = archipelagoClusters(seed, version);

    expect(clusters.map((cluster) => cluster.family)).toEqual([
      "verdant",
      "desert",
      "tundra",
      "volcanic",
    ]);

    for (const island of plan) {
      const own = clusters.find((cluster) => cluster.family === island.family);
      const nearest = Math.min(
        ...clusters.map(
          (cluster) =>
            Math.abs(island.cellX - cluster.cellX) +
            Math.abs(island.cellZ - cluster.cellZ),
        ),
      );

      expect(
        Math.abs(island.cellX - (own?.cellX ?? 0)) +
          Math.abs(island.cellZ - (own?.cellZ ?? 0)),
      ).toBe(nearest);
    }
  });

  it("round-trips compact IDs without admitting absent or out-of-range cells", () => {
    const island = plan[0];

    expect(parseArchipelagoIslandId(seed, version, island.id)).toEqual(island);
    expect(parseArchipelagoIslandId(seed, version, "bad")).toBeUndefined();
    expect(parseArchipelagoIslandId(seed, version, "a1_n0_p5")).toBeUndefined();
    expect(
      parseArchipelagoIslandId(seed, version, "a1_p05_p5"),
    ).toBeUndefined();
    expect(
      parseArchipelagoIslandId(seed, version, "a1_p999_p999"),
    ).toBeUndefined();
    expect(
      deriveArchipelagoIsland(seed, version, island.cellX, island.cellZ),
    ).toEqual(island);
  });

  it("supports bounded lazy radius queries", () => {
    const island = plan[0];

    expect(
      archipelagoIslandsWithinRadius(seed, version, island.x, island.z, 1),
    ).toEqual([island]);
    expect(archipelagoIslandsWithinRadius(seed, version, 0, 0, -1)).toEqual([]);
    expect(
      archipelagoIslandsWithinRadius(
        seed,
        version,
        island.x,
        island.z,
        Number.POSITIVE_INFINITY,
      ),
    ).toEqual([]);

    const bounded = archipelagoIslandsWithinRadius(
      seed,
      version,
      island.x,
      island.z,
      ARCHIPELAGO_CONFIG.maxQueryRadius * 10,
    );
    const capped = archipelagoIslandsWithinRadius(
      seed,
      version,
      island.x,
      island.z,
      ARCHIPELAGO_CONFIG.maxQueryRadius,
    );

    expect(bounded).toEqual(capped);
  });
});
