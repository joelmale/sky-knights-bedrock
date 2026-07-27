// Compact volcanic ambient island: scorched strata, magma, and crimson growth.

import {
  boxStamp,
  canopyStamp,
  canonicalIslandBody,
  scatterStamp,
} from "./shape.mjs";
import { defineAmbientIsland } from "./ambient_shared.mjs";

const SIZE = [15, 10, 13];
const PALETTE = [
  "minecraft:blackstone",
  "minecraft:basalt",
  "minecraft:netherrack",
  "minecraft:magma",
  "minecraft:crimson_stem",
  "minecraft:nether_wart_block",
];
const BLOCK = {
  core: 0,
  subsurface: 1,
  surface: 2,
  accent: 3,
  stem: 4,
  growth: 5,
};
const BODY = canonicalIslandBody(SIZE);
const GROWTH = {
  x: BODY.centerX - 1,
  z: BODY.centerZ,
};

export const island = defineAmbientIsland({
  id: "ambient_volcanic",
  family: "volcanic",
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
        [-2, -3],
        [3, 2],
        [4, -1],
      ],
    }),
    canopyStamp({
      index: BLOCK.growth,
      y: BODY.topY + 3,
      minX: GROWTH.x - 1,
      maxX: GROWTH.x + 1,
      minZ: GROWTH.z - 1,
      maxZ: GROWTH.z + 1,
    }),
    canopyStamp({
      index: BLOCK.growth,
      y: BODY.topY + 4,
      minX: GROWTH.x,
      maxX: GROWTH.x,
      minZ: GROWTH.z,
      maxZ: GROWTH.z,
    }),
    boxStamp({
      index: BLOCK.stem,
      minX: GROWTH.x,
      maxX: GROWTH.x,
      minY: BODY.topY + 1,
      maxY: BODY.topY + 3,
      minZ: GROWTH.z,
      maxZ: GROWTH.z,
    }),
    boxStamp({
      index: BLOCK.subsurface,
      minX: BODY.centerX + 3,
      maxX: BODY.centerX + 3,
      minY: BODY.topY + 1,
      maxY: BODY.topY + 2,
      minZ: BODY.centerZ - 2,
      maxZ: BODY.centerZ - 2,
    }),
  ],
});
