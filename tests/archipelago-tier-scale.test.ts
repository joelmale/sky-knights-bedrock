import { describe, expect, it } from "vitest";

import { expectByteIdentical } from "./byte-equality";

// @ts-expect-error Structure tooling modules are plain JavaScript.
import * as a3StructureTools from "../tools/structures/archipelago_v3_shared.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import * as tierStructureTools from "../tools/structures/tier_shared.mjs";

interface Inspection {
  counts: { total: number; solid: number; air: number; liquid: number };
  indices: number[];
}

interface StructureModule {
  id: string;
  family: string;
  tier: string;
  role: string;
  structureId: string;
  outputPath: string[];
  size: readonly number[];
  integrityBlocks: readonly {
    offset: { x: number; y: number; z: number };
    typeId: string;
  }[];
  inspect(): Inspection;
  build(): Uint8Array;
}

interface CatalogPart {
  structureId: string;
  origin: { x: number; y: number; z: number };
  rotation: "None" | "Rotate90" | "Rotate180" | "Rotate270";
  row: number;
  size: readonly number[];
  integrityBlock: {
    offset: { x: number; y: number; z: number };
    typeId: string;
  };
}

interface CatalogEntry {
  id: string;
  family: string;
  tier: string;
  size: { x: number; y: number; z: number };
  radius: number;
  observerClearance: number;
  safeDock: { x: number; y: number; z: number };
  topY: number;
  topSurfaceCells: number;
  partGrid: number;
  parts: readonly CatalogPart[];
  body: {
    contains(x: number, y: number, z: number): boolean;
  };
}

const {
  A3_AMBIENT_CATALOG,
  A3_AMBIENT_FAMILIES,
  A3_AMBIENT_STRUCTURE_MODULES,
  A3_AMBIENT_TIERS,
} = a3StructureTools;
const {
  A3_AMBIENT_PART_BOX_CEILING,
  A3_AMBIENT_SOLID_BLOCK_CEILING,
  TIER_GEOMETRY,
} = tierStructureTools;
const MODULES = A3_AMBIENT_STRUCTURE_MODULES as readonly StructureModule[];
const CATALOG = A3_AMBIENT_CATALOG as Readonly<Record<string, CatalogEntry>>;
const CURRENT_TOP_SURFACES: Readonly<Record<string, number>> = {
  islet: 35,
  standard: 91,
  crag: 309,
  landmark: 901,
};

function rotatedOffset(
  x: number,
  z: number,
  size: readonly number[],
  rotation: CatalogPart["rotation"],
): { x: number; z: number } {
  if (rotation === "Rotate90") {
    return { x: size[2] - 1 - z, z: x };
  }
  if (rotation === "Rotate180") {
    return { x: size[0] - 1 - x, z: size[2] - 1 - z };
  }
  if (rotation === "Rotate270") {
    return { x: z, z: size[0] - 1 - x };
  }
  return { x, z };
}

describe("a3 ambient tier scale catalog", () => {
  it("leaves every shipped run-1/run-2 geometry contract unchanged", () => {
    expect(TIER_GEOMETRY).toEqual({
      islet: {
        size: [11, 8, 9],
        dockY: 4,
        clearanceRadius: 14,
        heightRadius: 8,
      },
      standard: {
        size: [15, 10, 13],
        dockY: 6,
        clearanceRadius: 16,
        heightRadius: 9,
      },
      crag: {
        size: [23, 18, 21],
        dockY: 10,
        clearanceRadius: 22,
        heightRadius: 13,
      },
      landmark: {
        size: [39, 30, 35],
        dockY: 15,
        clearanceRadius: 33,
        heightRadius: 19,
      },
    });
  });

  it("defines every family/tier combination with approximately 10x usable surface", () => {
    expect(Object.keys(CATALOG)).toHaveLength(
      A3_AMBIENT_FAMILIES.length * A3_AMBIENT_TIERS.length,
    );

    for (const family of A3_AMBIENT_FAMILIES as readonly string[]) {
      for (const tier of A3_AMBIENT_TIERS as readonly string[]) {
        const entry = CATALOG[`${tier}_${family}`];
        const scale = entry.topSurfaceCells / CURRENT_TOP_SURFACES[tier];

        expect(entry.id).toBe(`a3_${tier}_${family}`);
        expect(scale, `${entry.id} surface scale`).toBeGreaterThanOrEqual(9);
        expect(scale, `${entry.id} surface scale`).toBeLessThanOrEqual(12);
        expect(entry.safeDock.y).toBe(entry.topY + 1);
        expect(
          entry.body.contains(
            entry.safeDock.x,
            entry.safeDock.y - 1,
            entry.safeDock.z,
          ),
        ).toBe(true);
        expect(entry.observerClearance).toBeGreaterThan(entry.radius);
      }
    }
  });

  it("uses one part for islets/standards and bounded multipart compositions for larger tiers", () => {
    const expectedParts: Readonly<Record<string, number>> = {
      islet: 1,
      standard: 1,
      crag: 4,
      landmark: 16,
    };

    for (const key of Object.keys(CATALOG)) {
      const entry = CATALOG[key];
      expect(entry.parts).toHaveLength(expectedParts[entry.tier]);

      for (const part of entry.parts) {
        expect(part.size[0]).toBeLessThanOrEqual(64);
        expect(part.size[2]).toBeLessThanOrEqual(64);
        expect(
          part.size.reduce((product, dimension) => product * dimension, 1),
        ).toBeLessThanOrEqual(A3_AMBIENT_PART_BOX_CEILING);
        expect(part.origin.x + part.size[0]).toBeLessThanOrEqual(entry.size.x);
        expect(part.origin.z + part.size[2]).toBeLessThanOrEqual(entry.size.z);
      }
    }
  });

  it("keeps every unique placement call under the solid and box-cell ceilings", () => {
    expect(MODULES).toHaveLength(28);

    for (const module of MODULES) {
      const inspection = module.inspect();
      const boxCells = module.size.reduce(
        (product, dimension) => product * dimension,
        1,
      );

      expect(module.id.startsWith("a3_")).toBe(true);
      expect(module.structureId).toBe(`skyknights:${module.id}`);
      expect(module.outputPath[module.outputPath.length - 1]).toBe(
        `${module.id}.mcstructure`,
      );
      expect(inspection.counts.total).toBe(boxCells);
      expect(inspection.counts.solid).toBeLessThanOrEqual(
        A3_AMBIENT_SOLID_BLOCK_CEILING,
      );
      expect(inspection.counts.air).toBe(0);
      expect(inspection.counts.liquid).toBe(0);
      expect(module.integrityBlocks).toHaveLength(1);

      // One family exercises every unique tier/role encoding. Running the NBT
      // writer twice for all four palette variants adds no geometry coverage
      // and needlessly quadruples the focused test's runtime.
      if (module.family === "verdant") {
        expectByteIdentical(module.build(), module.build(), module.id);
      }
    }
  });

  it("reconstructs every logical top surface without holes or overlapping parts", () => {
    const byId = new Map(MODULES.map((module) => [module.structureId, module]));

    for (const key of Object.keys(CATALOG)) {
      const entry = CATALOG[key];
      const occupied = new Set<string>();

      for (const part of entry.parts) {
        const module = byId.get(part.structureId);

        expect(module).toBeDefined();
        if (module === undefined) continue;
        const inspection = module.inspect();
        const [, height, depth] = module.size;

        for (let x = 0; x < module.size[0]; x += 1) {
          for (let z = 0; z < module.size[2]; z += 1) {
            const index =
              inspection.indices[x * height * depth + entry.topY * depth + z];

            if (index < 0) continue;
            const rotated = rotatedOffset(x, z, module.size, part.rotation);
            const globalX = part.origin.x + rotated.x;
            const globalZ = part.origin.z + rotated.z;
            const key = `${globalX},${globalZ}`;

            expect(occupied.has(key), `${entry.id} overlap at ${key}`).toBe(
              false,
            );
            occupied.add(key);
          }
        }
      }

      expect(occupied.size).toBe(entry.topSurfaceCells);

      for (let x = 0; x < entry.size.x; x += 1) {
        for (let z = 0; z < entry.size.z; z += 1) {
          expect(occupied.has(`${x},${z}`)).toBe(
            entry.body.contains(x, entry.topY, z),
          );
        }
      }
    }
  });
});
