// Crag tier, volcanic family, ETERNAL BURN variant. Selected by the
// burn_eternal gate; never coincides with the reactive pyre.
//
// WHY THIS IS SAFE, STATED RATHER THAN ASSUMED
//   * `minecraft:fire` sits directly on `minecraft:netherrack`. Vanilla
//     netherrack fire never extinguishes and never consumes its substrate, so
//     the island looks identical to every visitor who ever arrives and costs
//     zero ongoing block updates.
//   * Bedrock spreads fire only to flammable blocks within |dx|,|dz| <= 1 and
//     dy in -1..4. `assertFireSafety` enforces a strictly larger ring
//     (|dx|,|dz| <= 4, dy in -2..5) between every fire cell and every oak cell,
//     and throws at generation time if the layout ever violates it.
//   * Every island in this world is surrounded on all six sides by void, and
//     the planner's clearance invariant guarantees at least 12 blocks of empty
//     air to the nearest neighbour. Fire has no path off this structure.
//
// The layout is the point: an ember field burning on the low-X lobe, a green
// grove on the high-X lobe, and a wide basalt saddle between them. Read from
// the air it is a burning half and a living half, permanently.

import { orePocket, scatterStamp } from "./shape.mjs";
import { caveTube } from "./features/carve.mjs";
import { emberField } from "./features/burn.mjs";
import { foliageTree, mountainPeak, spire } from "./features/relief.mjs";
import { TIER_GEOMETRY, cragBody, defineTierIsland } from "./tier_shared.mjs";

const SIZE = TIER_GEOMETRY.crag.size;
const BODY = cragBody();

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
  fire: 9,
  air: 10,
};

// Ember lobe: x 2..6 only, which keeps every fire cell at least 10 blocks in X
// from the nearest oak on the far lobe.
const EMBER_CELLS = [
  [2, 8],
  [2, 10],
  [2, 12],
  [3, 7],
  [3, 9],
  [3, 11],
  [3, 13],
  [4, 6],
  [4, 8],
  [4, 10],
  [4, 12],
  [4, 14],
  [5, 7],
  [5, 9],
  [5, 11],
  [5, 13],
  [6, 8],
  [6, 10],
  [6, 12],
];

const EMBER = emberField({
  cells: EMBER_CELLS,
  surfaceY: BODY.topY,
  netherrackIndex: BLOCK.surface,
  fireIndex: BLOCK.fire,
});

const PEAK = mountainPeak({
  centerX: BODY.centerX,
  centerZ: BODY.centerZ,
  baseY: 10,
  height: 7,
  baseRadius: 4,
  coreIndex: BLOCK.subsurface,
  capIndex: BLOCK.cap,
  capDepth: 2,
});

const SPIRE = spire({
  x: 12,
  z: 16,
  baseY: 10,
  height: 6,
  radius: 1,
  index: BLOCK.core,
  flareIndex: BLOCK.subsurface,
});

// Living lobe: x 16..19, more than four blocks clear of every ember cell.
const GROVE = [
  { x: 17, z: 7, trunkHeight: 4 },
  { x: 18, z: 12, trunkHeight: 5 },
  { x: 16, z: 15, trunkHeight: 4 },
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
    [7, 5, 10],
    [11, 5, 10],
    [15, 4, 10],
  ],
  radius: 1,
  roofDepth: 2,
  airIndex: BLOCK.air,
  body: BODY,
});

export const island = defineTierIsland({
  id: "crag_volcanic_ember",
  family: "volcanic",
  tier: "crag",
  size: SIZE,
  palette: PALETTE,
  body: BODY,
  airIndex: BLOCK.air,
  fireIndex: BLOCK.fire,
  flammableIndices: [BLOCK.trunk, BLOCK.leaves],
  leafIndex: BLOCK.leaves,
  logIndex: BLOCK.trunk,
  strata: {
    core: BLOCK.core,
    subsurface: BLOCK.subsurface,
    surface: BLOCK.subsurface,
  },
  orePockets: [
    orePocket({
      index: BLOCK.ore,
      minY: 2,
      maxY: 5,
      offsets: [
        [-3, 3],
        [-2, 3],
        [3, -3],
        [4, -3],
      ],
    }),
  ],
  stamps: [
    scatterStamp({
      index: BLOCK.loam,
      y: BODY.topY,
      offsets: [
        [5, -3],
        [6, 2],
        [7, -1],
        [5, 5],
        [4, 0],
      ],
    }),
    scatterStamp({
      index: BLOCK.accent,
      y: BODY.topY,
      offsets: [
        [-8, -1],
        [-8, 3],
        [8, -4],
      ],
    }),
  ],
  features: [SPIRE, PEAK, ...GROVE, CAVE, EMBER],
});
