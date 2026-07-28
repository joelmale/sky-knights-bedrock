// Landmark tier, volcanic family: a truncated cone with a sealed lava tarn in
// its crater and one bounded lavafall off the eastern rim.
//
// This is the BASE volcanic landmark. `landmark_volcanic_ember` (eternal burn)
// and `landmark_volcanic_pyre` (reactive burn) are separate structures selected
// by the burn gates; the gates are evaluated eternal-first, so no cell can ever
// resolve to two of these three.

import { orePocket, scatterStamp } from "./shape.mjs";
import { landBridge } from "./features/bridge.mjs";
import { caveMouth, caveTube, chasm } from "./features/carve.mjs";
import { rimFall } from "./features/fall.mjs";
import { lakeBasin } from "./features/lake.mjs";
import { mountainPeak, spire } from "./features/relief.mjs";
import {
  FAMILY_KITS,
  TIER_GEOMETRY,
  defineTierIsland,
  landmarkBody,
} from "./tier_shared.mjs";

const KIT = FAMILY_KITS.volcanic;
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
  capIndex: BLOCK.cap,
  capDepth: 2,
});

// Magma-lined over blackstone, as the spec's liner restrictions require: no
// gravity block may ever line a basin, and lava basins line with magma.
const CRATER = lakeBasin({
  centerX: BODY.centerX,
  centerZ: BODY.centerZ,
  radiusX: 3,
  radiusZ: 2,
  surfaceY: SUMMIT_Y,
  depth: 2,
  liquidIndex: BLOCK.lava,
  linerIndex: BLOCK.liner,
  airIndex: BLOCK.air,
});

const SPIRES = [
  spire({
    x: 9,
    z: 11,
    baseY: 15,
    height: 14,
    radius: 1,
    index: BLOCK.core,
    flareIndex: BLOCK.subsurface,
  }),
  spire({
    x: 29,
    z: 25,
    baseY: 15,
    height: 11,
    radius: 1,
    index: BLOCK.core,
    flareIndex: BLOCK.subsurface,
  }),
  spire({
    x: 20,
    z: 30,
    baseY: 15,
    height: 13,
    radius: 2,
    index: BLOCK.core,
    flareIndex: BLOCK.subsurface,
  }),
];

const GROWTH = {
  cells: [
    { x: 12, z: 25, height: 4 },
    { x: 27, z: 9, height: 5 },
    { x: 30, z: 17, height: 4 },
  ].flatMap(({ x, z, height }) => [
    ...Array.from({ length: height }, (unused, layer) => [
      x,
      BODY.topY + 1 + layer,
      z,
      BLOCK.trunk,
    ]),
    [x, BODY.topY + height + 1, z, BLOCK.leaves],
  ]),
  air: [],
  liquid: [],
  liner: [],
  spouts: [],
};

const CAVE = caveTube({
  path: [
    [10, 11, 20],
    [19, 10, 24],
    [28, 11, 20],
  ],
  radius: 1,
  roofDepth: 2,
  airIndex: BLOCK.air,
  body: BODY,
});

const MOUTH = caveMouth({
  x: 10,
  y: BODY.topY,
  z: 20,
  radius: 2,
  airIndex: BLOCK.air,
  body: BODY,
});

const CHASM = chasm({
  axis: "z",
  centerX: 28,
  minZ: 7,
  maxZ: 27,
  width: 3,
  topY: BODY.topY,
  bottomY: 8,
  airIndex: BLOCK.air,
  body: BODY,
});

const BRIDGE = landBridge({
  fromX: 24,
  fromZ: 12,
  toX: 33,
  toZ: 12,
  y: BODY.topY + 1,
  width: 3,
  archDepth: 1,
  index: BLOCK.cap,
});

const FALL = rimFall({
  spoutX: 36,
  spoutZ: 21,
  surfaceY: BODY.topY,
  spillType: "bounded",
  liquid: "lava",
  liquidIndex: BLOCK.lava,
  linerIndex: BLOCK.liner,
  airIndex: BLOCK.air,
  outward: [1, 0],
  body: BODY,
});

export const island = defineTierIsland({
  id: "landmark_volcanic",
  family: "volcanic",
  tier: "landmark",
  size: SIZE,
  palette: KIT.palette,
  body: BODY,
  airIndex: BLOCK.air,
  liquidIndices: [BLOCK.lava],
  linerIndices: [BLOCK.liner, BLOCK.core, BLOCK.subsurface, BLOCK.cap],
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
        [-9, 6],
        [-8, 6],
        [-8, 7],
        [9, -5],
        [10, -5],
        [10, -4],
      ],
    }),
  ],
  stamps: [
    scatterStamp({
      index: BLOCK.accent,
      y: BODY.topY,
      offsets: [
        [-15, 2],
        [-12, -8],
        [-10, 10],
        [13, 7],
        [14, -4],
        [3, 13],
        [-3, -12],
        [7, -11],
      ],
    }),
  ],
  features: [...SPIRES, PEAK, CRATER, GROWTH, CAVE, MOUTH, CHASM, BRIDGE, FALL],
});
