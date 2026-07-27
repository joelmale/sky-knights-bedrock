// Home island: dock, workshop clearing, and the wood/stone/iron starter loop.
//
// Hand-tuned before the seeded layout registry existed. Its body parameters and
// its +X dock deck deliberately break the canonical convention, so this module
// keeps explicit values rather than calling `canonicalIslandBody`.

import { structureBuffer } from "./nbt.mjs";
import {
  assertSolidBody,
  blockStamp,
  boxStamp,
  buildIslandIndices,
  dockPlatform,
  taperedEllipsoidBody,
} from "./shape.mjs";

const SIZE = [31, 16, 23];

const PALETTE = [
  "minecraft:stone",
  "minecraft:dirt",
  "minecraft:grass_block",
  "minecraft:oak_planks",
  "minecraft:coal_ore",
  "minecraft:iron_ore",
  "minecraft:oak_log",
  "minecraft:crafting_table",
  "minecraft:furnace",
  "minecraft:oak_leaves",
];

const BLOCK = {
  stone: 0,
  dirt: 1,
  grass: 2,
  planks: 3,
  coalOre: 4,
  ironOre: 5,
  log: 6,
  craftingTable: 7,
  furnace: 8,
  leaves: 9,
};

export const STARTER_RESOURCE_MINIMUMS = {
  "minecraft:oak_log": 8,
  "minecraft:stone": 16,
  "minecraft:coal_ore": 8,
  "minecraft:iron_ore": 12,
};

// The first iron and coal pairs form an adjacent surface prospect beside the
// workshop clearing. Each visible block has a second ore directly underneath,
// teaching the player where to dig without requiring a dangerous cliff search.
// The remaining seams stay on the island's exposed west/east and north/south
// faces. Twelve iron and eight coal provide a deliberate buffer above the first
// skiff's seven ingots, two recipe coal, and smelting fuel.
const STARTER_PROSPECTS = [
  { index: BLOCK.ironOre, x: 9, y: 11, z: 9 },
  { index: BLOCK.ironOre, x: 9, y: 10, z: 9 },
  { index: BLOCK.ironOre, x: 4, y: 7, z: 10 },
  { index: BLOCK.ironOre, x: 20, y: 7, z: 10 },
  { index: BLOCK.ironOre, x: 5, y: 6, z: 10 },
  { index: BLOCK.ironOre, x: 19, y: 6, z: 10 },
  { index: BLOCK.ironOre, x: 6, y: 5, z: 10 },
  { index: BLOCK.ironOre, x: 18, y: 5, z: 10 },
  { index: BLOCK.ironOre, x: 7, y: 4, z: 10 },
  { index: BLOCK.ironOre, x: 17, y: 4, z: 10 },
  { index: BLOCK.ironOre, x: 7, y: 3, z: 10 },
  { index: BLOCK.ironOre, x: 17, y: 3, z: 10 },
  { index: BLOCK.coalOre, x: 10, y: 11, z: 9 },
  { index: BLOCK.coalOre, x: 10, y: 10, z: 9 },
  { index: BLOCK.coalOre, x: 12, y: 7, z: 4 },
  { index: BLOCK.coalOre, x: 12, y: 7, z: 16 },
  { index: BLOCK.coalOre, x: 12, y: 6, z: 5 },
  { index: BLOCK.coalOre, x: 12, y: 6, z: 15 },
  { index: BLOCK.coalOre, x: 12, y: 5, z: 5 },
  { index: BLOCK.coalOre, x: 12, y: 5, z: 15 },
];

const BODY = taperedEllipsoidBody({
  centerX: 12,
  centerZ: 10,
  topY: 11,
  growthX: 8,
  growthZ: 7,
});

function buildIndices() {
  const indices = buildIslandIndices({
    size: SIZE,
    body: BODY,
    strata: {
      core: BLOCK.stone,
      subsurface: BLOCK.dirt,
      surface: BLOCK.grass,
    },
    stamps: [
      ...STARTER_PROSPECTS.map((prospect) => blockStamp(prospect)),
      blockStamp({ index: BLOCK.craftingTable, x: 12, y: 12, z: 7 }),
      blockStamp({ index: BLOCK.furnace, x: 13, y: 12, z: 7 }),
      ...dockPlatform({
        index: BLOCK.planks,
        y: 11,
        minX: 22,
        maxX: SIZE[0] - 1,
        minZ: 9,
        maxZ: 11,
        supports: { y: 10, minX: 23, maxX: 29, z: [9, 11] },
      }),
      boxStamp({
        index: BLOCK.leaves,
        minX: 5,
        maxX: 9,
        minY: 14,
        maxY: 14,
        minZ: 5,
        maxZ: 9,
      }),
      boxStamp({
        index: BLOCK.leaves,
        minX: 6,
        maxX: 8,
        minY: 15,
        maxY: 15,
        minZ: 6,
        maxZ: 8,
      }),
      boxStamp({
        index: BLOCK.leaves,
        minX: 15,
        maxX: 19,
        minY: 14,
        maxY: 14,
        minZ: 13,
        maxZ: 17,
      }),
      boxStamp({
        index: BLOCK.leaves,
        minX: 16,
        maxX: 18,
        minY: 15,
        maxY: 15,
        minZ: 14,
        maxZ: 16,
      }),
      ...[12, 13, 14, 15].flatMap((y) => [
        blockStamp({ index: BLOCK.log, x: 7, y, z: 7 }),
        blockStamp({ index: BLOCK.log, x: 17, y, z: 15 }),
      ]),
    ],
  });

  assertSolidBody({
    name: "Starter island",
    size: SIZE,
    body: BODY,
    indices,
  });

  assertStarterResourceMinimums(indices);
  return indices;
}

function build() {
  const indices = buildIndices();
  return structureBuffer(SIZE, PALETTE, indices);
}

function assertStarterResourceMinimums(indices) {
  for (const [typeId, minimum] of Object.entries(STARTER_RESOURCE_MINIMUMS)) {
    const paletteIndex = PALETTE.indexOf(typeId);
    const actual = indices.filter((index) => index === paletteIndex).length;

    if (actual < minimum) {
      throw new Error(
        `Starter island supplies ${actual} ${typeId}; expected at least ${minimum}.`,
      );
    }
  }
}

export const island = {
  id: "starter_island",
  family: "verdant",
  tier: 0,
  structureId: "skyknights:starter_island",
  outputPath: [
    "behavior_packs",
    "sk_bp",
    "structures",
    "skyknights",
    "starter_island.mcstructure",
  ],
  size: SIZE,
  palette: PALETTE,
  body: BODY,
  anchors: {
    safeDock: { x: 21.5, y: 12, z: 10.5 },
  },
  integrityBlocks: [
    { offset: { x: 12, y: 0, z: 10 }, typeId: "minecraft:stone" },
    { offset: { x: 1, y: 11, z: 10 }, typeId: "minecraft:grass_block" },
    { offset: { x: 23, y: 11, z: 10 }, typeId: "minecraft:oak_planks" },
    { offset: { x: 12, y: 11, z: 1 }, typeId: "minecraft:grass_block" },
    { offset: { x: 12, y: 11, z: 19 }, typeId: "minecraft:grass_block" },
    { offset: { x: 30, y: 11, z: 10 }, typeId: "minecraft:oak_planks" },
  ],
  inspect() {
    return {
      palette: [...PALETTE],
      indices: buildIndices(),
    };
  },
  build,
};
