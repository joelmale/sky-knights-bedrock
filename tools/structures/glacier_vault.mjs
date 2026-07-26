// Tier-3 tundra vault: tall watchtower, tier-2 loot chest, deep diamond pocket.

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

const SIZE = [31, 18, 27];

const PALETTE = [
  "minecraft:stone",
  "minecraft:packed_ice",
  "minecraft:snow_block",
  "minecraft:spruce_planks",
  "minecraft:stone_bricks",
  "minecraft:cracked_stone_bricks",
  "minecraft:chest",
  "minecraft:blue_ice",
  "minecraft:diamond_ore",
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
  diamondOre: 8,
};

const BODY = canonicalIslandBody(SIZE);

// Watchtower footprint, centered on the body: walls run one layer above the
// surface up to the highest layer the structure has room for, then a solid
// roof caps it. All four wall corners sit well inside the topY silhouette
// (checked against `radiusAt(BODY.topY)`), so the tower never floats.
const TOWER_MIN_X = BODY.centerX - 5;
const TOWER_MAX_X = BODY.centerX + 5;
const TOWER_MIN_Z = BODY.centerZ - 5;
const TOWER_MAX_Z = BODY.centerZ + 5;
const TOWER_WALL_MIN_Y = BODY.topY + 1;
const TOWER_WALL_MAX_Y = SIZE[1] - 2;
const TOWER_ROOF_Y = SIZE[1] - 1;

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
      // Deep interior pocket: sits well below the subsurface band, so it
      // requires real mining down through the core rather than being
      // exposed at or near the walkable surface.
      orePocket({
        index: BLOCK.diamondOre,
        minY: 3,
        maxY: 6,
        offsets: [
          [-3, 1],
          [3, -2],
          [0, 3],
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
      perimeterStamp({
        index: ({ x, y, z }) =>
          (x + y + z) % 5 === 0 ? BLOCK.weathered : BLOCK.structure,
        minX: TOWER_MIN_X,
        maxX: TOWER_MAX_X,
        minY: TOWER_WALL_MIN_Y,
        maxY: TOWER_WALL_MAX_Y,
        minZ: TOWER_MIN_Z,
        maxZ: TOWER_MAX_Z,
        opening: ({ x, z }) =>
          z === TOWER_MIN_Z && x >= BODY.centerX - 1 && x <= BODY.centerX + 1,
      }),
      boxStamp({
        index: BLOCK.structure,
        minX: TOWER_MIN_X,
        maxX: TOWER_MAX_X,
        minY: TOWER_ROOF_Y,
        maxY: TOWER_ROOF_Y,
        minZ: TOWER_MIN_Z,
        maxZ: TOWER_MAX_Z,
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
          [-9, 6],
          [9, -6],
          [5, 9],
        ],
      }),
    ],
  });

  assertSolidBody({ name: "Glacier Vault", size: SIZE, body: BODY, indices });

  return structureBuffer(SIZE, PALETTE, indices);
}

export const island = {
  id: "glacier_vault",
  family: "tundra",
  tier: 3,
  structureId: "skyknights:glacier_vault",
  outputPath: [
    "behavior_packs",
    "sk_bp",
    "structures",
    "skyknights",
    "glacier_vault.mcstructure",
  ],
  size: SIZE,
  palette: PALETTE,
  body: BODY,
  // Origin-relative; MUST equal canonicalAnchors(size) in scripts/config/islands.ts
  anchors: {
    safeDock: { x: 2.5, y: BODY.topY + 1, z: BODY.centerZ + 0.5 },
    lootChest: { x: BODY.centerX, y: BODY.topY + 1, z: BODY.centerZ },
    encounterSpawn: {
      x: BODY.centerX + 0.5,
      y: BODY.topY + 1,
      z: BODY.centerZ + 4.5,
    },
  },
  // MUST equal canonicalIntegrityBlocks(size, familyPalette) — see architect contract section 4
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
