import { describe, expect, it } from "vitest";

import {
  ALTITUDE_BANDS,
  ARCHIPELAGO_CONFIG,
  ARCHIPELAGO_STRUCTURE_IDS,
  ARCHIPELAGO_TEMPLATES,
  archipelagoAltitude,
  archipelagoClusters,
  archipelagoContinentAnchors,
  archipelagoIslandsWithinRadius,
  bandFor,
  deriveArchipelagoIsland,
  parseArchipelagoIslandId,
  planArchipelago,
} from "../scripts/generation/archipelago";
import type { ArchipelagoIsland } from "../scripts/generation/archipelago";
// @ts-expect-error Structure tooling modules are plain JavaScript.
import { zyxIndex } from "../tools/structures/nbt.mjs";

function isSoloIsland(
  island: ArchipelagoIsland,
): island is ArchipelagoIsland & {
  tier: "islet" | "standard" | "crag" | "landmark";
} {
  return island.tier !== "continent";
}

interface StructureModule {
  island: {
    size: readonly [number, number, number];
    palette: readonly string[];
    integrityBlocks: readonly {
      offset: { x: number; y: number; z: number };
      typeId: string;
    }[];
    inspect(): { indices: readonly number[] };
  };
}

const MODULE_TEMPLATE_KEYS = [
  "islet_verdant",
  "islet_desert",
  "islet_tundra",
  "islet_volcanic",
  "standard_verdant",
  "standard_desert",
  "standard_tundra",
  "standard_volcanic",
  "crag_verdant",
  "crag_desert",
  "crag_tundra",
  "crag_volcanic",
  "crag_volcanic_ember",
  "landmark_verdant",
  "landmark_desert",
  "landmark_tundra",
  "landmark_volcanic",
  "landmark_volcanic_ember",
  "landmark_volcanic_pyre",
  "comp_coast",
  "comp_plain",
  "comp_lake",
  "comp_ridge",
  "comp_chasm",
  "comp_bridge",
  "duo_mesa",
] as const;

function moduleFileForTemplateKey(templateKey: string): string {
  return templateKey.startsWith("standard_")
    ? `ambient_${templateKey.slice("standard_".length)}`
    : templateKey;
}

async function exportedIntegrityBlocks(
  templateKey: string,
): Promise<StructureModule["island"]["integrityBlocks"]> {
  return (await structureModule(templateKey)).island.integrityBlocks;
}

async function structureModule(templateKey: string): Promise<StructureModule> {
  return (await import(
    `../tools/structures/${moduleFileForTemplateKey(templateKey)}.mjs`
  )) as StructureModule;
}

function expectedRotatedOffset(
  offset: { x: number; y: number; z: number },
  rotation: "None" | "Rotate90" | "Rotate180" | "Rotate270",
): { x: number; y: number; z: number } {
  if (rotation === "Rotate90") {
    return { x: 29 - offset.z, y: offset.y, z: offset.x };
  }
  if (rotation === "Rotate180") {
    return { x: 29 - offset.x, y: offset.y, z: 29 - offset.z };
  }
  if (rotation === "Rotate270") {
    return { x: offset.z, y: offset.y, z: 29 - offset.x };
  }
  return offset;
}

describe("archipelago planner", () => {
  const seed = 12345;
  const version = ARCHIPELAGO_CONFIG.idVersion;
  const plan = planArchipelago(seed, version);

  it("is deterministic, sorted, bounded, seed-separated, and migrates to a2 IDs", () => {
    expect(planArchipelago(seed, version)).toEqual(plan);
    expect(planArchipelago(seed + 1, version)).not.toEqual(plan);
    expect(plan.length).toBeGreaterThan(850);
    expect(plan.length).toBeLessThan(1200);
    expect(plan.map((island) => island.id)).toEqual(
      [...plan.map((island) => island.id)].sort(),
    );

    for (const island of plan) {
      expect(island.id.startsWith("a2_")).toBe(true);
      expect(Math.abs(island.cellX)).toBeLessThanOrEqual(
        ARCHIPELAGO_CONFIG.maxCellRadius,
      );
      expect(Math.abs(island.cellZ)).toBeLessThanOrEqual(
        ARCHIPELAGO_CONFIG.maxCellRadius,
      );
      expect(island.y).toBeGreaterThanOrEqual(ARCHIPELAGO_CONFIG.absoluteMinY);
      expect(island.y + island.size.y - 1).toBeLessThanOrEqual(
        ARCHIPELAGO_CONFIG.absoluteMaxTopY,
      );
    }

    expect(parseArchipelagoIslandId(seed, version, "a1_n0_p5")).toBeUndefined();
  });

  it("rolls all four solo tiers into weighted altitude bands with ridge jitter", () => {
    const solos = plan.filter(isSoloIsland);

    expect(new Set(solos.map((island) => island.tier))).toEqual(
      new Set(["islet", "standard", "crag", "landmark"]),
    );

    for (const island of solos) {
      const band = bandFor(
        seed,
        version,
        island.cellX,
        island.cellZ,
        island.tier,
      );
      const ceiling = Math.min(
        band.maxY,
        ARCHIPELAGO_CONFIG.absoluteMaxTopY - island.size.y + 1,
      );

      expect(island.y).toBeGreaterThanOrEqual(band.minY);
      expect(island.y).toBeLessThanOrEqual(ceiling);
      expect(
        archipelagoAltitude(
          seed,
          version,
          island.cellX,
          island.cellZ,
          island.tier,
          island.size.y,
        ),
      ).toBe(island.y);
    }

    expect(ALTITUDE_BANDS.map((band) => band.id)).toEqual([
      "deep",
      "low",
      "mid",
      "high",
      "crown",
    ]);
  });

  it("assigns solo islands to their nearest deterministic biome cluster", () => {
    const clusters = archipelagoClusters(seed, version);

    expect(clusters.map((cluster) => cluster.family)).toEqual([
      "verdant",
      "desert",
      "tundra",
      "volcanic",
    ]);

    for (const island of plan.filter(isSoloIsland)) {
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

  it("resolves stable per-tier templates, mutually exclusive burn variants, and mesa landmarks", () => {
    const solos = plan.filter(isSoloIsland);

    for (const island of solos) {
      expect(island.template.structureId).toBeTruthy();
      expect(island.template.size).toEqual(island.size);
      expect(island.template.integrityBlocks.length).toBeGreaterThan(0);
      expect(island.radius).toBe(island.template.radius);
      expect(island.heightRadius).toBe(island.template.heightRadius);
      expect(island.observerClearance).toBeGreaterThanOrEqual(48);

      if (island.variant === "ember" || island.variant === "pyre") {
        expect(island.family).toBe("volcanic");
        expect(["crag", "landmark"]).toContain(island.tier);
      }
      if (island.variant === "pyre") {
        expect(island.tier).toBe("landmark");
      }
      if (island.variant === "mesa") {
        expect(island.tier).toBe("landmark");
        expect(island.template.structureId).toBe("skyknights:duo_mesa");
        expect(island.radius).toBe(28);
        expect(island.heightRadius).toBe(24);
      }
    }
  });

  it("matches every planner integrity probe to its emitting structure module", async () => {
    for (const templateKey of MODULE_TEMPLATE_KEYS) {
      expect(ARCHIPELAGO_TEMPLATES[templateKey].integrityBlocks).toEqual(
        await exportedIntegrityBlocks(templateKey),
      );
    }
  });

  it("keeps every template safe dock on solid footing with two clear blocks", async () => {
    const unsafeFooting = new Set([
      "minecraft:air",
      "minecraft:water",
      "minecraft:lava",
      "minecraft:fire",
      "minecraft:oak_leaves",
      "minecraft:spruce_leaves",
    ]);

    for (const templateKey of MODULE_TEMPLATE_KEYS) {
      const template = ARCHIPELAGO_TEMPLATES[templateKey];
      const structure = (await structureModule(templateKey)).island;
      const [sizeX, sizeY, sizeZ] = structure.size;
      const { x, y, z } = template.safeDock;
      const indices = structure.inspect().indices;
      const typeAt = (targetY: number): string | undefined => {
        const index = indices[zyxIndex(structure.size, x, targetY, z)];
        return index === undefined || index < 0
          ? undefined
          : structure.palette[index];
      };

      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(sizeX);
      expect(y).toBeGreaterThan(0);
      expect(y + 1).toBeLessThan(sizeY);
      expect(z).toBeGreaterThanOrEqual(0);
      expect(z).toBeLessThan(sizeZ);
      expect(unsafeFooting.has(typeAt(y - 1) ?? "minecraft:air")).toBe(false);
      expect([undefined, "minecraft:air"]).toContain(typeAt(y));
      expect([undefined, "minecraft:air"]).toContain(typeAt(y + 1));
    }

    expect(ARCHIPELAGO_TEMPLATES.continent.safeDock).toEqual({
      x: 75,
      y: ARCHIPELAGO_TEMPLATES.comp_ridge.safeDock.y,
      z: 82,
    });
  });

  it("keeps burn gates rare and mutually exclusive across the complete plan", () => {
    const eternal = plan.filter((island) => island.variant === "ember");
    const reactive = plan.filter((island) => island.variant === "pyre");

    expect(eternal.length).toBeGreaterThanOrEqual(3);
    expect(eternal.length).toBeLessThanOrEqual(12);
    expect(reactive.length).toBeLessThanOrEqual(8);
    expect(eternal.length + reactive.length).toBeLessThan(plan.length * 0.02);
    expect(
      plan.some(
        (island) =>
          island.tier === "continent" &&
          (island.variant === "ember" || island.variant === "pyre"),
      ),
    ).toBe(false);
  });

  it("places exactly six jittered continents with 21 deterministic, complete parts", () => {
    const anchors = archipelagoContinentAnchors(seed, version);
    const continents = plan.filter((island) => island.tier === "continent");

    expect(anchors).toHaveLength(ARCHIPELAGO_CONFIG.continentSiteCount);
    expect(continents).toHaveLength(ARCHIPELAGO_CONFIG.continentSiteCount);

    for (const continent of continents) {
      expect(continent.family).toBe("continent");
      expect(continent.y).toBeGreaterThanOrEqual(96);
      expect(continent.y).toBeLessThanOrEqual(128);
      expect(continent.parts).toHaveLength(21);
      expect(continent.observerClearance).toBe(137);
      expect(continent.parts?.map((part) => part.row)).toEqual([
        0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4,
      ]);
      expect(
        continent.parts?.every(
          (part) =>
            ARCHIPELAGO_STRUCTURE_IDS.includes(part.structureId) &&
            part.integrityBlock.typeId === "minecraft:stone",
        ),
      ).toBe(true);
      for (const part of continent.parts ?? []) {
        expect(part.sourceIntegrityBlock).toEqual(
          ARCHIPELAGO_TEMPLATES[part.structureId.replace("skyknights:", "")]
            .integrityBlocks[0],
        );
        expect(part.integrityBlock).toMatchObject({
          offset: expectedRotatedOffset(
            part.sourceIntegrityBlock.offset,
            part.rotation,
          ),
          typeId: part.sourceIntegrityBlock.typeId,
        });
      }

      const structureIds =
        continent.parts?.map((part) => part.structureId) ?? [];
      expect(
        structureIds.filter((id) => id === "skyknights:comp_lake"),
      ).toHaveLength(2);
      expect(structureIds).toContain("skyknights:comp_chasm");
      expect(structureIds).toContain("skyknights:comp_bridge");
      expect(structureIds).toContain("skyknights:comp_ridge");
      expect(
        structureIds.filter((id) => id === "skyknights:comp_coast"),
      ).toHaveLength(12);
    }
  });

  it("suppresses the 5x5 ambient zone around every continent anchor", () => {
    for (const anchor of archipelagoContinentAnchors(seed, version)) {
      for (
        let cellX = anchor.cellX - 2;
        cellX <= anchor.cellX + 2;
        cellX += 1
      ) {
        for (
          let cellZ = anchor.cellZ - 2;
          cellZ <= anchor.cellZ + 2;
          cellZ += 1
        ) {
          const island = deriveArchipelagoIsland(seed, version, cellX, cellZ);
          if (cellX === anchor.cellX && cellZ === anchor.cellZ) {
            expect(island?.tier).toBe("continent");
          } else {
            expect(island).toBeUndefined();
          }
        }
      }
    }
  });

  it("keeps every planned clearance cylinder non-intersecting", () => {
    for (let left = 0; left < plan.length; left += 1) {
      for (let right = left + 1; right < plan.length; right += 1) {
        const island = plan[left];
        const other = plan[right];
        const dx = island.x - other.x;
        const dz = island.z - other.z;
        const horizontalClear =
          dx * dx + dz * dz >=
          (island.radius + other.radius + ARCHIPELAGO_CONFIG.minEdgeGap) ** 2;
        const verticalClear =
          Math.abs(
            island.y +
              Math.floor(island.size.y / 2) -
              (other.y + Math.floor(other.size.y / 2)),
          ) >=
          island.heightRadius +
            other.heightRadius +
            ARCHIPELAGO_CONFIG.minEdgeGap;

        expect(horizontalClear || verticalClear).toBe(true);
      }
    }
  }, 15_000);

  it("round-trips compact IDs and supports bounded lazy radius queries", () => {
    const island = plan.find((entry) => entry.tier !== "continent")!;

    expect(parseArchipelagoIslandId(seed, version, island.id)).toEqual(island);
    expect(parseArchipelagoIslandId(seed, version, "bad")).toBeUndefined();
    expect(
      parseArchipelagoIslandId(seed, version, "a2_p05_p5"),
    ).toBeUndefined();
    expect(
      parseArchipelagoIslandId(seed, version, "a2_p999_p999"),
    ).toBeUndefined();
    expect(
      deriveArchipelagoIsland(seed, version, island.cellX, island.cellZ),
    ).toEqual(island);
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
