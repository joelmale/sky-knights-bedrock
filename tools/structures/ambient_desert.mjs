// Compact desert ambient island: layered sandstone, terracotta, and cacti.

import { boxStamp, canonicalIslandBody, scatterStamp } from "./shape.mjs";
import { defineAmbientIsland } from "./ambient_shared.mjs";

const SIZE = [15, 10, 13];
const PALETTE = [
  "minecraft:sandstone",
  "minecraft:sand",
  "minecraft:red_sand",
  "minecraft:terracotta",
  "minecraft:cactus",
];
const BLOCK = {
  core: 0,
  subsurface: 1,
  surface: 2,
  accent: 3,
  cactus: 4,
};
const BODY = canonicalIslandBody(SIZE);

export const island = defineAmbientIsland({
  id: "ambient_desert",
  family: "desert",
  size: SIZE,
  palette: PALETTE,
  body: BODY,
  strata: {
    core: BLOCK.core,
    subsurface: BLOCK.subsurface,
    surface: BLOCK.surface,
  },
  stamps: [
    scatterStamp({
      index: BLOCK.accent,
      y: BODY.topY,
      offsets: [
        [-4, 1],
        [-1, -3],
        [2, 3],
        [4, -1],
      ],
    }),
    boxStamp({
      index: BLOCK.cactus,
      minX: BODY.centerX - 3,
      maxX: BODY.centerX - 3,
      minY: BODY.topY + 1,
      maxY: BODY.topY + 3,
      minZ: BODY.centerZ + 1,
      maxZ: BODY.centerZ + 1,
    }),
    boxStamp({
      index: BLOCK.cactus,
      minX: BODY.centerX + 3,
      maxX: BODY.centerX + 3,
      minY: BODY.topY + 1,
      maxY: BODY.topY + 2,
      minZ: BODY.centerZ - 2,
      maxZ: BODY.centerZ - 2,
    }),
  ],
});
