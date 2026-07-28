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

// Exactly what the command-free first-skiff route consumes, counted as blocks
// the player has to mine rather than as crafted items:
//
//   iron  — 4 for the Ship Core plus 3 for the Thruster Module;
//   coal  — 1 for the Ship Core, 1 for the Thruster Module, 1 smelting fuel;
//   stone — 3 cobblestone for the stone pickaxe plus 1 for the Thruster Module;
//   wood  — 19 planks (6 Canvas Bundle, 4 crafting table, 5 wooden pickaxe,
//           2 stone pickaxe, 2 stick stock) at four planks per log.
export const STARTER_RESOURCE_REQUIREMENTS = {
  "minecraft:oak_log": 5,
  "minecraft:stone": 4,
  "minecraft:coal_ore": 3,
  "minecraft:iron_ore": 7,
};

// A first-time player will not mine a resource they never found, so every
// requirement above carries the same margin instead of a hand-picked buffer.
// The 0.3.5 playtest ran out of iron with a 1.7x buffer whose surplus sat on
// the island's underside, which is unreachable before the ship that surplus
// pays for.
export const STARTER_RESOURCE_MARGIN = 2.5;

export const STARTER_RESOURCE_MINIMUMS = Object.fromEntries(
  Object.entries(STARTER_RESOURCE_REQUIREMENTS).map(([typeId, required]) => [
    typeId,
    Math.ceil(required * STARTER_RESOURCE_MARGIN),
  ]),
);

// A surface boulder makes the vanilla wood-pick -> cobblestone -> stone-pick
// progression visible without asking a new player to guess that the grass
// island has a buried stone core. Ten exposed blocks hold the margin over the
// four cobblestone the route actually spends.
export const STARTER_BOULDER_BLOCKS = [
  { x: 15, y: 12, z: 11 },
  { x: 16, y: 12, z: 11 },
  { x: 17, y: 12, z: 11 },
  { x: 15, y: 12, z: 12 },
  { x: 16, y: 12, z: 12 },
  { x: 17, y: 12, z: 12 },
  { x: 15, y: 13, z: 11 },
  { x: 16, y: 13, z: 11 },
  { x: 15, y: 13, z: 12 },
  { x: 16, y: 13, z: 12 },
];

// Ore the player can actually reach. Each entry is a visible block in the
// walkable grass surface with open sky above it and a short column of the same
// ore directly beneath, so the prospect both advertises itself and teaches
// that digging straight down pays. Ore is never placed on the tapered
// underside: those faces are only reachable by flying, and the first skiff is
// what the ore is for.
export const STARTER_SURFACE_OUTCROPS = [
  { index: BLOCK.ironOre, x: 9, z: 9, depth: 3 },
  { index: BLOCK.ironOre, x: 14, z: 13, depth: 3 },
  { index: BLOCK.ironOre, x: 10, z: 16, depth: 3 },
  { index: BLOCK.ironOre, x: 18, z: 12, depth: 3 },
  { index: BLOCK.coalOre, x: 10, z: 9, depth: 3 },
  { index: BLOCK.coalOre, x: 15, z: 7, depth: 2 },
];

const SURFACE_Y = 11;

// Shallow pockets in the stone core, three to four blocks under the clearing.
// They reward the player who keeps digging after the visible columns run out
// without being required to reach the margin from the surface alone.
const STARTER_BURIED_POCKETS = [
  { index: BLOCK.ironOre, x: 11, y: 8, z: 12 },
  { index: BLOCK.ironOre, x: 12, y: 8, z: 12 },
  { index: BLOCK.ironOre, x: 11, y: 7, z: 12 },
  { index: BLOCK.ironOre, x: 13, y: 8, z: 8 },
  { index: BLOCK.ironOre, x: 14, y: 8, z: 8 },
  { index: BLOCK.ironOre, x: 13, y: 7, z: 8 },
  { index: BLOCK.coalOre, x: 11, y: 8, z: 6 },
  { index: BLOCK.coalOre, x: 12, y: 8, z: 6 },
  { index: BLOCK.coalOre, x: 11, y: 7, z: 6 },
];

const STARTER_PROSPECTS = [
  ...STARTER_SURFACE_OUTCROPS.flatMap(({ index, x, z, depth }) =>
    Array.from({ length: depth }, (_unused, offset) => ({
      index,
      x,
      y: SURFACE_Y - offset,
      z,
    })),
  ),
  ...STARTER_BURIED_POCKETS,
];

// Four oak trees at four logs each. The route spends nineteen planks, so the
// margin is carried in standing wood rather than in a chest the player has to
// find first.
export const STARTER_TREES = [
  { x: 7, z: 7 },
  { x: 17, z: 15 },
  { x: 6, z: 14 },
  { x: 19, z: 7 },
];

const TRUNK_HEIGHTS = [12, 13, 14, 15];

function treeStamps({ x, z }) {
  return [
    boxStamp({
      index: BLOCK.leaves,
      minX: x - 2,
      maxX: x + 2,
      minY: 14,
      maxY: 14,
      minZ: z - 2,
      maxZ: z + 2,
    }),
    boxStamp({
      index: BLOCK.leaves,
      minX: x - 1,
      maxX: x + 1,
      minY: 15,
      maxY: 15,
      minZ: z - 1,
      maxZ: z + 1,
    }),
  ];
}

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
      ...STARTER_BOULDER_BLOCKS.map((block) =>
        blockStamp({ index: BLOCK.stone, ...block }),
      ),
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
      ...STARTER_TREES.flatMap(treeStamps),
      ...STARTER_TREES.flatMap(({ x, z }) =>
        TRUNK_HEIGHTS.map((y) => blockStamp({ index: BLOCK.log, x, y, z })),
      ),
    ],
  });

  assertSolidBody({
    name: "Starter island",
    size: SIZE,
    body: BODY,
    indices,
  });

  assertStarterResourceMinimums(indices);
  assertReachableProspects();
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

  // The island core holds hundreds of stone blocks, so a plain block count
  // proves nothing about the stone a player can reach before their first
  // pickaxe. Only the exposed boulder counts toward the stone margin.
  const stoneMinimum = STARTER_RESOURCE_MINIMUMS["minecraft:stone"];

  if (STARTER_BOULDER_BLOCKS.length < stoneMinimum) {
    throw new Error(
      `Starter island exposes ${STARTER_BOULDER_BLOCKS.length} boulder stone; expected at least ${stoneMinimum}.`,
    );
  }
}

// Ore below this height sits on the tapered underside or the sheer side faces.
// A player reaches those only by flying, and flying is what the ore buys, so
// such placements do not count as supply no matter how many blocks they add.
const MIN_REACHABLE_ORE_Y = 7;

const MIN_SURFACE_OUTCROPS = {
  [BLOCK.ironOre]: 4,
  [BLOCK.coalOre]: 2,
};

function assertReachableProspects() {
  for (const { index, x, y, z } of STARTER_PROSPECTS) {
    if (y < MIN_REACHABLE_ORE_Y) {
      throw new Error(
        `Starter island ore at ${x},${y},${z} sits below y=${MIN_REACHABLE_ORE_Y} and is not reachable before the first skiff.`,
      );
    }

    if (!BODY.contains(x, y, z)) {
      throw new Error(
        `Starter island ore at ${x},${y},${z} is outside the body and would float beside the island.`,
      );
    }

    if (index === undefined) {
      throw new Error(
        `Starter island ore at ${x},${y},${z} has no palette index.`,
      );
    }
  }

  for (const [index, minimum] of Object.entries(MIN_SURFACE_OUTCROPS)) {
    const actual = STARTER_SURFACE_OUTCROPS.filter(
      (outcrop) => outcrop.index === Number(index),
    ).length;

    if (actual < minimum) {
      throw new Error(
        `Starter island exposes ${actual} ${PALETTE[index]} outcrops in the walkable surface; expected at least ${minimum}.`,
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
