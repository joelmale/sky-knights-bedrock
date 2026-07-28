// Crag tier, volcanic family: a basalt cone with a bounded lavafall.
//
// This is the BASE volcanic crag. The eternal-burn variant lives in
// `crag_volcanic_ember.mjs` and is selected by the burn_eternal gate; the two
// are never both chosen for the same cell.
//
// Lava rim falls are always bounded, never void: overworld lava spreads on a
// 30-tick cycle, so a void lava fall costs orders of magnitude more settle work
// than water for no extra drama.

import { orePocket, scatterStamp } from "./shape.mjs";
import { caveTube } from "./features/carve.mjs";
import { rimFall } from "./features/fall.mjs";
import { mountainPeak, spire } from "./features/relief.mjs";
import {
  FAMILY_KITS,
  TIER_GEOMETRY,
  cragBody,
  defineTierIsland,
} from "./tier_shared.mjs";

const KIT = FAMILY_KITS.volcanic;
const BLOCK = KIT.block;
const SIZE = TIER_GEOMETRY.crag.size;
const BODY = cragBody();

const PEAK = mountainPeak({
  centerX: BODY.centerX,
  centerZ: BODY.centerZ,
  baseY: 10,
  height: 7,
  baseRadius: 5,
  coreIndex: BLOCK.subsurface,
  capIndex: BLOCK.cap,
  capDepth: 2,
});

const SPIRES = [
  spire({
    x: 5,
    z: 13,
    baseY: 10,
    height: 6,
    radius: 1,
    index: BLOCK.core,
    flareIndex: BLOCK.subsurface,
  }),
  spire({
    x: 17,
    z: 7,
    baseY: 10,
    height: 8,
    radius: 1,
    index: BLOCK.core,
    flareIndex: BLOCK.subsurface,
  }),
];

const CAVE = caveTube({
  path: [
    [6, 5, 8],
    [11, 5, 10],
    [16, 4, 12],
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
  liquid: "lava",
  liquidIndex: BLOCK.lava,
  linerIndex: BLOCK.liner,
  airIndex: BLOCK.air,
  outward: [1, 0],
  body: BODY,
});

export const island = defineTierIsland({
  id: "crag_volcanic",
  family: "volcanic",
  tier: "crag",
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
      minY: 2,
      maxY: 5,
      offsets: [
        [-5, 1],
        [-4, 1],
        [4, -2],
        [5, -2],
      ],
    }),
  ],
  stamps: [
    scatterStamp({
      index: BLOCK.accent,
      y: BODY.topY,
      offsets: [
        [-8, -2],
        [-6, 4],
        [7, 4],
        [8, -1],
        [-1, -7],
        [2, 7],
      ],
    }),
  ],
  features: [...SPIRES, PEAK, CAVE, FALL],
});
