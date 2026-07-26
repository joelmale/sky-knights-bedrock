// First expedition target: volcanic body, small ruin, guardian anchor.

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

const SIZE = [25, 14, 21];

const PALETTE = [
  "minecraft:blackstone",
  "minecraft:netherrack",
  "minecraft:basalt",
  "minecraft:polished_blackstone_bricks",
  "minecraft:stone_bricks",
  "minecraft:cracked_stone_bricks",
  "minecraft:chest",
  "minecraft:magma",
];

const BLOCK = {
  blackstone: 0,
  netherrack: 1,
  basalt: 2,
  dock: 3,
  bricks: 4,
  crackedBricks: 5,
  chest: 6,
  magma: 7,
};

const BODY = canonicalIslandBody(SIZE);

function build() {
  const indices = buildIslandIndices({
    size: SIZE,
    body: BODY,
    strata: {
      core: BLOCK.blackstone,
      subsurface: BLOCK.basalt,
      surface: BLOCK.netherrack,
    },
    stamps: [
      ...dockPlatform({
        index: BLOCK.dock,
        y: BODY.topY,
        minX: 0,
        maxX: 4,
        minZ: 9,
        maxZ: 11,
      }),
      perimeterStamp({
        index: ({ x, y, z }) =>
          (x + y + z) % 4 === 0 ? BLOCK.crackedBricks : BLOCK.bricks,
        minX: 8,
        maxX: 16,
        minY: 10,
        maxY: 12,
        minZ: 6,
        maxZ: 14,
        opening: ({ x, z }) => (z === 6 || z === 14) && x >= 11 && x <= 13,
      }),
      blockStamp({ index: BLOCK.chest, x: 12, y: 10, z: 10 }),
      scatterStamp({
        index: BLOCK.magma,
        y: BODY.topY,
        offsets: [
          [-5, 3],
          [5, -3],
          [2, 6],
        ],
      }),
    ],
  });

  assertSolidBody({
    name: "Ember Outpost",
    size: SIZE,
    body: BODY,
    indices,
  });

  return structureBuffer(SIZE, PALETTE, indices);
}

export const island = {
  id: "ember_outpost",
  family: "volcanic",
  tier: 1,
  structureId: "skyknights:ember_outpost",
  outputPath: [
    "behavior_packs",
    "sk_bp",
    "structures",
    "skyknights",
    "ember_outpost.mcstructure",
  ],
  size: SIZE,
  palette: PALETTE,
  body: BODY,
  anchors: {
    safeDock: { x: 2.5, y: 10, z: 10.5 },
    lootChest: { x: 12, y: 10, z: 10 },
    encounterSpawn: { x: 12.5, y: 10, z: 14.5 },
  },
  integrityBlocks: [
    { offset: { x: 12, y: 0, z: 10 }, typeId: "minecraft:blackstone" },
    {
      offset: { x: 0, y: 9, z: 10 },
      typeId: "minecraft:polished_blackstone_bricks",
    },
    { offset: { x: 23, y: 9, z: 10 }, typeId: "minecraft:netherrack" },
    { offset: { x: 12, y: 9, z: 1 }, typeId: "minecraft:netherrack" },
    { offset: { x: 12, y: 9, z: 19 }, typeId: "minecraft:netherrack" },
  ],
  build,
};
