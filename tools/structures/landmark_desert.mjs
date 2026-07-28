// Landmark tier, desert family: a stepped mesa on the high-X lobe and a sealed
// oasis on the low-X lobe.
//
// No summit tarn and no void fall here. The desert landmark reads as terraces
// and shade rather than as a peak, which is what stops the four families
// looking like the same silhouette in four colours.

import { orePocket, scatterStamp } from "./shape.mjs";
import { landBridge } from "./features/bridge.mjs";
import { caveMouth, caveTube, chasm } from "./features/carve.mjs";
import { rimFall } from "./features/fall.mjs";
import { lakeBasin } from "./features/lake.mjs";
import { mesaStep, spire } from "./features/relief.mjs";
import {
  FAMILY_KITS,
  TIER_GEOMETRY,
  defineTierIsland,
  landmarkBody,
  supportedSurfaceStamp,
} from "./tier_shared.mjs";

const KIT = FAMILY_KITS.desert;
const BLOCK = KIT.block;
const SIZE = TIER_GEOMETRY.landmark.size;
const BODY = landmarkBody();
const MESA = { x: 26, z: 17 };

const TERRACES = [
  { y: 15, radiusX: 10, radiusZ: 8, index: BLOCK.accent },
  { y: 16, radiusX: 9, radiusZ: 7, index: BLOCK.subsurface },
  { y: 17, radiusX: 8, radiusZ: 7, index: BLOCK.subsurface },
  { y: 18, radiusX: 7, radiusZ: 6, index: BLOCK.accent },
  { y: 19, radiusX: 6, radiusZ: 5, index: BLOCK.subsurface },
  { y: 20, radiusX: 5, radiusZ: 4, index: BLOCK.subsurface },
  { y: 21, radiusX: 4, radiusZ: 3, index: BLOCK.cap },
  { y: 22, radiusX: 3, radiusZ: 2, index: BLOCK.cap },
].map(({ y, radiusX, radiusZ, index }) =>
  mesaStep({ centerX: MESA.x, centerZ: MESA.z, y, radiusX, radiusZ, index }),
);

const OASIS = lakeBasin({
  centerX: 9,
  centerZ: 17,
  radiusX: 4,
  radiusZ: 3,
  surfaceY: BODY.topY,
  depth: 1,
  liquidIndex: BLOCK.water,
  linerIndex: BLOCK.liner,
  rimIndex: BLOCK.rim,
  airIndex: BLOCK.air,
});

const SPIRES = [
  spire({
    x: 13,
    z: 6,
    baseY: 15,
    height: 10,
    radius: 1,
    index: BLOCK.cap,
    flareIndex: BLOCK.accent,
  }),
  spire({
    x: 15,
    z: 29,
    baseY: 15,
    height: 12,
    radius: 1,
    index: BLOCK.cap,
    flareIndex: BLOCK.accent,
  }),
];

// Cacti are plain solid columns, expressed as a feature cell table so they run
// in the same ordered pass as every other feature.
const CACTI = {
  cells: [
    { x: 6, z: 25, height: 3 },
    { x: 14, z: 24, height: 4 },
    { x: 5, z: 10, height: 3 },
    { x: 16, z: 11, height: 4 },
  ].flatMap(({ x, z, height }) =>
    Array.from({ length: height }, (unused, layer) => [
      x,
      BODY.topY + 1 + layer,
      z,
      BLOCK.trunk,
    ]),
  ),
  air: [],
  liquid: [],
  liner: [],
  spouts: [],
};

const CAVE = caveTube({
  path: [
    [12, 11, 25],
    [20, 10, 22],
    [28, 11, 26],
  ],
  radius: 1,
  roofDepth: 2,
  airIndex: BLOCK.air,
  body: BODY,
});

const MOUTH = caveMouth({
  x: 12,
  y: BODY.topY,
  z: 25,
  radius: 2,
  airIndex: BLOCK.air,
  body: BODY,
});

const CHASM = chasm({
  axis: "x",
  minX: 8,
  maxX: 30,
  centerZ: 30,
  width: 3,
  topY: BODY.topY,
  bottomY: 9,
  airIndex: BLOCK.air,
  body: BODY,
});

const BRIDGE = landBridge({
  fromX: 19,
  fromZ: 27,
  toX: 19,
  toZ: 33,
  y: BODY.topY + 1,
  width: 3,
  archDepth: 1,
  index: BLOCK.rim,
});

const FALL = rimFall({
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

export const island = defineTierIsland({
  id: "landmark_desert",
  family: "desert",
  tier: "landmark",
  size: SIZE,
  palette: KIT.palette,
  body: BODY,
  airIndex: BLOCK.air,
  // Probes sit one layer below the surface: the sand cap is a gravity block and
  // the oasis occupies the default -X surface probe.
  probes: [
    { x: BODY.centerX, y: 0, z: BODY.centerZ },
    { x: 6, y: 13, z: 25 },
    { x: 32, y: 13, z: 17 },
    { x: 19, y: 13, z: 5 },
    { x: 19, y: 13, z: 26 },
  ],
  liquidIndices: [BLOCK.water],
  linerIndices: [
    BLOCK.liner,
    BLOCK.rim,
    BLOCK.subsurface,
    BLOCK.accent,
    BLOCK.cap,
  ],
  strata: {
    core: BLOCK.core,
    subsurface: BLOCK.core,
    surface: BLOCK.subsurface,
  },
  orePockets: [
    orePocket({
      index: BLOCK.ore,
      minY: 3,
      maxY: 8,
      offsets: [
        [-10, 5],
        [-9, 5],
        [-9, 6],
        [8, -7],
        [9, -7],
        [9, -6],
      ],
    }),
  ],
  stamps: [
    supportedSurfaceStamp({ index: BLOCK.surface, y: BODY.topY, body: BODY }),
    scatterStamp({
      index: BLOCK.accent,
      y: BODY.topY,
      offsets: [
        [-15, 3],
        [-13, -6],
        [-11, 10],
        [13, -8],
        [3, -13],
        [-5, 13],
      ],
    }),
  ],
  features: [
    ...TERRACES,
    OASIS,
    ...SPIRES,
    CACTI,
    CAVE,
    MOUTH,
    CHASM,
    BRIDGE,
    FALL,
  ],
});
