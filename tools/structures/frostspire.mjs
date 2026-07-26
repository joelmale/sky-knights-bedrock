// Range-gated raid island: tundra body, frost tower, warden anchor.

import { structureBuffer } from "./nbt.mjs";
import {
  assertSolidBody,
  blockStamp,
  buildIslandIndices,
  canonicalIslandBody,
  dockPlatform,
  perimeterStamp,
  scatterStamp,
} from "./shape.mjs";

const SIZE = [27, 15, 23];

const PALETTE = [
  "minecraft:stone",
  "minecraft:packed_ice",
  "minecraft:snow_block",
  "minecraft:spruce_planks",
  "minecraft:stone_bricks",
  "minecraft:chest",
  "minecraft:blue_ice",
];

const BLOCK = {
  stone: 0,
  packedIce: 1,
  snow: 2,
  dock: 3,
  bricks: 4,
  chest: 5,
  blueIce: 6,
};

const BODY = canonicalIslandBody(SIZE);

function build() {
  const indices = buildIslandIndices({
    size: SIZE,
    body: BODY,
    strata: {
      core: BLOCK.stone,
      subsurface: BLOCK.packedIce,
      surface: BLOCK.snow,
    },
    stamps: [
      ...dockPlatform({
        index: BLOCK.dock,
        y: BODY.topY,
        minX: 0,
        maxX: 4,
        minZ: 10,
        maxZ: 12,
      }),
      perimeterStamp({
        index: ({ x, y, z }) =>
          (x + y + z) % 5 === 0 ? BLOCK.blueIce : BLOCK.bricks,
        minX: 9,
        maxX: 17,
        minY: 11,
        maxY: 13,
        minZ: 7,
        maxZ: 15,
        opening: ({ x, z }) => z === 7 && x >= 12 && x <= 14,
      }),
      blockStamp({ index: BLOCK.chest, x: 13, y: 11, z: 11 }),
      scatterStamp({
        index: BLOCK.blueIce,
        y: BODY.topY,
        offsets: [
          [-6, 4],
          [6, -4],
          [3, 7],
        ],
      }),
    ],
  });

  assertSolidBody({
    name: "Frostspire",
    size: SIZE,
    body: BODY,
    indices,
  });

  return structureBuffer(SIZE, PALETTE, indices);
}

export const island = {
  id: "frostspire",
  family: "tundra",
  tier: 2,
  structureId: "skyknights:frostspire",
  outputPath: [
    "behavior_packs",
    "sk_bp",
    "structures",
    "skyknights",
    "frostspire.mcstructure",
  ],
  size: SIZE,
  palette: PALETTE,
  body: BODY,
  anchors: {
    safeDock: { x: 2.5, y: 11, z: 11.5 },
    lootChest: { x: 13, y: 11, z: 11 },
    encounterSpawn: { x: 13.5, y: 11, z: 15.5 },
  },
  integrityBlocks: [
    { offset: { x: 13, y: 0, z: 11 }, typeId: "minecraft:stone" },
    { offset: { x: 0, y: 10, z: 11 }, typeId: "minecraft:spruce_planks" },
    { offset: { x: 25, y: 10, z: 11 }, typeId: "minecraft:snow_block" },
    { offset: { x: 13, y: 10, z: 1 }, typeId: "minecraft:snow_block" },
    { offset: { x: 13, y: 10, z: 21 }, typeId: "minecraft:snow_block" },
  ],
  build,
};
