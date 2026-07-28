// Crag tier, verdant family: a peaked, cave-bored bluff with a rim waterfall.
//
// The crag body stops at topY 9 instead of the canonical 13, which frees eight
// layers (y 10..17) for positive relief. That headroom is the whole point of
// the tier: a crag has to read as a mountain from the air, not as a large
// standard island.

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

const KIT = FAMILY_KITS.verdant;
const BLOCK = KIT.block;
const SIZE = TIER_GEOMETRY.crag.size;
const BODY = cragBody();

const PEAK = mountainPeak({
  centerX: BODY.centerX,
  centerZ: BODY.centerZ,
  baseY: 10,
  height: 7,
  baseRadius: 5,
  coreIndex: BLOCK.core,
  capIndex: BLOCK.cap,
  capDepth: 2,
});

const SPIRES = [
  spire({
    x: 5,
    z: 6,
    baseY: 10,
    height: 7,
    radius: 1,
    index: BLOCK.cap,
    flareIndex: BLOCK.core,
  }),
  spire({
    x: 17,
    z: 14,
    baseY: 10,
    height: 5,
    radius: 1,
    index: BLOCK.cap,
    flareIndex: BLOCK.core,
  }),
];

const CAVE = caveTube({
  path: [
    [5, 4, 10],
    [11, 5, 10],
    [17, 4, 10],
  ],
  radius: 1,
  roofDepth: 2,
  airIndex: BLOCK.air,
  body: BODY,
});

const GROVE = [
  { x: 5, z: 15, trunkHeight: 4 },
  { x: 16, z: 5, trunkHeight: 5 },
  { x: 8, z: 3, trunkHeight: 4 },
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
  id: "crag_verdant",
  family: "verdant",
  tier: "crag",
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
      minY: 2,
      maxY: 5,
      offsets: [
        [-4, 2],
        [-3, 2],
        [5, -3],
        [5, -2],
      ],
    }),
  ],
  stamps: [
    scatterStamp({
      index: BLOCK.accent,
      y: BODY.topY,
      offsets: [
        [-8, 0],
        [-7, 3],
        [7, -4],
        [8, 2],
        [0, -7],
        [3, 7],
      ],
    }),
  ],
  features: [...SPIRES, PEAK, ...GROVE, CAVE, FALL],
});
