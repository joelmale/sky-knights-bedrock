// Compact tundra ambient island: snow and ice strata with one spruce.

import {
  boxStamp,
  canopyStamp,
  canonicalIslandBody,
  scatterStamp,
} from "./shape.mjs";
import { defineAmbientIsland } from "./ambient_shared.mjs";

const SIZE = [15, 10, 13];
const PALETTE = [
  "minecraft:stone",
  "minecraft:packed_ice",
  "minecraft:snow_block",
  "minecraft:blue_ice",
  "minecraft:spruce_log",
  "minecraft:spruce_leaves",
];
const BLOCK = {
  core: 0,
  subsurface: 1,
  surface: 2,
  accent: 3,
  trunk: 4,
  leaves: 5,
};
const BODY = canonicalIslandBody(SIZE);
const TREE = {
  x: BODY.centerX + 1,
  z: BODY.centerZ,
};

export const island = defineAmbientIsland({
  id: "ambient_tundra",
  family: "tundra",
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
      index: BLOCK.leaves,
      y: BODY.topY + 3,
      minX: TREE.x - 1,
      maxX: TREE.x + 1,
      minZ: TREE.z - 1,
      maxZ: TREE.z + 1,
    }),
    canopyStamp({
      index: BLOCK.leaves,
      y: BODY.topY + 4,
      minX: TREE.x,
      maxX: TREE.x,
      minZ: TREE.z,
      maxZ: TREE.z,
    }),
    boxStamp({
      index: BLOCK.trunk,
      minX: TREE.x,
      maxX: TREE.x,
      minY: BODY.topY + 1,
      maxY: BODY.topY + 3,
      minZ: TREE.z,
      maxZ: TREE.z,
    }),
  ],
});
