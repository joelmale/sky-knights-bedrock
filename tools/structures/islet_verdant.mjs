// Islet tier, verdant family: a mossy stepping stone with a single shrub.
//
// Islets are the filler tier - 35% of every plan - so they are deliberately
// cheap: no lakes, no falls, no caves, no burn gates, one accent scatter and
// one two-block shrub.

import { boxStamp, canonicalIslandBody, scatterStamp } from "./shape.mjs";
import {
  FAMILY_KITS,
  TIER_GEOMETRY,
  defineTierIsland,
} from "./tier_shared.mjs";

const KIT = FAMILY_KITS.verdant;
const SIZE = TIER_GEOMETRY.islet.size;
const BODY = canonicalIslandBody(SIZE);
const SHRUB = { x: BODY.centerX - 1, z: BODY.centerZ + 1 };

export const island = defineTierIsland({
  id: "islet_verdant",
  family: "verdant",
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
        [2, 1],
        [-2, -1],
        [2, -1],
      ],
    }),
    boxStamp({
      index: KIT.block.trunk,
      minX: SHRUB.x,
      maxX: SHRUB.x,
      minY: BODY.topY + 1,
      maxY: BODY.topY + 1,
      minZ: SHRUB.z,
      maxZ: SHRUB.z,
    }),
    boxStamp({
      index: KIT.block.leaves,
      minX: SHRUB.x,
      maxX: SHRUB.x,
      minY: BODY.topY + 2,
      maxY: BODY.topY + 2,
      minZ: SHRUB.z,
      maxZ: SHRUB.z,
    }),
  ],
});
