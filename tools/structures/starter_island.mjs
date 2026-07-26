// Home island: dock, workshop clearing, and the wood/stone/iron starter loop.
//
// Hand-tuned before the seeded layout registry existed. Its body parameters and
// its +X dock deck deliberately break the canonical convention, so this module
// keeps explicit values rather than calling `canonicalIslandBody`.

import { structureBuffer } from "./nbt.mjs";
import {
  assertSolidBody,
  buildIslandIndices,
  canopyStamp,
  dockPlatform,
  orePocket,
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
];

const BLOCK = {
  stone: 0,
  dirt: 1,
  grass: 2,
  planks: 3,
  coalOre: 4,
  ironOre: 5,
  log: 6,
};

const BODY = taperedEllipsoidBody({
  centerX: 12,
  centerZ: 10,
  topY: 11,
  growthX: 8,
  growthZ: 7,
});

function build() {
  const indices = buildIslandIndices({
    size: SIZE,
    body: BODY,
    strata: {
      core: BLOCK.stone,
      subsurface: BLOCK.dirt,
      surface: BLOCK.grass,
    },
    orePockets: [
      orePocket({
        index: BLOCK.coalOre,
        minY: 4,
        maxY: 7,
        offsets: [
          [-3, 1],
          [4, -2],
          [1, 4],
        ],
      }),
      orePocket({
        index: BLOCK.ironOre,
        minY: 3,
        maxY: 6,
        offsets: [
          [-1, -3],
          [3, 2],
        ],
      }),
    ],
    stamps: [
      ...dockPlatform({
        index: BLOCK.planks,
        y: 11,
        minX: 22,
        maxX: SIZE[0] - 1,
        minZ: 9,
        maxZ: 11,
        supports: { y: 10, minX: 23, maxX: 29, z: [9, 11] },
      }),
      canopyStamp({
        index: BLOCK.log,
        y: 12,
        minX: 6,
        maxX: 9,
        minZ: 6,
        maxZ: 8,
      }),
    ],
  });

  assertSolidBody({
    name: "Starter island",
    size: SIZE,
    body: BODY,
    indices,
  });

  return structureBuffer(SIZE, PALETTE, indices);
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
    { offset: { x: 23, y: 11, z: 10 }, typeId: "minecraft:grass_block" },
    { offset: { x: 12, y: 11, z: 1 }, typeId: "minecraft:grass_block" },
    { offset: { x: 12, y: 11, z: 19 }, typeId: "minecraft:grass_block" },
    { offset: { x: 30, y: 11, z: 10 }, typeId: "minecraft:oak_planks" },
  ],
  build,
};
