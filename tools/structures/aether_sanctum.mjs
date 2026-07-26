// Endgame boss arena: ceremonial gate, defensible pillars, Aether Core vault.

import { structureBuffer } from "./nbt.mjs";
import {
  assertSolidBody,
  blockStamp,
  boxStamp,
  buildIslandIndices,
  canonicalIslandBody,
  dockPlatform,
  scatterStamp,
} from "./shape.mjs";

const SIZE = [37, 22, 33];

const PALETTE = [
  "minecraft:sandstone",
  "minecraft:sand",
  "minecraft:red_sand",
  "minecraft:cut_sandstone",
  "minecraft:chiseled_sandstone",
  "minecraft:cracked_stone_bricks",
  "minecraft:chest",
  "minecraft:terracotta",
  "minecraft:gold_block",
  "minecraft:quartz_block",
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
  gold: 8,
  quartz: 9,
};

const BODY = canonicalIslandBody(SIZE);

// Every island body leaves exactly four layers of headroom above `topY`
// (`size[1] - 1 - topY === 4`), so every mass below is capped at `topY + 4`.
const WALL_FROM_Y = BODY.topY + 1;
const WALL_TO_Y = BODY.topY + 3;
const CAP_Y = BODY.topY + 4;

// Weathered banding keeps masonry masses from reading as one flat color.
const masonryIndex = ({ x, y, z }) =>
  (x + y + z) % 3 === 0 ? BLOCK.weathered : BLOCK.structure;

/** A shaft of banded masonry topped with a single gilded cap layer. */
function columnStamps({ minX, maxX, minZ, maxZ, index = masonryIndex }) {
  return [
    boxStamp({
      index,
      minX,
      maxX,
      minY: WALL_FROM_Y,
      maxY: WALL_TO_Y,
      minZ,
      maxZ,
    }),
    boxStamp({
      index: BLOCK.gold,
      minX,
      maxX,
      minY: CAP_Y,
      maxY: CAP_Y,
      minZ,
      maxZ,
    }),
  ];
}

// Twin gate towers flank the ceremonial approach just past the dock.
const GATE_TOWER_A = { minX: 5, maxX: 6, minZ: 10, maxZ: 11 };
const GATE_TOWER_B = { minX: 5, maxX: 6, minZ: 21, maxZ: 22 };

// Slender colonnade pillars line the walkway from the gate into the arena.
const COLONNADE_COLUMNS = [
  { minX: 9, maxX: 9, minZ: 11, maxZ: 11 },
  { minX: 9, maxX: 9, minZ: 21, maxZ: 21 },
  { minX: 13, maxX: 13, minZ: 11, maxZ: 11 },
  { minX: 13, maxX: 13, minZ: 21, maxZ: 21 },
];

// Freestanding defensible pillars scattered across the open arena floor,
// offsets measured from the body center (dx, dz).
const ARENA_PILLAR_OFFSETS = [
  [8, 9],
  [8, -9],
  [-8, 9],
  [-8, -9],
  [0, -12],
];

// A solid, un-banded rear altar behind the boss anchor, capped in gold.
const REAR_MONUMENT_OFFSET = { minDx: -1, maxDx: 1, minDz: 11, maxDz: 13 };

function build() {
  const arenaPillarColumns = ARENA_PILLAR_OFFSETS.map(([dx, dz]) => ({
    minX: BODY.centerX + dx,
    maxX: BODY.centerX + dx,
    minZ: BODY.centerZ + dz,
    maxZ: BODY.centerZ + dz,
  }));

  const indices = buildIslandIndices({
    size: SIZE,
    body: BODY,
    strata: {
      core: BLOCK.core,
      subsurface: BLOCK.subsurface,
      surface: BLOCK.surface,
    },
    stamps: [
      // Ceremonial approach: a wide landing deck reaching the low-X face.
      ...dockPlatform({
        index: BLOCK.dock,
        y: BODY.topY,
        minX: 0,
        maxX: 5,
        minZ: BODY.centerZ - 3,
        maxZ: BODY.centerZ + 3,
      }),
      ...columnStamps(GATE_TOWER_A),
      ...columnStamps(GATE_TOWER_B),
      // A single gilded lintel joins the two gate towers into one arch.
      boxStamp({
        index: BLOCK.gold,
        minX: 5,
        maxX: 6,
        minY: CAP_Y,
        maxY: CAP_Y,
        minZ: 10,
        maxZ: 22,
      }),
      ...COLONNADE_COLUMNS.flatMap((column) => columnStamps(column)),
      ...arenaPillarColumns.flatMap((column) => columnStamps(column)),
      boxStamp({
        index: BLOCK.structure,
        minX: BODY.centerX + REAR_MONUMENT_OFFSET.minDx,
        maxX: BODY.centerX + REAR_MONUMENT_OFFSET.maxDx,
        minY: WALL_FROM_Y,
        maxY: WALL_TO_Y,
        minZ: BODY.centerZ + REAR_MONUMENT_OFFSET.minDz,
        maxZ: BODY.centerZ + REAR_MONUMENT_OFFSET.maxDz,
      }),
      boxStamp({
        index: BLOCK.gold,
        minX: BODY.centerX + REAR_MONUMENT_OFFSET.minDx,
        maxX: BODY.centerX + REAR_MONUMENT_OFFSET.maxDx,
        minY: CAP_Y,
        maxY: CAP_Y,
        minZ: BODY.centerZ + REAR_MONUMENT_OFFSET.minDz,
        maxZ: BODY.centerZ + REAR_MONUMENT_OFFSET.maxDz,
      }),
      // Guaranteed Aether Core vault. Contents are placed script-side; this
      // only bakes the chest block itself.
      blockStamp({
        index: BLOCK.chest,
        x: BODY.centerX,
        y: BODY.topY + 1,
        z: BODY.centerZ,
      }),
      // Lorekeeper pedestal, just past the gate on the approach walkway.
      blockStamp({
        index: BLOCK.quartz,
        x: BODY.centerX - 11,
        y: BODY.topY,
        z: BODY.centerZ,
      }),
      // Banner accents framing the boss anchor.
      scatterStamp({
        index: BLOCK.accent,
        y: BODY.topY,
        offsets: [
          [-3, 7],
          [3, 7],
          [-5, 4],
          [5, 4],
          [0, 9],
        ],
      }),
    ],
  });

  assertSolidBody({ name: "Aether Sanctum", size: SIZE, body: BODY, indices });

  return structureBuffer(SIZE, PALETTE, indices);
}

export const island = {
  id: "aether_sanctum",
  family: "desert",
  tier: 3,
  structureId: "skyknights:aether_sanctum",
  outputPath: [
    "behavior_packs",
    "sk_bp",
    "structures",
    "skyknights",
    "aether_sanctum.mcstructure",
  ],
  size: SIZE,
  palette: PALETTE,
  body: BODY,
  // MUST equal canonicalAnchors(size) in scripts/config/islands.ts.
  anchors: {
    safeDock: { x: 2.5, y: BODY.topY + 1, z: BODY.centerZ + 0.5 },
    lootChest: { x: BODY.centerX, y: BODY.topY + 1, z: BODY.centerZ },
    encounterSpawn: {
      x: BODY.centerX + 0.5,
      y: BODY.topY + 1,
      z: BODY.centerZ + 4.5,
    },
  },
  // Ceremonial anchors beyond the shared `IslandAnchors` contract. Not read
  // by the generation service today; see the integrator report for the
  // registry addition this island needs to make the Lorekeeper spawn point
  // authoritative (the boss anchor already reuses `encounterSpawn`, matching
  // the "guardian"/"warden" convention Ember Outpost and Frostspire use).
  loreAnchors: {
    lorekeeperSpawn: {
      x: BODY.centerX - 11,
      y: BODY.topY + 1,
      z: BODY.centerZ,
    },
  },
  // MUST equal canonicalIntegrityBlocks(size, familyPalette).
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
