// Islet tier, tundra family: a snow shelf over packed ice with one sapling.

import { boxStamp, canonicalIslandBody, scatterStamp } from "./shape.mjs";
import {
  FAMILY_KITS,
  TIER_GEOMETRY,
  defineTierIsland,
} from "./tier_shared.mjs";

const KIT = FAMILY_KITS.tundra;
const SIZE = TIER_GEOMETRY.islet.size;
const BODY = canonicalIslandBody(SIZE);
const SAPLING = { x: BODY.centerX + 1, z: BODY.centerZ + 1 };

export const island = defineTierIsland({
  id: "islet_tundra",
  family: "tundra",
  tier: "islet",
  size: SIZE,
  palette: KIT.palette,
  body: BODY,
  airIndex: KIT.block.air,
  leafIndex: KIT.block.leaves,
  logIndex: KIT.block.trunk,
  strata: {
    core: KIT.block.core,
    subsurface: KIT.block.subsurface,
    surface: KIT.block.surface,
  },
  stamps: [
    scatterStamp({
      index: KIT.block.accent,
      y: BODY.topY,
      offsets: [
        [-2, 1],
        [2, -1],
        [-2, -1],
      ],
    }),
    boxStamp({
      index: KIT.block.trunk,
      minX: SAPLING.x,
      maxX: SAPLING.x,
      minY: BODY.topY + 1,
      maxY: BODY.topY + 1,
      minZ: SAPLING.z,
      maxZ: SAPLING.z,
    }),
    boxStamp({
      index: KIT.block.leaves,
      minX: SAPLING.x,
      maxX: SAPLING.x,
      minY: BODY.topY + 2,
      maxY: BODY.topY + 2,
      minZ: SAPLING.z,
      maxZ: SAPLING.z,
    }),
  ],
});
