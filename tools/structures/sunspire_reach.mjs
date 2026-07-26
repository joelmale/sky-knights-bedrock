// Desert family debut island: sandstone body, exposed gold/copper ore, a wood
// hut with a tier-1 loot chest, a sandstone dock.

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
  scatterStamp,
} from "./shape.mjs";

const SIZE = [29, 16, 25];

const PALETTE = [
  "minecraft:sandstone",
  "minecraft:sand",
  "minecraft:red_sand",
  "minecraft:cut_sandstone",
  "minecraft:chiseled_sandstone",
  "minecraft:smooth_sandstone",
  "minecraft:chest",
  "minecraft:terracotta",
  "minecraft:acacia_planks",
  "minecraft:acacia_log",
  "minecraft:gold_ore",
  "minecraft:copper_ore",
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
  hutWall: 8,
  hutPost: 9,
  goldOre: 10,
  copperOre: 11,
};

const BODY = canonicalIslandBody(SIZE);

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
        index: BLOCK.goldOre,
        minY: 5,
        maxY: 8,
        offsets: [
          [-4, 2],
          [5, -2],
          [1, 5],
        ],
      }),
      orePocket({
        index: BLOCK.copperOre,
        minY: 4,
        maxY: 7,
        offsets: [
          [-2, -4],
          [4, 3],
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
      boxStamp({
        index: ({ x, z }) =>
          (x + z) % 2 === 0 ? BLOCK.structure : BLOCK.weathered,
        minX: BODY.centerX - 3,
        maxX: BODY.centerX + 3,
        minY: BODY.topY,
        minZ: BODY.centerZ - 3,
        maxZ: BODY.centerZ + 3,
      }),
      perimeterStamp({
        index: ({ x, y, z }) =>
          (x + y + z) % 4 === 0 ? BLOCK.hutPost : BLOCK.hutWall,
        minX: BODY.centerX - 4,
        maxX: BODY.centerX + 4,
        minY: BODY.topY + 1,
        maxY: BODY.topY + 3,
        minZ: BODY.centerZ - 4,
        maxZ: BODY.centerZ + 4,
        opening: ({ x, z }) =>
          (z === BODY.centerZ - 4 || z === BODY.centerZ + 4) &&
          x >= BODY.centerX - 1 &&
          x <= BODY.centerX + 1,
      }),
      blockStamp({
        index: BLOCK.chest,
        x: BODY.centerX,
        y: BODY.topY + 1,
        z: BODY.centerZ,
      }),
      scatterStamp({
        index: BLOCK.accent,
        y: BODY.topY,
        offsets: [
          [-6, 3],
          [6, -3],
          [3, 6],
        ],
      }),
    ],
  });

  assertSolidBody({ name: "Sunspire Reach", size: SIZE, body: BODY, indices });

  return structureBuffer(SIZE, PALETTE, indices);
}

export const island = {
  id: "sunspire_reach",
  family: "desert",
  tier: 1,
  structureId: "skyknights:sunspire_reach",
  outputPath: [
    "behavior_packs",
    "sk_bp",
    "structures",
    "skyknights",
    "sunspire_reach.mcstructure",
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
