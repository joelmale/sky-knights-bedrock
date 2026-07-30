import { describe, expect, it } from "vitest";

import {
  ARCHIPELAGO_CONFIG,
  archipelagoContinentAnchors,
  deriveArchipelagoIsland,
} from "../scripts/generation/archipelago";
import {
  ARCHIPELAGO_V4_CONFIG,
  ARCHIPELAGO_V4_DECK_CENTER_Y,
  ARCHIPELAGO_V4_FIBONACCI_RINGS,
  archipelagoV4CapCoversPlan,
  archipelagoV4Clusters,
  archipelagoV4IslandsWithinRadius,
  parseArchipelagoV4IslandId,
  planArchipelagoV4,
  type ArchipelagoV4Island,
} from "../scripts/generation/archipelago-v4";
import { deriveContinentStreamingSites } from "../scripts/generation/continent-streaming";

const SEEDS = [0, 1, 7, 12345, 0x80000000, 0xffffffff];

function centerY(island: ArchipelagoV4Island): number {
  return island.y + Math.floor(island.size.y / 2);
}

function intersects(
  left: Pick<
    ArchipelagoV4Island,
    "x" | "y" | "z" | "size" | "radius" | "heightRadius"
  >,
  right: Pick<
    ArchipelagoV4Island,
    "x" | "y" | "z" | "size" | "radius" | "heightRadius"
  >,
): boolean {
  const dx = left.x - right.x;
  const dz = left.z - right.z;
  const horizontal =
    left.radius + right.radius + ARCHIPELAGO_V4_CONFIG.minEdgeGap;
  if (dx * dx + dz * dz >= horizontal * horizontal) return false;

  const leftCenterY = left.y + Math.floor(left.size.y / 2);
  const rightCenterY = right.y + Math.floor(right.size.y / 2);
  return (
    Math.abs(leftCenterY - rightCenterY) <
    left.heightRadius + right.heightRadius + ARCHIPELAGO_V4_CONFIG.minEdgeGap
  );
}

describe("a4 clustered archipelago planner", () => {
  it("builds a deterministic, seed-separated plan under a new namespace", () => {
    const plan = planArchipelagoV4(12345);

    expect(planArchipelagoV4(12345)).toEqual(plan);
    expect(planArchipelagoV4(12346)).not.toEqual(plan);
    expect(ARCHIPELAGO_V4_CONFIG.idVersion).toBe(4);
    expect(archipelagoV4CapCoversPlan()).toBe(true);

    for (const island of plan) {
      expect(island.id).toBe(`a4_${island.index.toString(36)}`);
      expect(parseArchipelagoV4IslandId(12345, island.id)).toEqual(island);
      expect(island.structureId).toMatch(/^skyknights:a3_/u);
    }
  });

  it("keeps the Fibonacci cohorts as an exact cluster-count contract", () => {
    expect(
      ARCHIPELAGO_V4_FIBONACCI_RINGS.reduce((total, count) => total + count, 0),
    ).toBe(ARCHIPELAGO_V4_CONFIG.clusterCount);

    const clusters = archipelagoV4Clusters(12345);
    expect(clusters).toHaveLength(ARCHIPELAGO_V4_CONFIG.clusterCount);

    for (
      let ringIndex = 2;
      ringIndex < ARCHIPELAGO_V4_FIBONACCI_RINGS.length + 2;
      ringIndex += 1
    ) {
      expect(
        clusters.filter((cluster) => cluster.ringIndex === ringIndex),
      ).toHaveLength(ARCHIPELAGO_V4_FIBONACCI_RINGS[ringIndex - 2]);
    }
  });

  it("keeps same-deck cluster centres separated by real open sky", () => {
    for (const seed of SEEDS) {
      const clusters = archipelagoV4Clusters(seed);

      for (let left = 0; left < clusters.length; left += 1) {
        for (let right = left + 1; right < clusters.length; right += 1) {
          if (clusters[left].deck !== clusters[right].deck) continue;
          expect(
            Math.hypot(
              clusters[left].x - clusters[right].x,
              clusters[left].z - clusters[right].z,
            ),
          ).toBeGreaterThanOrEqual(ARCHIPELAGO_V4_CONFIG.minClusterCenterGap);
        }
      }
    }
  });

  it("forms coherent three-to-four-island archipelagos", () => {
    for (const seed of SEEDS) {
      const clusters = archipelagoV4Clusters(seed);
      const islands = planArchipelagoV4(seed);
      const byCluster = new Map<number, ArchipelagoV4Island[]>();

      for (const island of islands) {
        const members = byCluster.get(island.clusterIndex) ?? [];
        members.push(island);
        byCluster.set(island.clusterIndex, members);
      }

      for (const cluster of clusters) {
        const members = byCluster.get(cluster.index) ?? [];
        if (cluster.reservedByContinent) {
          expect(members).toHaveLength(0);
          continue;
        }

        expect(members.some((member) => member.memberIndex === 0)).toBe(true);
        expect(members.length).toBeGreaterThanOrEqual(1);
        expect(members.length).toBeLessThanOrEqual(
          ARCHIPELAGO_V4_CONFIG.sitesPerCluster,
        );
        expect(
          members.every((member) => member.family === cluster.family),
        ).toBe(true);
        expect(
          members.every(
            (member) =>
              member.clusterOffset + member.radius <=
              ARCHIPELAGO_V4_CONFIG.maxClusterReach,
          ),
        ).toBe(true);
      }

      const populated = [...byCluster.values()];
      const average =
        populated.reduce((total, members) => total + members.length, 0) /
        populated.length;
      expect(average).toBeGreaterThanOrEqual(3);
      expect(average).toBeLessThanOrEqual(4.25);
      expect(islands.length).toBeGreaterThanOrEqual(1100);
      expect(islands.length).toBeLessThanOrEqual(1500);
    }
  });

  it("keeps every island inside the world, radial, and deck contracts", () => {
    for (const seed of SEEDS) {
      for (const island of planArchipelagoV4(seed)) {
        const radial = Math.hypot(island.x, island.z);
        expect(radial - island.radius).toBeGreaterThanOrEqual(
          ARCHIPELAGO_V4_CONFIG.protectedRadius,
        );
        expect(radial + island.radius).toBeLessThanOrEqual(
          ARCHIPELAGO_V4_CONFIG.outerSiteRadius,
        );
        expect(island.y).toBeGreaterThanOrEqual(
          ARCHIPELAGO_V4_CONFIG.absoluteMinY,
        );
        expect(island.y + island.size.y - 1).toBeLessThanOrEqual(
          ARCHIPELAGO_V4_CONFIG.absoluteMaxTopY,
        );
        expect(centerY(island)).toBe(ARCHIPELAGO_V4_DECK_CENTER_Y[island.deck]);
      }
    }
  });

  // Islands within a cluster are ALLOWED to intersect, and are expected to:
  // terrain is written with an air-only fill filter, so two overlapping islands
  // merge into the union of their terrain rather than one erasing the other.
  // What must still hold is that separate clusters stay separate, so the field
  // reads as distinct archipelagos rather than one continuous belt.
  it("merges within a cluster but keeps clusters apart on a deck", () => {
    for (const seed of SEEDS) {
      const islands = planArchipelagoV4(seed);

      for (let left = 0; left < islands.length; left += 1) {
        for (let right = left + 1; right < islands.length; right += 1) {
          if (
            islands[left].clusterIndex !== islands[right].clusterIndex &&
            islands[left].deck === islands[right].deck
          ) {
            const edgeGap =
              Math.hypot(
                islands[left].x - islands[right].x,
                islands[left].z - islands[right].z,
              ) -
              islands[left].radius -
              islands[right].radius;
            expect(edgeGap).toBeGreaterThanOrEqual(24);
          }
        }
      }
    }
  }, 120000);

  // The merge is the feature, so assert it actually happens. Without this the
  // additive offset floor could return - satellites placed at both radii plus a
  // fixed gap, which made intersection impossible however the cluster was tuned
  // - and every other test here would still pass.
  it("actually produces merged islands", () => {
    const islands = planArchipelagoV4(SEEDS[0]);
    const merged = new Set<string>();

    for (let left = 0; left < islands.length; left += 1) {
      for (let right = left + 1; right < islands.length; right += 1) {
        if (intersects(islands[left], islands[right])) {
          merged.add(islands[left].id);
          merged.add(islands[right].id);
        }
      }
    }

    // Measured at roughly 65% of islands across 482 intersecting pairs. A wide
    // band, because the exact figure moves with tier mix and presence rolls.
    expect(merged.size).toBeGreaterThan(islands.length / 4);
    expect(merged.size).toBeLessThan(islands.length);
  }, 120000);

  it("reserves every active a2 continent footprint at planner level", () => {
    for (const seed of SEEDS) {
      const continents = archipelagoContinentAnchors(
        seed,
        ARCHIPELAGO_CONFIG.idVersion,
      )
        .map((anchor) =>
          deriveArchipelagoIsland(
            seed,
            ARCHIPELAGO_CONFIG.idVersion,
            anchor.cellX,
            anchor.cellZ,
          ),
        )
        .filter((island) => island?.tier === "continent");

      for (const island of planArchipelagoV4(seed)) {
        for (const continent of continents) {
          if (continent !== undefined) {
            expect(intersects(island, continent)).toBe(false);
          }
        }
      }
    }
  });

  it("reserves the full 600-block formula-continent footprint", () => {
    for (const seed of SEEDS) {
      const continents = deriveContinentStreamingSites(seed, {
        legacyLayoutVersion: ARCHIPELAGO_CONFIG.idVersion,
        span: 600,
      });

      for (const island of planArchipelagoV4(seed)) {
        for (const continent of continents) {
          const edgeGap =
            Math.hypot(
              island.x - continent.field.centerX,
              island.z - continent.field.centerZ,
            ) -
            island.radius -
            continent.field.radius;
          expect(edgeGap).toBeGreaterThanOrEqual(
            ARCHIPELAGO_V4_CONFIG.minEdgeGap,
          );
        }
      }
    }
  });

  it("queries by bounded radius and rejects malformed ids", () => {
    const seed = 12345;
    const island = planArchipelagoV4(seed)[100];

    expect(
      archipelagoV4IslandsWithinRadius(seed, island.x, island.z, 0),
    ).toEqual([island]);
    expect(archipelagoV4IslandsWithinRadius(seed, 0, 0, -1)).toEqual([]);
    expect(
      archipelagoV4IslandsWithinRadius(
        seed,
        island.x,
        island.z,
        ARCHIPELAGO_V4_CONFIG.maxQueryRadius * 10,
      ),
    ).toEqual(
      archipelagoV4IslandsWithinRadius(
        seed,
        island.x,
        island.z,
        ARCHIPELAGO_V4_CONFIG.maxQueryRadius,
      ),
    );
    expect(parseArchipelagoV4IslandId(seed, "a3_0")).toBeUndefined();
    expect(parseArchipelagoV4IslandId(seed, "a4_00")).toBeUndefined();
    expect(parseArchipelagoV4IslandId(seed, "a4_zzzz")).toBeUndefined();
  });
});
