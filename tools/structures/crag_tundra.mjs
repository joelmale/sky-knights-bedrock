// Crag tier, tundra family: a snow-capped horn over packed ice, with a
// meltwater fall off the eastern rim.

import { orePocket, scatterStamp } from "./shape.mjs";
import { caveTube } from "./features/carve.mjs";
import { rimFall } from "./features/fall.mjs";
import { foliageTree, mountainPeak, spire } from "./features/relief.mjs";
import {
  FAMILY_KITS,
  TIER_GEOMETRY,
  cragBody,
  defineTierIsland,
} from "./tier_shared.mjs";

const KIT = FAMILY_KITS.tundra;
const BLOCK = KIT.block;
const SIZE = TIER_GEOMETRY.crag.size;
const BODY = cragBody();

const PEAK = mountainPeak({
  centerX: BODY.centerX,
  centerZ: BODY.centerZ,
  baseY: 10,
  height: 8,
  baseRadius: 5,
  coreIndex: BLOCK.subsurface,
  capIndex: BLOCK.surface,
  capDepth: 3,
});

const SPIRES = [
  spire({
    x: 6,
    z: 14,
    baseY: 10,
    height: 8,
    radius: 1,
    index: BLOCK.accent,
    flareIndex: BLOCK.subsurface,
  }),
  spire({
    x: 16,
    z: 6,
    baseY: 10,
    height: 6,
    radius: 1,
    index: BLOCK.accent,
    flareIndex: BLOCK.subsurface,
  }),
];

const GROVE = [
  { x: 5, z: 6, trunkHeight: 5 },
  { x: 17, z: 15, trunkHeight: 4 },
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
    [6, 4, 6],
    [11, 5, 10],
    [16, 4, 14],
  ],
  radius: 1,
  roofDepth: 2,
  airIndex: BLOCK.air,
  body: BODY,
});

const FALL = rimFall({
  spoutX: 20,
  spoutZ: 15,
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
  id: "crag_tundra",
  family: "tundra",
  tier: "crag",
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
      minY: 2,
      maxY: 5,
      offsets: [
        [-5, -2],
        [-4, -2],
        [4, 3],
        [5, 3],
      ],
    }),
  ],
  stamps: [
    scatterStamp({
      index: BLOCK.accent,
      y: BODY.topY,
      offsets: [
        [-8, 1],
        [-6, -4],
        [7, 3],
        [8, -2],
        [1, -7],
        [-2, 7],
      ],
    }),
  ],
  features: [...SPIRES, PEAK, ...GROVE, CAVE, FALL],
});
