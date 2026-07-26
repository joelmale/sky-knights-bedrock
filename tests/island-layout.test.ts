import { describe, expect, it } from "vitest";

import {
  EMBER_OUTPOST,
  FROSTSPIRE,
  IDENTIFIERS,
  REQUIRED_ISLANDS,
  STARTER_ISLAND,
} from "../scripts/config/constants";
import {
  ISLAND_DEFINITIONS,
  ISLAND_FAMILIES,
  ISLAND_FAMILY_IDS,
  ISLAND_STRUCTURE_IDS,
  LAYOUT,
  RANDOM_PURPOSES,
  boundsOverlap,
  createRandomStream,
  islandDefinition,
  isIslandGameplayReady,
  islandPlacement,
  islandRandomStream,
  laneObstructions,
  overlappingIslandPairs,
  planIslandLayout,
  segmentIntersectsBounds,
  tierHubIslandId,
} from "../scripts/config/islands";

const SEEDS = [0, 1, 7, 1234, 88888, 0x7fffffff, 0xdeadbeef];
const PINNED_ORIGINS = [
  { id: "starter_island", origin: { x: -12, y: 149, z: -10 } },
  { id: "ember_outpost", origin: { x: 72, y: 151, z: -10 } },
  { id: "frostspire", origin: { x: 240, y: 150, z: -11 } },
] as const;

describe("island registry", () => {
  it("is sorted by id and has unique ids", () => {
    const ids = ISLAND_DEFINITIONS.map((definition) => definition.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every content-matrix island", () => {
    expect(ISLAND_DEFINITIONS.map((definition) => definition.id)).toEqual([
      "aether_sanctum",
      "ashfall_crater",
      "ember_outpost",
      "frostspire",
      "glacier_vault",
      "starter_island",
      "sunspire_reach",
      "verdant_hollow",
    ]);
  });

  it("registers all four island families with distinct palettes", () => {
    expect(ISLAND_FAMILY_IDS).toEqual([
      "desert",
      "tundra",
      "verdant",
      "volcanic",
    ]);

    const surfaces = ISLAND_FAMILY_IDS.map(
      (id) => ISLAND_FAMILIES[id].palette.surface,
    );
    expect(new Set(surfaces).size).toBe(ISLAND_FAMILY_IDS.length);

    for (const id of ISLAND_FAMILY_IDS) {
      const family = ISLAND_FAMILIES[id];
      expect(family.id).toBe(id);
      expect(family.oreTableId).toMatch(/^skyknights:/);
      expect(family.structurePoolId).toMatch(/^skyknights:/);
      expect(family.encounterTableId).toMatch(/^skyknights:/);
      expect(family.minimumShipTier).toBeGreaterThanOrEqual(0);
    }
  });

  it("never asks for a ship tier above the island tier", () => {
    for (const definition of ISLAND_DEFINITIONS) {
      const family = ISLAND_FAMILIES[definition.family];
      expect(family.minimumShipTier).toBeLessThanOrEqual(definition.tier);
    }
  });

  it("namespaces every structure id", () => {
    for (const definition of ISLAND_DEFINITIONS) {
      expect(definition.structureId).toBe(
        ISLAND_STRUCTURE_IDS[
          definition.id as keyof typeof ISLAND_STRUCTURE_IDS
        ],
      );
      expect(definition.structureId).toMatch(/^skyknights:[a-z_]+$/);
    }
  });

  it("keeps shipped structure ids identical to the runtime identifiers", () => {
    expect(ISLAND_STRUCTURE_IDS.starter_island).toBe(IDENTIFIERS.starterIsland);
    expect(ISLAND_STRUCTURE_IDS.ember_outpost).toBe(IDENTIFIERS.emberOutpost);
    expect(ISLAND_STRUCTURE_IDS.frostspire).toBe(IDENTIFIERS.frostspire);
  });

  it("keeps new structures inert until their custom gameplay assets ship", () => {
    for (const definition of ISLAND_DEFINITIONS) {
      const expected = [
        "starter_island",
        "ember_outpost",
        "frostspire",
      ].includes(definition.id);
      expect(isIslandGameplayReady(definition)).toBe(expected);
    }
  });

  it("selects the lowest-id island of a tier as its hub", () => {
    expect(tierHubIslandId(0)).toBe("starter_island");
    expect(tierHubIslandId(1)).toBe("ember_outpost");
    expect(tierHubIslandId(2)).toBe("frostspire");
  });
});

describe("pinned migration safety", () => {
  it("keeps the three shipped origins, sizes, and content versions", () => {
    for (const island of REQUIRED_ISLANDS) {
      const definition = islandDefinition(island.id);
      expect(definition.placement).toBe("pinned");
      expect(definition.pinnedOrigin).toEqual(island.origin);
      expect(definition.size).toEqual(island.size);
      expect(definition.contentVersion).toBe(island.contentVersion);
      expect(definition.structureId).toBe(island.structureId);
      expect(definition.dimensionId).toBe(island.dimensionId);
    }
  });

  it("returns the exact hand-tuned origins for every seed", () => {
    for (const seed of SEEDS) {
      const layout = planIslandLayout(seed);

      for (const pinned of PINNED_ORIGINS) {
        expect(islandPlacement(layout, pinned.id).origin).toEqual(
          pinned.origin,
        );
      }
    }
  });

  it("keeps pinned origins stable when only the layout version moves", () => {
    const first = planIslandLayout(1234, 1);
    const second = planIslandLayout(1234, 99);

    for (const pinned of PINNED_ORIGINS) {
      expect(islandPlacement(second, pinned.id).origin).toEqual(
        islandPlacement(first, pinned.id).origin,
      );
    }

    expect(islandPlacement(second, "sunspire_reach").origin).not.toEqual(
      islandPlacement(first, "sunspire_reach").origin,
    );
  });

  it("reproduces the shipped integrity blocks from canonical geometry", () => {
    expect(islandDefinition("ember_outpost").integrityBlocks).toEqual(
      EMBER_OUTPOST.integrityBlocks,
    );
    expect(islandDefinition("frostspire").integrityBlocks).toEqual(
      FROSTSPIRE.integrityBlocks,
    );
    expect(islandDefinition("starter_island").integrityBlocks).toEqual(
      STARTER_ISLAND.integrityBlocks,
    );
  });

  it("reproduces the shipped world anchors", () => {
    const layout = planIslandLayout(1234);
    const starter = islandPlacement(layout, "starter_island");
    const ember = islandPlacement(layout, "ember_outpost");
    const frost = islandPlacement(layout, "frostspire");

    expect(starter.safeDock).toEqual(STARTER_ISLAND.safeDock);
    expect(ember.lootChest).toEqual(EMBER_OUTPOST.lootChest);
    expect(ember.encounterSpawn).toEqual({
      dimensionId: EMBER_OUTPOST.dimensionId,
      ...EMBER_OUTPOST.encounterSpawn,
    });
    expect(frost.lootChest).toEqual(FROSTSPIRE.lootChest);
    expect(frost.encounterSpawn).toEqual({
      dimensionId: FROSTSPIRE.dimensionId,
      ...FROSTSPIRE.encounterSpawn,
    });
  });
});

describe("seeded placement determinism", () => {
  it("produces an identical layout for a repeated seed", () => {
    expect(planIslandLayout(1234)).toEqual(planIslandLayout(1234));
  });

  it("pins the seeded origins for a fixed seed", () => {
    const layout = planIslandLayout(1234);
    const seededOrigins = layout.placements
      .filter((placement) => placement.placement === "seeded")
      .map((placement) => ({ id: placement.id, origin: placement.origin }));

    expect(seededOrigins).toEqual([
      { id: "aether_sanctum", origin: { x: 384, y: 159, z: 41 } },
      { id: "ashfall_crater", origin: { x: -118, y: 160, z: 355 } },
      { id: "glacier_vault", origin: { x: -202, y: 156, z: -387 } },
      { id: "sunspire_reach", origin: { x: -169, y: 156, z: 170 } },
      { id: "verdant_hollow", origin: { x: -36, y: 152, z: -165 } },
    ]);
  });

  it("moves seeded islands when the world seed changes", () => {
    const first = planIslandLayout(1234);
    const second = planIslandLayout(4321);
    const moved = first.placements.filter((placement) => {
      const other = islandPlacement(second, placement.id);
      return (
        placement.origin.x !== other.origin.x ||
        placement.origin.z !== other.origin.z
      );
    });

    expect(moved.map((placement) => placement.id)).toEqual([
      "aether_sanctum",
      "ashfall_crater",
      "glacier_vault",
      "sunspire_reach",
      "verdant_hollow",
    ]);
  });

  it("keeps every island inside its tier ring band", () => {
    for (const seed of SEEDS) {
      for (const placement of planIslandLayout(seed).placements) {
        if (placement.placement !== "seeded") {
          continue;
        }

        const ring = LAYOUT.tierRings[placement.tier];
        const chebyshev = Math.max(
          Math.abs(placement.center.x),
          Math.abs(placement.center.z),
        );
        expect(chebyshev).toBeGreaterThanOrEqual(ring.min);
        expect(chebyshev).toBeLessThanOrEqual(ring.max);
      }
    }
  });

  it("orders placements by id", () => {
    const ids = planIslandLayout(1234).placements.map(
      (placement) => placement.id,
    );
    expect(ids).toEqual([...ids].sort());
  });
});

describe("reserved bounds", () => {
  it("never overlaps for any tested seed", () => {
    for (const seed of SEEDS) {
      expect(overlappingIslandPairs(planIslandLayout(seed))).toEqual([]);
    }
  });

  it("reserves a valid realm for a wide sweep of seeds", () => {
    for (let seed = 0; seed < 512; seed += 1) {
      const layout = planIslandLayout(seed);
      expect(overlappingIslandPairs(layout)).toEqual([]);
      expect(laneObstructions(layout)).toEqual([]);
      expect(layout.placements).toHaveLength(ISLAND_DEFINITIONS.length);
    }
  });

  it("keeps a full padding corridor between neighbours", () => {
    const layout = planIslandLayout(1234);

    for (let left = 0; left < layout.placements.length; left += 1) {
      for (let right = left + 1; right < layout.placements.length; right += 1) {
        expect(
          boundsOverlap(
            layout.placements[left].bounds,
            layout.placements[right].reserved,
          ),
        ).toBe(false);
      }
    }
  });

  it("stays below the travel-lane cruising altitude", () => {
    for (const seed of SEEDS) {
      for (const placement of planIslandLayout(seed).placements) {
        expect(placement.reserved.to.y + LAYOUT.laneRadius).toBeLessThan(
          LAYOUT.laneCruiseY,
        );
      }
    }
  });
});

describe("travel lanes", () => {
  it("connects every island to the previous tier hub", () => {
    const layout = planIslandLayout(1234);
    const routes = layout.lanes.map(
      (lane) => `${lane.fromIslandId}->${lane.toIslandId}`,
    );

    expect(routes).toEqual([
      "frostspire->aether_sanctum",
      "frostspire->ashfall_crater",
      "starter_island->ember_outpost",
      "ember_outpost->frostspire",
      "frostspire->glacier_vault",
      "starter_island->sunspire_reach",
      "starter_island->verdant_hollow",
    ]);
    expect(layout.lanes.every((lane) => lane.points.length === 4)).toBe(true);
  });

  it("is clear of every reserved bound for any tested seed", () => {
    for (const seed of SEEDS) {
      expect(laneObstructions(planIslandLayout(seed))).toEqual([]);
    }
  });

  it("climbs and descends over its own dock columns only", () => {
    const layout = planIslandLayout(1234);

    for (const lane of layout.lanes) {
      const from = islandPlacement(layout, lane.fromIslandId);
      const to = islandPlacement(layout, lane.toIslandId);
      expect(lane.points[0]).toEqual({
        x: Math.round(from.safeDock.x),
        y: Math.round(from.safeDock.y),
        z: Math.round(from.safeDock.z),
      });
      expect(lane.points[1]).toEqual({
        x: lane.points[0].x,
        y: LAYOUT.laneCruiseY,
        z: lane.points[0].z,
      });
      expect(lane.points[2]).toEqual({
        x: lane.points[3].x,
        y: LAYOUT.laneCruiseY,
        z: lane.points[3].z,
      });
      expect(lane.points[3]).toEqual({
        x: Math.round(to.safeDock.x),
        y: Math.round(to.safeDock.y),
        z: Math.round(to.safeDock.z),
      });
    }
  });

  it("reports an obstruction when an island is dragged into a lane", () => {
    const layout = planIslandLayout(1234);
    const blocker = islandPlacement(layout, "verdant_hollow");
    const lane = layout.lanes.find(
      (candidate) => candidate.toIslandId === "sunspire_reach",
    );

    expect(lane).toBeDefined();
    const midpoint = {
      x: Math.round((lane!.points[1].x + lane!.points[2].x) / 2),
      y: LAYOUT.laneCruiseY,
      z: Math.round((lane!.points[1].z + lane!.points[2].z) / 2),
    };
    const obstructed = {
      ...layout,
      placements: layout.placements.map((placement) =>
        placement.id === blocker.id
          ? {
              ...placement,
              reserved: {
                from: {
                  x: midpoint.x - 4,
                  y: midpoint.y - 4,
                  z: midpoint.z - 4,
                },
                to: { x: midpoint.x + 4, y: midpoint.y + 4, z: midpoint.z + 4 },
              },
            }
          : placement,
      ),
    };

    expect(laneObstructions(obstructed)).toContain(
      "starter_island->sunspire_reach segment 1 clips verdant_hollow",
    );
  });
});

describe("segmentIntersectsBounds", () => {
  const bounds = {
    from: { x: 0, y: 0, z: 0 },
    to: { x: 10, y: 10, z: 10 },
  };

  it("detects a segment that passes through", () => {
    expect(
      segmentIntersectsBounds(
        { x: -5, y: 5, z: 5 },
        { x: 15, y: 5, z: 5 },
        bounds,
      ),
    ).toBe(true);
  });

  it("rejects a segment that stops short", () => {
    expect(
      segmentIntersectsBounds(
        { x: -20, y: 5, z: 5 },
        { x: -11, y: 5, z: 5 },
        bounds,
      ),
    ).toBe(false);
  });

  it("rejects an axis-aligned segment outside a slab", () => {
    expect(
      segmentIntersectsBounds(
        { x: 5, y: 50, z: 5 },
        { x: 5, y: 60, z: 5 },
        bounds,
      ),
    ).toBe(false);
  });

  it("accepts a fully contained segment", () => {
    expect(
      segmentIntersectsBounds(
        { x: 1, y: 1, z: 1 },
        { x: 2, y: 2, z: 2 },
        bounds,
      ),
    ).toBe(true);
  });
});

describe("random streams", () => {
  it("is reproducible for the same key", () => {
    const draw = (): number[] => {
      const stream = createRandomStream(["skyknights", 7, "layout"]);
      return [stream.nextUint32(), stream.nextUint32(), stream.nextUint32()];
    };

    expect(draw()).toEqual(draw());
  });

  it("separates streams by purpose", () => {
    const sequences = RANDOM_PURPOSES.map((purpose) => {
      const stream = islandRandomStream(1234, 1, "glacier_vault", purpose);
      return `${stream.nextUint32()}:${stream.nextUint32()}`;
    });

    expect(new Set(sequences).size).toBe(RANDOM_PURPOSES.length);
  });

  it("separates streams by island and seed", () => {
    const first = islandRandomStream(1234, 1, "glacier_vault", "ore");
    const second = islandRandomStream(1234, 1, "ashfall_crater", "ore");
    const third = islandRandomStream(4321, 1, "glacier_vault", "ore");

    expect(first.nextUint32()).not.toBe(second.nextUint32());
    expect(
      islandRandomStream(1234, 1, "glacier_vault", "ore").nextUint32(),
    ).not.toBe(third.nextUint32());
  });

  it("keeps nextInt inside its half-open range", () => {
    const stream = islandRandomStream(1234, 1, "sunspire_reach", "loot");

    for (let index = 0; index < 512; index += 1) {
      const value = stream.nextInt(3, 9);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThan(9);
    }
  });

  it("returns the lower bound for an empty range", () => {
    const stream = createRandomStream(["empty"]);
    expect(stream.nextInt(5, 5)).toBe(5);
  });
});
