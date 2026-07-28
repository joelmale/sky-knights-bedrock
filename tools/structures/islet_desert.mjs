// Islet tier: tiny desert dust.

import { canonicalIslandBody, scatterStamp } from "./shape.mjs";
import { defineTierIsland } from "./tier_shared.mjs";

const SIZE = [11, 8, 9];
const PALETTE = [
  "minecraft:sandstone",
  "minecraft:sand",
  "minecraft:red_sand",
  "minecraft:terracotta",
];
const BLOCK = { core: 0, subsurface: 1, surface: 2, accent: 3 };
const BODY = canonicalIslandBody(SIZE);

export const island = defineTierIsland({
  id: "islet_desert",
  family: "desert",
  tier: "islet",
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
      offsets: [[-1, 1]],
    }),
  ],
  budget: {
    maxSolid: 220,
    maxAir: 40,
    maxLiquid: 0,
    voidFloorRatio: 0.7,
  },
});
