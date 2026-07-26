// Second verdant island: renewable oak grove, wood hut with tier-1 chest, and
// a mossy hollow grotto with a coal seam (docs/CONTENT_MATRIX.md).
//
// Layout (local coordinates, size [27, 15, 23], centerX 13, centerZ 11,
// topY 10 — identical body geometry to Frostspire, which shares this size):
//   - Dock deck: x 0-4, z 10-12, y 10 (overhangs the low-X face, as required).
//   - Wood hut: x 9-17, z 7-13, y 11-13, plank roof at y 14, door on the north
//     wall (z 7). Tier-1 chest baked at the canonical center cell (13, 11, 11)
//     — guaranteed loot (1 Repair Kit, saplings) is script-placed into this
//     chest block, never baked here.
//   - Mossy hollow (the "soft hollow interior cave"): x 18-23, z 8-14,
//     y 11-13, mossy-cobblestone roof at y 14, entrance on the west wall
//     (x 18) facing the hut. Wall masonry is salted with visible coal ore, and
//     a real minable coal seam is also seeded underground (y 3-6) the same
//     way `starter_island.mjs` seeds its coal/iron pockets.
//   - Four oak trees (renewable grove) in the open corners around the hut and
//     hollow, each with a trunk + two-layer leaf canopy.
//   - Three standalone oak sapling blocks in open, reachable grass patches
//     near the grove (the structural half of "renewable oak grove ... plus
//     reachable saplings"; the guaranteed sapling item stack is script-placed
//     like the chest loot).
//   - Three ambient anchor points (not baked blocks — see
//     scripts/config/islands/verdant_hollow.ts
//     `VERDANT_HOLLOW_AMBIENT_ANCHORS`) for passive `skyknights:hedgehog`
//     spawns. No hostile encounter is prepared on this island.
//
// Every footprint below was checked against `canonicalIslandBody(SIZE)` so
// its corners land inside the topY ellipse (solid grass underfoot) and clear
// of the five integrity probes and the canonical `encounterSpawn` cell.

import { structureBuffer } from "./nbt.mjs";
import {
  assertSolidBody,
  blockStamp,
  boxStamp,
  buildIslandIndices,
  canonicalIslandBody,
  dockPlatform,
  orePocket,
  perimeterStamp,
} from "./shape.mjs";

const SIZE = [27, 15, 23];

const PALETTE = [
  "minecraft:stone", // 0 core
  "minecraft:dirt", // 1 subsurface
  "minecraft:grass_block", // 2 surface
  "minecraft:oak_planks", // 3 dock
  "minecraft:cobblestone", // 4 structure
  "minecraft:mossy_cobblestone", // 5 structure weathered
  "minecraft:chest", // 6 chest
  "minecraft:oak_log", // 7 accent
  "minecraft:oak_leaves", // 8 island specific: canopy
  "minecraft:coal_ore", // 9 island specific: coal seam
  "minecraft:oak_sapling", // 10 island specific: renewable sapling
];

const BLOCK = {
  core: 0,
  subsurface: 1,
  surface: 2,
  dock: 3,
  structure: 4,
  weathered: 5,
  chest: 6,
  accent: 7,
  leaves: 8,
  coalOre: 9,
  sapling: 10,
};

const BODY = canonicalIslandBody(SIZE);

const HUT = {
  minX: 9,
  maxX: 17,
  minY: BODY.topY + 1,
  maxY: BODY.topY + 3,
  minZ: 7,
  maxZ: 13,
};
const HOLLOW = {
  minX: 18,
  maxX: 23,
  minY: BODY.topY + 1,
  maxY: BODY.topY + 3,
  minZ: 8,
  maxZ: 14,
};

const CHEST_LOCATION = { x: BODY.centerX, y: BODY.topY + 1, z: BODY.centerZ };

const TREE_TRUNKS = [
  { x: 6, z: 4 },
  { x: 20, z: 4 },
  { x: 6, z: 18 },
  { x: 20, z: 18 },
];

const SAPLINGS = [
  { x: BODY.centerX, y: BODY.topY + 1, z: 4 },
  { x: BODY.centerX, y: BODY.topY + 1, z: 18 },
  { x: 2, y: BODY.topY + 1, z: 9 },
];

/** Trunk column plus a two-layer leaf canopy, center-relative to (tx, tz). */
function treeStamps(tx, tz) {
  const trunkTop = BODY.topY + 3;

  return [
    boxStamp({
      index: BLOCK.accent,
      minX: tx,
      maxX: tx,
      minY: BODY.topY + 1,
      maxY: trunkTop,
      minZ: tz,
      maxZ: tz,
    }),
    boxStamp({
      index: BLOCK.leaves,
      minX: tx - 1,
      maxX: tx + 1,
      minY: trunkTop,
      maxY: trunkTop,
      minZ: tz - 1,
      maxZ: tz + 1,
      filter: (context) => !(context.x === tx && context.z === tz),
    }),
    boxStamp({
      index: BLOCK.leaves,
      minX: tx - 1,
      maxX: tx + 1,
      minY: trunkTop + 1,
      maxY: trunkTop + 1,
      minZ: tz - 1,
      maxZ: tz + 1,
    }),
  ];
}

function build() {
  const indices = buildIslandIndices({
    size: SIZE,
    body: BODY,
    strata: {
      core: BLOCK.core,
      subsurface: BLOCK.subsurface,
      surface: BLOCK.surface,
    },
    orePockets: [
      orePocket({
        index: BLOCK.coalOre,
        minY: 3,
        maxY: 6,
        offsets: [
          [-3, 1],
          [4, -2],
          [1, 4],
        ],
      }),
    ],
    stamps: [
      ...dockPlatform({
        index: BLOCK.dock,
        y: BODY.topY,
        minX: 0,
        maxX: 4,
        minZ: BODY.centerZ - 1,
        maxZ: BODY.centerZ + 1,
      }),
      // Wood hut: plank walls, log corner posts, plank roof, door facing north.
      perimeterStamp({
        index: ({ x, z }) =>
          (x === HUT.minX || x === HUT.maxX) &&
          (z === HUT.minZ || z === HUT.maxZ)
            ? BLOCK.accent
            : BLOCK.dock,
        minX: HUT.minX,
        maxX: HUT.maxX,
        minY: HUT.minY,
        maxY: HUT.maxY,
        minZ: HUT.minZ,
        maxZ: HUT.maxZ,
        opening: ({ x, z }) => z === HUT.minZ && x >= 12 && x <= 14,
      }),
      boxStamp({
        index: BLOCK.dock,
        minX: HUT.minX,
        maxX: HUT.maxX,
        minY: HUT.maxY + 1,
        maxY: HUT.maxY + 1,
        minZ: HUT.minZ,
        maxZ: HUT.maxZ,
      }),
      blockStamp({
        index: BLOCK.chest,
        x: CHEST_LOCATION.x,
        y: CHEST_LOCATION.y,
        z: CHEST_LOCATION.z,
      }),
      // Mossy hollow: cobblestone/mossy walls salted with visible coal ore,
      // mossy roof, entrance facing the hut.
      perimeterStamp({
        index: ({ x, y, z }) =>
          (x + y + z) % 5 === 0
            ? BLOCK.coalOre
            : (x + y + z) % 3 === 0
              ? BLOCK.weathered
              : BLOCK.structure,
        minX: HOLLOW.minX,
        maxX: HOLLOW.maxX,
        minY: HOLLOW.minY,
        maxY: HOLLOW.maxY,
        minZ: HOLLOW.minZ,
        maxZ: HOLLOW.maxZ,
        opening: ({ x, z }) => x === HOLLOW.minX && z >= 10 && z <= 12,
      }),
      boxStamp({
        index: BLOCK.weathered,
        minX: HOLLOW.minX,
        maxX: HOLLOW.maxX,
        minY: HOLLOW.maxY + 1,
        maxY: HOLLOW.maxY + 1,
        minZ: HOLLOW.minZ,
        maxZ: HOLLOW.maxZ,
      }),
      ...TREE_TRUNKS.flatMap(({ x, z }) => treeStamps(x, z)),
      ...SAPLINGS.map(({ x, y, z }) =>
        blockStamp({ index: BLOCK.sapling, x, y, z }),
      ),
    ],
  });

  assertSolidBody({ name: "Verdant Hollow", size: SIZE, body: BODY, indices });

  return structureBuffer(SIZE, PALETTE, indices);
}

export const island = {
  id: "verdant_hollow",
  family: "verdant",
  tier: 1,
  structureId: "skyknights:verdant_hollow",
  outputPath: [
    "behavior_packs",
    "sk_bp",
    "structures",
    "skyknights",
    "verdant_hollow.mcstructure",
  ],
  size: SIZE,
  palette: PALETTE,
  body: BODY,
  anchors: {
    safeDock: { x: 2.5, y: BODY.topY + 1, z: BODY.centerZ + 0.5 },
    lootChest: { x: BODY.centerX, y: BODY.topY + 1, z: BODY.centerZ },
    encounterSpawn: {
      x: BODY.centerX + 0.5,
      y: BODY.topY + 1,
      z: BODY.centerZ + 4.5,
    },
  },
  integrityBlocks: [
    {
      offset: { x: BODY.centerX, y: 0, z: BODY.centerZ },
      typeId: PALETTE[BLOCK.core],
    },
    {
      offset: { x: 0, y: BODY.topY, z: BODY.centerZ },
      typeId: PALETTE[BLOCK.dock],
    },
    {
      offset: { x: SIZE[0] - 2, y: BODY.topY, z: BODY.centerZ },
      typeId: PALETTE[BLOCK.surface],
    },
    {
      offset: { x: BODY.centerX, y: BODY.topY, z: 1 },
      typeId: PALETTE[BLOCK.surface],
    },
    {
      offset: { x: BODY.centerX, y: BODY.topY, z: SIZE[2] - 2 },
      typeId: PALETTE[BLOCK.surface],
    },
  ],
  build,
};
