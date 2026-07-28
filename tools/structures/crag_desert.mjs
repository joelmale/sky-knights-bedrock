// Crag tier, desert family: a banded butte. Dry by design - no lake and no
// rim fall - so the family reads differently from the air rather than being a
// recoloured verdant crag.
//
// The sand cap is laid through `supportedSurfaceStamp`, because the body widens
// as it rises and sand on the overhanging top ring would fall on placement.

import { orePocket, scatterStamp } from "./shape.mjs";
import { caveMouth, caveTube } from "./features/carve.mjs";
import { mesaStep, mountainPeak, spire } from "./features/relief.mjs";
import {
  FAMILY_KITS,
  TIER_GEOMETRY,
  cragBody,
  defineTierIsland,
  supportedSurfaceStamp,
} from "./tier_shared.mjs";

const KIT = FAMILY_KITS.desert;
const BLOCK = KIT.block;
const SIZE = TIER_GEOMETRY.crag.size;
const BODY = cragBody();

const PEAK = mountainPeak({
  centerX: BODY.centerX,
  centerZ: BODY.centerZ,
  baseY: 10,
  height: 8,
  baseRadius: 5,
  emitLayers: 6,
  coreIndex: BLOCK.subsurface,
  capIndex: BLOCK.cap,
  capDepth: 2,
});

const TERRACES = [
  mesaStep({
    centerX: BODY.centerX,
    centerZ: BODY.centerZ,
    y: 10,
    radiusX: 7,
    radiusZ: 6,
    index: BLOCK.accent,
  }),
  mesaStep({
    centerX: BODY.centerX,
    centerZ: BODY.centerZ,
    y: 11,
    radiusX: 6,
    radiusZ: 5,
    index: BLOCK.subsurface,
  }),
];

const SPIRES = [
  spire({
    x: 4,
    z: 10,
    baseY: 10,
    height: 5,
    radius: 1,
    index: BLOCK.cap,
    flareIndex: BLOCK.accent,
  }),
  spire({
    x: 18,
    z: 9,
    baseY: 10,
    height: 4,
    radius: 1,
    index: BLOCK.cap,
    flareIndex: BLOCK.accent,
  }),
];

const CAVE = caveTube({
  path: [
    [6, 6, 13],
    [11, 5, 10],
    [16, 4, 7],
  ],
  radius: 1,
  roofDepth: 2,
  airIndex: BLOCK.air,
  body: BODY,
});

// The mouth reaches the walkable surface deliberately - it is the one carve
// permitted to touch `body.topY` - so the tube below it is enterable instead of
// being a sealed cavity.
const MOUTH = caveMouth({
  x: 6,
  y: BODY.topY,
  z: 13,
  radius: 1,
  airIndex: BLOCK.air,
  body: BODY,
});

export const island = defineTierIsland({
  id: "crag_desert",
  family: "desert",
  tier: "crag",
  size: SIZE,
  palette: KIT.palette,
  body: BODY,
  airIndex: BLOCK.air,
  strata: {
    core: BLOCK.core,
    subsurface: BLOCK.core,
    surface: BLOCK.subsurface,
  },
  orePockets: [
    orePocket({
      index: BLOCK.ore,
      minY: 2,
      maxY: 5,
      offsets: [
        [-4, 3],
        [-3, 3],
        [4, -3],
        [5, -3],
      ],
    }),
  ],
  stamps: [
    supportedSurfaceStamp({ index: BLOCK.surface, y: BODY.topY, body: BODY }),
    scatterStamp({
      index: BLOCK.accent,
      y: BODY.topY,
      offsets: [
        [-9, 0],
        [-7, 4],
        [8, -3],
        [9, 1],
        [2, -7],
        [-3, 7],
      ],
    }),
  ],
  features: [...TERRACES, ...SPIRES, PEAK, CAVE, MOUTH],
});
