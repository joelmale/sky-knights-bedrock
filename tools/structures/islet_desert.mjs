// Islet tier, desert family: a sandstone shelf with one cactus.
//
// The sand cap is laid through `supportedSurfaceStamp`, so it only ever covers
// cells that have body beneath them. A tapered island widens as it rises, and
// sand on the overhanging top ring would fall the moment the structure placed.

import { boxStamp, canonicalIslandBody, scatterStamp } from "./shape.mjs";
import {
  FAMILY_KITS,
  TIER_GEOMETRY,
  defineTierIsland,
  supportedSurfaceStamp,
} from "./tier_shared.mjs";

const KIT = FAMILY_KITS.desert;
const SIZE = TIER_GEOMETRY.islet.size;
const BODY = canonicalIslandBody(SIZE);
const CACTUS = { x: BODY.centerX + 1, z: BODY.centerZ - 1 };

export const island = defineTierIsland({
  id: "islet_desert",
  family: "desert",
  tier: "islet",
  size: SIZE,
  palette: KIT.palette,
  body: BODY,
  airIndex: KIT.block.air,
  strata: {
    core: KIT.block.core,
    subsurface: KIT.block.core,
    surface: KIT.block.subsurface,
  },
  stamps: [
    supportedSurfaceStamp({
      index: KIT.block.surface,
      y: BODY.topY,
      body: BODY,
    }),
    scatterStamp({
      index: KIT.block.accent,
      y: BODY.topY,
      offsets: [
        [-2, 1],
        [2, 1],
        [-2, -1],
      ],
    }),
    boxStamp({
      index: KIT.block.trunk,
      minX: CACTUS.x,
      maxX: CACTUS.x,
      minY: BODY.topY + 1,
      maxY: BODY.topY + 2,
      minZ: CACTUS.z,
      maxZ: CACTUS.z,
    }),
  ],
});
