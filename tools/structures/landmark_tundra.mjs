// Landmark tier, tundra family: a glacier horn with a summit tarn, a rim
// meltwater fall, and one void fall off the western cliff.

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

const KIT = FAMILY_KITS.tundra;
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
  coreIndex: BLOCK.subsurface,
  capIndex: BLOCK.surface,
  capDepth: 3,
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
    x: 8,
    z: 24,
    baseY: 15,
    height: 13,
    radius: 1,
    index: BLOCK.accent,
    flareIndex: BLOCK.subsurface,
  }),
  spire({
    x: 31,
    z: 14,
    baseY: 15,
    height: 11,
    radius: 1,
    index: BLOCK.accent,
    flareIndex: BLOCK.subsurface,
  }),
  spire({
    x: 18,
    z: 5,
    baseY: 15,
    height: 15,
    radius: 2,
    index: BLOCK.accent,
    flareIndex: BLOCK.subsurface,
  }),
];

const GROVE = [
  { x: 11, z: 13, trunkHeight: 6 },
  { x: 14, z: 27, trunkHeight: 5 },
  { x: 26, z: 27, trunkHeight: 6 },
  { x: 29, z: 20, trunkHeight: 5 },
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
    [11, 11, 21],
    [19, 10, 17],
    [27, 11, 12],
  ],
  radius: 1,
  roofDepth: 2,
  airIndex: BLOCK.air,
  body: BODY,
});

const MOUTH = caveMouth({
  x: 11,
  y: BODY.topY,
  z: 21,
  radius: 2,
  airIndex: BLOCK.air,
  body: BODY,
});

const CHASM = chasm({
  axis: "z",
  centerX: 29,
  minZ: 8,
  maxZ: 27,
  width: 3,
  topY: BODY.topY,
  bottomY: 9,
  airIndex: BLOCK.air,
  body: BODY,
});

const BRIDGE = landBridge({
  fromX: 25,
  fromZ: 18,
  toX: 34,
  toZ: 18,
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
  id: "landmark_tundra",
  family: "tundra",
  tier: "landmark",
  size: SIZE,
  palette: KIT.palette,
  body: BODY,
  airIndex: BLOCK.air,
  leafIndex: BLOCK.leaves,
  logIndex: BLOCK.trunk,
  liquidIndices: [BLOCK.water],
  linerIndices: [BLOCK.liner, BLOCK.core, BLOCK.subsurface, BLOCK.surface],
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
        [-9, -3],
        [-8, -3],
        [-8, -2],
        [8, 6],
        [9, 6],
        [9, 7],
      ],
    }),
  ],
  stamps: [
    scatterStamp({
      index: BLOCK.accent,
      y: BODY.topY,
      offsets: [
        [-15, -1],
        [-11, 7],
        [-9, -9],
        [12, 6],
        [14, -5],
        [10, -10],
        [-1, 13],
        [4, -12],
        [-6, -11],
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
