// Tier-3 volcanic body: obsidian-rimmed lava vent, relic shrine, elite anchor.

import { structureBuffer } from "./nbt.mjs";
import {
  assertSolidBody,
  blockStamp,
  boxStamp,
  buildIslandIndices,
  canonicalIslandBody,
  dockPlatform,
  perimeterStamp,
  scatterStamp,
} from "./shape.mjs";

const SIZE = [31, 18, 27];

const PALETTE = [
  "minecraft:blackstone", // 0 core
  "minecraft:basalt", // 1 subsurface
  "minecraft:netherrack", // 2 surface
  "minecraft:polished_blackstone_bricks", // 3 dock
  "minecraft:stone_bricks", // 4 structure
  "minecraft:cracked_stone_bricks", // 5 structure weathered
  "minecraft:chest", // 6 chest
  "minecraft:magma", // 7 accent
  "minecraft:obsidian", // 8 island-specific: crater rim
  "minecraft:lava", // 9 island-specific: crater vent
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
  obsidian: 8,
  lava: 9,
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
    stamps: [
      // Landing dock: deliberately overhangs the low-X face (contract section 4).
      ...dockPlatform({
        index: BLOCK.dock,
        y: BODY.topY,
        minX: 0,
        maxX: 4,
        minZ: BODY.centerZ - 1,
        maxZ: BODY.centerZ + 1,
      }),
      // Obsidian rim around a shallow lava vent, well clear of the dock
      // corridor, the shrine footprint, and every integrity probe.
      perimeterStamp({
        index: BLOCK.obsidian,
        minX: BODY.centerX - 9,
        maxX: BODY.centerX - 5,
        minY: BODY.topY,
        maxY: BODY.topY,
        minZ: BODY.centerZ - 8,
        maxZ: BODY.centerZ - 4,
      }),
      boxStamp({
        index: BLOCK.lava,
        minX: BODY.centerX - 8,
        maxX: BODY.centerX - 6,
        minY: BODY.topY,
        maxY: BODY.topY,
        minZ: BODY.centerZ - 7,
        maxZ: BODY.centerZ - 5,
      }),
      // Relic shrine: hollow blackstone/stone-brick shell with two opposing
      // doorways. The rear doorway coincides with the canonical encounter
      // anchor so the demon elite guard spawns in the open, never in a wall.
      perimeterStamp({
        index: ({ x, y, z }) =>
          (x + y + z) % 4 === 0 ? BLOCK.weathered : BLOCK.structure,
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
      // Relic Shard chest anchor. Contents are placed and healed at runtime;
      // this only bakes the block so the anchor is always a real chest.
      blockStamp({
        index: BLOCK.chest,
        x: BODY.centerX,
        y: BODY.topY + 1,
        z: BODY.centerZ,
      }),
      // Scattered magma vents away from the shrine, the dock corridor, the
      // lava vent, and every integrity probe.
      scatterStamp({
        index: BLOCK.accent,
        y: BODY.topY,
        offsets: [
          [6, -8],
          [6, 8],
          [-3, 9],
          [3, -9],
        ],
      }),
    ],
  });

  assertSolidBody({ name: "Ashfall Crater", size: SIZE, body: BODY, indices });

  return structureBuffer(SIZE, PALETTE, indices);
}

export const island = {
  id: "ashfall_crater",
  family: "volcanic",
  tier: 3,
  structureId: "skyknights:ashfall_crater",
  outputPath: [
    "behavior_packs",
    "sk_bp",
    "structures",
    "skyknights",
    "ashfall_crater.mcstructure",
  ],
  size: SIZE,
  palette: PALETTE,
  body: BODY,
  // Origin-relative; must equal canonicalAnchors(size) in scripts/config/islands.ts.
  anchors: {
    safeDock: { x: 2.5, y: BODY.topY + 1, z: BODY.centerZ + 0.5 },
    lootChest: { x: BODY.centerX, y: BODY.topY + 1, z: BODY.centerZ },
    encounterSpawn: {
      x: BODY.centerX + 0.5,
      y: BODY.topY + 1,
      z: BODY.centerZ + 4.5,
    },
  },
  // Must equal canonicalIntegrityBlocks(size, ISLAND_FAMILIES.volcanic.palette).
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
