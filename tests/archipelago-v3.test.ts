import { describe, expect, it } from "vitest";

import {
  ARCHIPELAGO_CONFIG,
  archipelagoIslandsWithinRadius,
} from "../scripts/generation/archipelago";
import {
  ARCHIPELAGO_V3_CONFIG,
  ARCHIPELAGO_V3_FIBONACCI_RINGS,
  ARCHIPELAGO_V3_TEMPLATES,
  archipelagoV3Clusters,
  archipelagoV3IslandsWithinRadius,
  parseArchipelagoV3IslandId,
  planArchipelagoV3,
} from "../scripts/generation/archipelago-v3";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import * as a3StructureTools from "../tools/structures/archipelago_v3_shared.mjs";

interface ToolCatalogEntry {
  size: { x: number; y: number; z: number };
  radius: number;
  heightRadius: number;
  observerClearance: number;
  safeDock: { x: number; y: number; z: number };
  topSurfaceCells: number;
  parts: readonly {
    structureId: string;
    origin: { x: number; y: number; z: number };
    rotation: "None" | "Rotate90" | "Rotate180" | "Rotate270";
    row: number;
    size: readonly [number, number, number];
    integrityBlock: {
      offset: { x: number; y: number; z: number };
      typeId: string;
    };
  }[];
}

const TOOL_CATALOG = a3StructureTools.A3_AMBIENT_CATALOG as Readonly<
  Record<string, ToolCatalogEntry>
>;

describe("a3 Fibonacci archipelago planner", () => {
  const seed = 12345;
  const plan = planArchipelagoV3(seed);

  it("builds a deterministic, seed-separated Fibonacci-annulus plan", () => {
    expect(
      ARCHIPELAGO_V3_FIBONACCI_RINGS.reduce((total, count) => total + count, 0),
    ).toBe(ARCHIPELAGO_V3_CONFIG.siteCount);
    expect(planArchipelagoV3(seed)).toEqual(plan);
    expect(planArchipelagoV3(seed + 1)).not.toEqual(plan);
    expect(plan.length).toBeGreaterThan(ARCHIPELAGO_V3_CONFIG.siteCount * 0.98);

    for (const island of plan) {
      const radius = Math.hypot(island.x, island.z);
      expect(island.id).toBe(`a3_${island.index.toString(36)}`);
      expect(island.ringIndex).toBeGreaterThanOrEqual(0);
      expect(island.ringIndex).toBeLessThan(
        ARCHIPELAGO_V3_FIBONACCI_RINGS.length,
      );
      expect(radius - island.radius).toBeGreaterThanOrEqual(
        ARCHIPELAGO_V3_CONFIG.protectedRadius,
      );
      expect(radius).toBeLessThanOrEqual(
        ARCHIPELAGO_V3_CONFIG.outerSiteRadius + 2,
      );
      expect(island.y).toBeGreaterThanOrEqual(
        ARCHIPELAGO_V3_CONFIG.absoluteMinY,
      );
      expect(island.y + island.size.y - 1).toBeLessThanOrEqual(
        ARCHIPELAGO_V3_CONFIG.absoluteMaxTopY,
      );
      expect(island.observerClearance).toBeLessThanOrEqual(
        ARCHIPELAGO_V3_CONFIG.maxQueryRadius,
      );
    }
  });

  it("matches the generated catalog at roughly tenfold usable surface area", () => {
    const expected = {
      islet: {
        size: { x: 25, y: 14, z: 25 },
        oldUsableTop: 35,
        usableTop: 377,
        parts: 1,
      },
      standard: {
        size: { x: 39, y: 20, z: 39 },
        oldUsableTop: 91,
        usableTop: 1009,
        parts: 1,
      },
      crag: {
        size: { x: 64, y: 34, z: 64 },
        oldUsableTop: 309,
        usableTop: 2828,
        parts: 4,
      },
      landmark: {
        size: { x: 120, y: 40, z: 120 },
        oldUsableTop: 901,
        usableTop: 9176,
        parts: 16,
      },
    } as const;

    for (const tier of ["islet", "standard", "crag", "landmark"] as const) {
      const metrics = expected[tier];
      for (const family of ["verdant", "desert", "tundra", "volcanic"]) {
        const template = ARCHIPELAGO_V3_TEMPLATES[`${tier}_${family}`];
        expect(template.structureId).toMatch(
          new RegExp(`^skyknights:a3_${tier}_${family}_`, "u"),
        );
        expect(template.size).toEqual(metrics.size);
        expect(template.usableTopCells).toBe(metrics.usableTop);
        expect(template.parts).toHaveLength(metrics.parts);
        expect(
          template.usableTopCells / metrics.oldUsableTop,
        ).toBeGreaterThanOrEqual(9);
        expect(
          template.usableTopCells / metrics.oldUsableTop,
        ).toBeLessThanOrEqual(12);
        expect(template.integrityBlocks).toHaveLength(metrics.parts);
      }
    }

    expect(ARCHIPELAGO_V3_TEMPLATES.crag_verdant.solidBlockCount).toBe(19880);
    expect(ARCHIPELAGO_V3_TEMPLATES.landmark_verdant.solidBlockCount).toBe(
      64500,
    );
  });

  it("keeps runtime metadata synchronized with the generated-asset catalog", () => {
    expect(Object.keys(ARCHIPELAGO_V3_TEMPLATES).sort()).toEqual(
      Object.keys(TOOL_CATALOG).sort(),
    );

    for (const key of Object.keys(ARCHIPELAGO_V3_TEMPLATES)) {
      const template = ARCHIPELAGO_V3_TEMPLATES[key];
      const generated = TOOL_CATALOG[key];

      expect(template.size).toEqual(generated.size);
      expect(template.radius).toBe(generated.radius);
      expect(template.heightRadius).toBe(generated.heightRadius);
      expect(template.observerClearance).toBe(generated.observerClearance);
      expect(template.safeDock).toEqual(generated.safeDock);
      expect(template.usableTopCells).toBe(generated.topSurfaceCells);
      expect(template.parts).toEqual(
        generated.parts.map((part) => ({
          structureId: part.structureId,
          relativeOrigin: part.origin,
          rotation: part.rotation,
          row: part.row,
          size: {
            x: part.size[0],
            y: part.size[1],
            z: part.size[2],
          },
          integrityBlock: part.integrityBlock,
        })),
      );
    }
  });

  it("keeps complete resolved clearance cylinders non-intersecting", () => {
    const conflicts: string[] = [];

    for (let left = 0; left < plan.length; left += 1) {
      for (let right = left + 1; right < plan.length; right += 1) {
        const island = plan[left];
        const other = plan[right];
        const dx = island.x - other.x;
        const dz = island.z - other.z;
        const horizontalClear =
          dx * dx + dz * dz >=
          (island.radius + other.radius + ARCHIPELAGO_V3_CONFIG.minEdgeGap) **
            2;
        const verticalClear =
          Math.abs(
            island.y +
              Math.floor(island.size.y / 2) -
              (other.y + Math.floor(other.size.y / 2)),
          ) >=
          island.heightRadius +
            other.heightRadius +
            ARCHIPELAGO_V3_CONFIG.minEdgeGap;

        if (!horizontalClear && !verticalClear) {
          conflicts.push(`${island.id}:${other.id}`);
        }
      }
    }

    expect(conflicts).toEqual([]);
  });

  it("provides about 2.0-2.6x the a2 candidates in observation windows", () => {
    const observations = [
      { x: 900, z: 0 },
      { x: 1200, z: 600 },
      { x: -1500, z: 900 },
      { x: 1900, z: -800 },
      { x: -2200, z: -1200 },
    ] as const;
    let a2Count = 0;
    let a3Count = 0;

    for (const observation of observations) {
      a2Count += archipelagoIslandsWithinRadius(
        seed,
        ARCHIPELAGO_CONFIG.idVersion,
        observation.x,
        observation.z,
        ARCHIPELAGO_CONFIG.maxQueryRadius,
      ).filter((island) => island.tier !== "continent").length;
      a3Count += archipelagoV3IslandsWithinRadius(
        seed,
        observation.x,
        observation.z,
        512,
      ).length;
    }

    expect(a3Count / a2Count).toBeGreaterThanOrEqual(2);
    expect(a3Count / a2Count).toBeLessThanOrEqual(2.6);
  });

  it("round-trips compact IDs and supports bounded local queries", () => {
    const island = plan[Math.floor(plan.length / 2)];

    expect(parseArchipelagoV3IslandId(seed, island.id)).toEqual(island);
    expect(parseArchipelagoV3IslandId(seed, "a3_00")).toBeUndefined();
    expect(parseArchipelagoV3IslandId(seed, "a2_p1_p1")).toBeUndefined();
    expect(parseArchipelagoV3IslandId(seed, "a3_zzzz")).toBeUndefined();
    expect(
      archipelagoV3IslandsWithinRadius(seed, island.x, island.z, 0),
    ).toEqual([island]);
    expect(archipelagoV3IslandsWithinRadius(seed, 0, 0, -1)).toEqual([]);
    expect(
      archipelagoV3IslandsWithinRadius(seed, 0, 0, Number.POSITIVE_INFINITY),
    ).toEqual([]);
    expect(
      archipelagoV3IslandsWithinRadius(
        seed,
        island.x,
        island.z,
        ARCHIPELAGO_V3_CONFIG.maxQueryRadius * 10,
      ),
    ).toEqual(
      archipelagoV3IslandsWithinRadius(
        seed,
        island.x,
        island.z,
        ARCHIPELAGO_V3_CONFIG.maxQueryRadius,
      ),
    );
  });

  it("keeps spatial placement independent from family cluster labels", () => {
    const clusters = archipelagoV3Clusters(seed);
    expect(clusters).toHaveLength(8);
    expect(
      clusters.reduce<Record<string, number>>((counts, cluster) => {
        counts[cluster.family] = (counts[cluster.family] ?? 0) + 1;
        return counts;
      }, {}),
    ).toEqual({
      verdant: 2,
      desert: 2,
      tundra: 2,
      volcanic: 2,
    });
    expect(new Set(plan.map((island) => island.family))).toEqual(
      new Set(["verdant", "desert", "tundra", "volcanic"]),
    );
  });
});
