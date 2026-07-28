// Landmark tier, verdant family.
//
// 39x30x35 is the hitch ceiling for non-continent content: legal as a single
// `place()` call (well inside Bedrock's 64x384x64 limit) but big enough that the
// 8500-solid-block budget is the thing keeping it playable. Everything here is
// counted at build time by `defineTierIsland`.
//
// The summit is a TRUNCATED cone rather than a point, which is what leaves a
// radius-5 plateau at y 22 with no rock hanging above it - room for a sealed
// tarn that reads as a mountain lake instead of a sealed cavity.

import { orePocket, scatterStamp } from "./shape.mjs";
import { landBridge } from "./features/bridge.mjs";
import { caveMouth, caveTube, chasm } from "./features/carve.mjs";
import { rimFall } from "./features/fall.mjs";
import { lakeBasin } from "./features/lake.mjs";
import { foliageTree, mountainPeak, spire } from "./features/relief.mjs";
import {
  FAMILY_KITS,
  TIER_GEOMETRY,
  defineTierIsland,
  landmarkBody,
} from "./tier_shared.mjs";

const KIT = FAMILY_KITS.verdant;
const BLOCK = KIT.block;
const SIZE = TIER_GEOMETRY.landmark.size;
const BODY = landmarkBody();
const SUMMIT_Y = 22;

const PEAK = mountainPeak({
  centerX: BODY.centerX,
  centerZ: BODY.centerZ,
  baseY: 15,
  height: 13,
  emitLayers: 7,
  baseRadius: 9,
  coreIndex: BLOCK.core,
  capIndex: BLOCK.cap,
  capDepth: 2,
});

const TARN = lakeBasin({
  centerX: BODY.centerX,
  centerZ: BODY.centerZ,
  radiusX: 3,
  radiusZ: 2,
  surfaceY: SUMMIT_Y,
  depth: 2,
  liquidIndex: BLOCK.water,
  linerIndex: BLOCK.liner,
  airIndex: BLOCK.air,
});

const SPIRES = [
  spire({
    x: 7,
    z: 12,
    baseY: 15,
    height: 12,
    radius: 1,
    index: BLOCK.cap,
    flareIndex: BLOCK.core,
  }),
  spire({
    x: 30,
    z: 22,
    baseY: 15,
    height: 10,
    radius: 1,
    index: BLOCK.cap,
    flareIndex: BLOCK.core,
  }),
  spire({
    x: 19,
    z: 29,
    baseY: 15,
    height: 14,
    radius: 2,
    index: BLOCK.cap,
    flareIndex: BLOCK.core,
  }),
];

const GROVE = [
  { x: 9, z: 22, trunkHeight: 5 },
  { x: 13, z: 27, trunkHeight: 6 },
  { x: 24, z: 8, trunkHeight: 5 },
  { x: 30, z: 12, trunkHeight: 6 },
  { x: 15, z: 6, trunkHeight: 4 },
].map(({ x, z, trunkHeight }) =>
  foliageTree({
    x,
    z,
    baseY: BODY.topY + 1,
    trunkHeight,
    trunkIndex: BLOCK.trunk,
    leafIndex: BLOCK.leaves,
  }),
);

const CAVE = caveTube({
  path: [
    [10, 11, 17],
    [19, 10, 12],
    [27, 11, 23],
  ],
  radius: 1,
  roofDepth: 2,
  airIndex: BLOCK.air,
  body: BODY,
});

const MOUTH = caveMouth({
  x: 10,
  y: BODY.topY,
  z: 17,
  radius: 2,
  airIndex: BLOCK.air,
  body: BODY,
});

const CHASM = chasm({
  axis: "z",
  centerX: 28,
  minZ: 6,
  maxZ: 28,
  width: 3,
  topY: BODY.topY,
  bottomY: 8,
  airIndex: BLOCK.air,
  body: BODY,
});

const BRIDGE = landBridge({
  fromX: 24,
  fromZ: 21,
  toX: 33,
  toZ: 21,
  y: BODY.topY + 1,
  width: 3,
  archDepth: 1,
  index: BLOCK.liner,
});

const BOUNDED_FALL = rimFall({
  spoutX: 36,
  spoutZ: 21,
  surfaceY: BODY.topY,
  spillType: "bounded",
  liquid: "water",
  liquidIndex: BLOCK.water,
  linerIndex: BLOCK.liner,
  airIndex: BLOCK.air,
  outward: [1, 0],
  body: BODY,
});

// The one void fall this tier is allowed. The column exits the bottom face and
// the engine builds a static falling column into the sky: a one-time settle and
// a few hundred liquid blocks that only exist while the island is in render
// distance. It is the hero shot and it is deliberately rationed.
const VOID_FALL = rimFall({
  spoutX: 2,
  spoutZ: 13,
  surfaceY: BODY.topY,
  spillType: "void",
  liquid: "water",
  liquidIndex: BLOCK.water,
  linerIndex: BLOCK.liner,
  airIndex: BLOCK.air,
  outward: [-1, 0],
  structureMinY: 0,
  body: BODY,
});

export const island = defineTierIsland({
  id: "landmark_verdant",
  family: "verdant",
  tier: "landmark",
  size: SIZE,
  palette: KIT.palette,
  body: BODY,
  airIndex: BLOCK.air,
  leafIndex: BLOCK.leaves,
  logIndex: BLOCK.trunk,
  liquidIndices: [BLOCK.water],
  linerIndices: [BLOCK.liner, BLOCK.core, BLOCK.cap],
  strata: {
    core: BLOCK.core,
    subsurface: BLOCK.subsurface,
    surface: BLOCK.surface,
  },
  orePockets: [
    orePocket({
      index: BLOCK.ore,
      minY: 3,
      maxY: 8,
      offsets: [
        [-8, 4],
        [-7, 4],
        [-7, 5],
        [9, -6],
        [10, -6],
        [10, -5],
      ],
    }),
  ],
  stamps: [
    scatterStamp({
      index: BLOCK.accent,
      y: BODY.topY,
      offsets: [
        [-14, 2],
        [-12, -6],
        [-10, 9],
        [13, -4],
        [11, 8],
        [15, 3],
        [2, -12],
        [-4, 12],
        [6, 11],
      ],
    }),
  ],
  features: [
    ...SPIRES,
    PEAK,
    TARN,
    ...GROVE,
    CAVE,
    MOUTH,
    CHASM,
    BRIDGE,
    BOUNDED_FALL,
    VOID_FALL,
  ],
});
