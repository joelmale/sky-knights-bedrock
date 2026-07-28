// Landmark tier, volcanic family, ETERNAL BURN variant. Selected by the
// burn_eternal gate, which is evaluated before the reactive gate, so this
// structure and `landmark_volcanic_pyre` can never both be chosen for a cell.
//
// The island is split into two lobes with a wide blackstone saddle between:
//   x  3..10  ember field - minecraft:fire on minecraft:netherrack, which in
//             vanilla never extinguishes and never consumes its substrate. A
//             fire block on netherrack has no scheduled state change and no
//             neighbour it can spread to, so this costs ZERO ongoing block
//             updates once placed.
//   x 28..35  living oak grove.
//
// `assertFireSafety` proves at generation time that no flammable cell lies
// within |dx| <= 4, |dz| <= 4, -2 <= dy <= 5 of any fire cell - strictly larger
// than Bedrock's own spread neighbourhood of |dx|,|dz| <= 1 and dy in -1..4.
// The saddle here is 18 blocks wide, so the guard holds with enormous margin.
//
// INTEGRITY PROBES target blackstone and basalt core cells only. Never fire:
// its block state ticks and the probe would be flaky.

import { orePocket, scatterStamp } from "./shape.mjs";
import { caveMouth, caveTube } from "./features/carve.mjs";
import { emberField } from "./features/burn.mjs";
import { foliageTree, mountainPeak, spire } from "./features/relief.mjs";
import {
  TIER_GEOMETRY,
  defineTierIsland,
  landmarkBody,
} from "./tier_shared.mjs";

const SIZE = TIER_GEOMETRY.landmark.size;
const BODY = landmarkBody();

const PALETTE = [
  "minecraft:blackstone",
  "minecraft:basalt",
  "minecraft:netherrack",
  "minecraft:magma",
  "minecraft:polished_blackstone",
  "minecraft:gold_ore",
  "minecraft:oak_log",
  "minecraft:oak_leaves",
  "minecraft:grass_block",
  "minecraft:dirt",
  "minecraft:fire",
  "minecraft:air",
];
const BLOCK = {
  core: 0,
  subsurface: 1,
  surface: 2,
  accent: 3,
  cap: 4,
  ore: 5,
  trunk: 6,
  leaves: 7,
  loam: 8,
  soil: 9,
  fire: 10,
  air: 11,
};

const EMBER = emberField({
  cells: [
    [3, 15],
    [3, 17],
    [3, 19],
    [4, 12],
    [4, 14],
    [4, 16],
    [4, 18],
    [4, 20],
    [4, 22],
    [5, 11],
    [5, 13],
    [5, 15],
    [5, 17],
    [5, 19],
    [5, 21],
    [5, 23],
    [6, 10],
    [6, 12],
    [6, 14],
    [6, 16],
    [6, 18],
    [6, 20],
    [6, 22],
    [6, 24],
    [7, 11],
    [7, 13],
    [7, 15],
    [7, 17],
    [7, 19],
    [7, 21],
    [7, 23],
    [8, 12],
    [8, 14],
    [8, 16],
    [8, 18],
    [8, 20],
    [8, 22],
    [9, 13],
    [9, 15],
    [9, 17],
    [9, 19],
    [9, 21],
    [10, 15],
    [10, 17],
    [10, 19],
  ],
  surfaceY: BODY.topY,
  netherrackIndex: BLOCK.surface,
  fireIndex: BLOCK.fire,
});

const PEAK = mountainPeak({
  centerX: 20,
  centerZ: BODY.centerZ,
  baseY: 15,
  height: 13,
  emitLayers: 8,
  baseRadius: 8,
  coreIndex: BLOCK.subsurface,
  capIndex: BLOCK.cap,
  capDepth: 2,
});

const SPIRES = [
  spire({
    x: 19,
    z: 30,
    baseY: 15,
    height: 12,
    radius: 1,
    index: BLOCK.core,
    flareIndex: BLOCK.subsurface,
  }),
  spire({
    x: 19,
    z: 4,
    baseY: 15,
    height: 10,
    radius: 1,
    index: BLOCK.core,
    flareIndex: BLOCK.subsurface,
  }),
];

const GROVE = [
  { x: 30, z: 12, trunkHeight: 6 },
  { x: 33, z: 18, trunkHeight: 5 },
  { x: 30, z: 24, trunkHeight: 6 },
  { x: 29, z: 18, trunkHeight: 4 },
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
    [13, 11, 24],
    [21, 10, 26],
    [28, 11, 23],
  ],
  radius: 1,
  roofDepth: 2,
  airIndex: BLOCK.air,
  body: BODY,
});

const MOUTH = caveMouth({
  x: 13,
  y: BODY.topY,
  z: 24,
  radius: 2,
  airIndex: BLOCK.air,
  body: BODY,
});

export const island = defineTierIsland({
  id: "landmark_volcanic_ember",
  family: "volcanic",
  tier: "landmark",
  size: SIZE,
  palette: PALETTE,
  body: BODY,
  airIndex: BLOCK.air,
  fireIndex: BLOCK.fire,
  flammableIndices: [BLOCK.trunk, BLOCK.leaves],
  leafIndex: BLOCK.leaves,
  logIndex: BLOCK.trunk,
  probes: [
    { x: BODY.centerX, y: 0, z: BODY.centerZ },
    { x: 19, y: 13, z: 17 },
    { x: 26, y: 13, z: 10 },
    { x: 12, y: 13, z: 29 },
    { x: 19, y: 13, z: 31 },
  ],
  strata: {
    core: BLOCK.core,
    subsurface: BLOCK.subsurface,
    surface: BLOCK.subsurface,
  },
  orePockets: [
    orePocket({
      index: BLOCK.ore,
      minY: 3,
      maxY: 8,
      offsets: [
        [-9, -6],
        [-8, -6],
        [-8, -5],
        [9, 4],
        [10, 4],
        [10, 5],
      ],
    }),
  ],
  stamps: [
    scatterStamp({
      index: BLOCK.loam,
      y: BODY.topY,
      offsets: [
        [10, -5],
        [11, 1],
        [12, 7],
        [14, -1],
        [9, 3],
        [13, 3],
      ],
    }),
    scatterStamp({
      index: BLOCK.accent,
      y: BODY.topY,
      offsets: [
        [-15, 1],
        [-13, -7],
        [-11, 9],
      ],
    }),
  ],
  features: [...SPIRES, PEAK, ...GROVE, CAVE, MOUTH, EMBER],
});
