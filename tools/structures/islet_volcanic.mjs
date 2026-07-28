// Islet tier, volcanic family: a scorched shelf with one crimson shoot.
//
// No fire and no lava at this tier: the burn gates are only ever evaluated for
// crag and landmark volcanic islands.

import { boxStamp, canonicalIslandBody, scatterStamp } from "./shape.mjs";
import {
  FAMILY_KITS,
  TIER_GEOMETRY,
  defineTierIsland,
} from "./tier_shared.mjs";

const KIT = FAMILY_KITS.volcanic;
const SIZE = TIER_GEOMETRY.islet.size;
const BODY = canonicalIslandBody(SIZE);
const SHOOT = { x: BODY.centerX - 1, z: BODY.centerZ - 1 };

export const island = defineTierIsland({
  id: "islet_volcanic",
  family: "volcanic",
  tier: "islet",
  size: SIZE,
  palette: KIT.palette,
  body: BODY,
  airIndex: KIT.block.air,
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
        [2, -1],
      ],
    }),
    boxStamp({
      index: KIT.block.trunk,
      minX: SHOOT.x,
      maxX: SHOOT.x,
      minY: BODY.topY + 1,
      maxY: BODY.topY + 1,
      minZ: SHOOT.z,
      maxZ: SHOOT.z,
    }),
    boxStamp({
      index: KIT.block.leaves,
      minX: SHOOT.x,
      maxX: SHOOT.x,
      minY: BODY.topY + 2,
      maxY: BODY.topY + 2,
      minZ: SHOOT.z,
      maxZ: SHOOT.z,
    }),
  ],
});
