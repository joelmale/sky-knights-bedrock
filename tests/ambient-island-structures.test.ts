import { describe, expect, it } from "vitest";

import { ISLAND_FAMILIES } from "../scripts/config/islands";
import { ARCHIPELAGO_TEMPLATES } from "../scripts/generation/archipelago";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as desert } from "../tools/structures/ambient_desert.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as tundra } from "../tools/structures/ambient_tundra.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as verdant } from "../tools/structures/ambient_verdant.mjs";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { island as volcanic } from "../tools/structures/ambient_volcanic.mjs";

type Family = keyof typeof ISLAND_FAMILIES;

interface AmbientBody {
  centerX: number;
  centerZ: number;
  topY: number;
  contains(x: number, y: number, z: number): boolean;
}

interface AmbientInspection {
  palette: string[];
  indices: number[];
}

interface AmbientIsland {
  id: string;
  family: Family;
  structureId: string;
  outputPath: string[];
  size: number[];
  palette: string[];
  body: AmbientBody;
  integrityBlocks: Array<{
    offset: { x: number; y: number; z: number };
    typeId: string;
  }>;
  inspect(): AmbientInspection;
  build(): Uint8Array;
}

const ISLANDS = [desert, tundra, verdant, volcanic] as AmbientIsland[];
const CONTAINER_PATTERN =
  /(?:chest|barrel|shulker_box|hopper|dropper|dispenser|furnace|smoker|brewing_stand)$/u;
const PROGRESSION_BLOCKS = new Set([
  "minecraft:ancient_debris",
  "minecraft:diamond_block",
  "minecraft:emerald_block",
  "minecraft:netherite_block",
]);

function typeAt(
  island: AmbientIsland,
  inspection: AmbientInspection,
  x: number,
  y: number,
  z: number,
): string | undefined {
  const [, height, depth] = island.size;
  const paletteIndex =
    inspection.indices[x * height * depth + y * depth + z] ?? -1;
  return paletteIndex < 0 ? undefined : inspection.palette[paletteIndex];
}

describe("ambient island structures", () => {
  it("has one visually distinct vanilla palette for every family", () => {
    expect(ISLANDS.map((island) => island.family).sort()).toEqual([
      "desert",
      "tundra",
      "verdant",
      "volcanic",
    ]);

    const signatures = new Set<string>();

    for (const island of ISLANDS) {
      const familyPalette = ISLAND_FAMILIES[island.family].palette;

      expect(island.id).toBe(`ambient_${island.family}`);
      expect(island.structureId).toBe(`skyknights:${island.id}`);
      expect(island.structureId).toBe(
        ARCHIPELAGO_TEMPLATES[island.family].structureId,
      );
      expect(island.size).toEqual([
        ARCHIPELAGO_TEMPLATES[island.family].size.x,
        ARCHIPELAGO_TEMPLATES[island.family].size.y,
        ARCHIPELAGO_TEMPLATES[island.family].size.z,
      ]);
      expect(island.integrityBlocks).toEqual(
        ARCHIPELAGO_TEMPLATES[island.family].integrityBlocks,
      );
      expect(island.palette).toEqual(
        expect.arrayContaining([
          familyPalette.core,
          familyPalette.subsurface,
          familyPalette.surface,
          familyPalette.accent,
        ]),
      );
      expect(
        island.palette.every((typeId) => typeId.startsWith("minecraft:")),
      ).toBe(true);

      signatures.add(island.palette.join("|"));
    }

    expect(signatures.size).toBe(ISLANDS.length);
  });

  it("fills every canonical body cell and matches every integrity probe", () => {
    for (const island of ISLANDS) {
      const inspection = island.inspect();
      const [width, , depth] = island.size;

      for (let y = 0; y <= island.body.topY; y += 1) {
        for (let x = 0; x < width; x += 1) {
          for (let z = 0; z < depth; z += 1) {
            if (island.body.contains(x, y, z)) {
              expect(
                typeAt(island, inspection, x, y, z),
                `${island.id} body gap at ${x},${y},${z}`,
              ).toBeDefined();
            }
          }
        }
      }

      for (const probe of island.integrityBlocks) {
        expect(
          typeAt(
            island,
            inspection,
            probe.offset.x,
            probe.offset.y,
            probe.offset.z,
          ),
        ).toBe(probe.typeId);
      }
    }
  });

  it("stays within the lazy-placement structure and block budgets", () => {
    for (const island of ISLANDS) {
      const inspection = island.inspect();
      const volume = island.size.reduce(
        (product, dimension) => product * dimension,
        1,
      );
      const placedBlocks = inspection.indices.filter(
        (paletteIndex) => paletteIndex >= 0,
      ).length;

      expect(island.size).toEqual([15, 10, 13]);
      expect(volume).toBeLessThanOrEqual(2_048);
      expect(placedBlocks).toBeLessThanOrEqual(512);
      expect(island.palette.length).toBeLessThanOrEqual(8);
      expect(island.build().byteLength).toBeLessThanOrEqual(20_000);
      expect(island.build()).toEqual(island.build());
    }
  });

  it("contains no docks, containers, or progression-unique blocks", () => {
    for (const island of ISLANDS) {
      const dockBlock = ISLAND_FAMILIES[island.family].palette.dock;

      expect(island.palette).not.toContain(dockBlock);
      expect(
        island.palette.some((typeId) => CONTAINER_PATTERN.test(typeId)),
      ).toBe(false);
      expect(
        island.palette.some(
          (typeId) =>
            typeId.startsWith("skyknights:") || PROGRESSION_BLOCKS.has(typeId),
        ),
      ).toBe(false);
    }
  });
});
