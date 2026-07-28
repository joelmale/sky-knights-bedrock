// Landmark tier, volcanic family, REACTIVE BURN variant. Selected by the
// burn_reactive gate, which is only consulted when the eternal gate did not
// fire, so this and `landmark_volcanic_ember` can never coincide.
//
// The island ships UNBURNT: a healthy oak grove inside a blackstone caldera,
// plus exactly two lava sources in sealed cups. The existing observer-driven
// generation loop guarantees a player is nearby when it is placed, so the burn
// is something a player watches happen.
//
// TERMINATION IS PROVED, NOT HOPED FOR. `assertPyreTermination` checks all four
// conditions at generation time:
//   (1) FINITE FUEL      - flammable cells counted directly, <= 260.
//   (2) CONTAINED FUEL   - every flammable cell inside the declared zone, and
//                          the zone walled and floored by >= 2 blocks of
//                          non-flammable rock on all four sides and below.
//   (3) SEALED IGNITION  - exactly 2 lava cells, each lined on -X/+X/-Z/+Z/-Y
//                          with force-cleared air only on +Y. Lava that cannot
//                          flow cannot spread, cannot make new lava, and can
//                          only ignite across the one gap it was aimed at.
//   (4) NO REIGNITION    - the palette carries NO netherrack, soul soil, soul
//                          sand, or magma. Bedrock fire needs a flammable
//                          neighbour or an eternal substrate to persist; once
//                          the last log is consumed neither exists, so every
//                          fire block goes out on its next tick.
// End state: bare blackstone, two sealed lava cups, no fire, no block updates.
//
// RUNTIME RULE, CRITICAL. Every integrity probe below targets a core blackstone
// cell the fire can never reach. A probe on a log or a leaf would fail
// post-burn verification, the job would look retryable, and the service would
// re-place the structure - resurrecting the grove and re-running the burn
// forever. `assertProbeIsStable` and the flammable-index guard in
// `tier_shared.mjs` are what stop that from ever shipping.

import { orePocket, scatterStamp } from "./shape.mjs";
import { pyreFuel } from "./features/burn.mjs";
import { mesaStep, spire } from "./features/relief.mjs";
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
  "minecraft:grass_block",
  "minecraft:dirt",
  "minecraft:polished_blackstone",
  "minecraft:stone",
  "minecraft:oak_log",
  "minecraft:oak_leaves",
  "minecraft:gold_ore",
  "minecraft:lava",
  "minecraft:air",
];
const BLOCK = {
  core: 0,
  subsurface: 1,
  surface: 2,
  soil: 3,
  cap: 4,
  liner: 5,
  trunk: 6,
  leaves: 7,
  ore: 8,
  lava: 9,
  air: 10,
};

const ZONE = { minX: 12, maxX: 26, minY: 15, maxY: 19, minZ: 11, maxZ: 23 };
const FUEL_BUDGET = 260;

// The caldera wall. `mesaStep` with inner radii emits a ring, so the interior
// is simply never written and stays -1 instead of costing force-clear air.
const CALDERA = [15, 16, 17, 18, 19].map((y, layer) =>
  mesaStep({
    centerX: BODY.centerX,
    centerZ: BODY.centerZ,
    y,
    radiusX: 13,
    radiusZ: 12,
    innerRadiusX: 7,
    innerRadiusZ: 6,
    index: layer >= 3 ? BLOCK.cap : BLOCK.core,
  }),
);

const SPIRES = [
  spire({
    x: 5,
    z: 17,
    baseY: 15,
    height: 12,
    radius: 1,
    index: BLOCK.core,
    flareIndex: BLOCK.subsurface,
  }),
  spire({
    x: 33,
    z: 17,
    baseY: 15,
    height: 10,
    radius: 1,
    index: BLOCK.core,
    flareIndex: BLOCK.subsurface,
  }),
];

// The two trees at x 15 and x 23 are the ignition pair: the cup liner overwrites
// their base cell, so each trunk starts one layer up, directly beside the single
// force-cleared cell above its lava source.
const FUEL = pyreFuel({
  zone: ZONE,
  trees: [
    { x: 15, z: 17, height: 4 },
    { x: 23, z: 17, height: 4 },
    { x: 17, z: 13, height: 4 },
    { x: 21, z: 13, height: 4 },
    { x: 17, z: 21, height: 4 },
    { x: 21, z: 21, height: 4 },
    { x: 14, z: 20, height: 4 },
    { x: 24, z: 14, height: 4 },
    { x: 19, z: 12, height: 4 },
    { x: 19, z: 22, height: 4 },
  ],
  lavaCups: [
    { x: 14, y: 15, z: 17 },
    { x: 24, y: 15, z: 17 },
  ],
  fuelBudget: FUEL_BUDGET,
  logIndex: BLOCK.trunk,
  leafIndex: BLOCK.leaves,
  lavaIndex: BLOCK.lava,
  linerIndex: BLOCK.liner,
  airIndex: BLOCK.air,
});

export const island = defineTierIsland({
  id: "landmark_volcanic_pyre",
  family: "volcanic",
  tier: "landmark",
  size: SIZE,
  palette: PALETTE,
  body: BODY,
  airIndex: BLOCK.air,
  flammableIndices: [BLOCK.trunk, BLOCK.leaves],
  leafIndex: BLOCK.leaves,
  logIndex: BLOCK.trunk,
  liquidIndices: [BLOCK.lava],
  linerIndices: [BLOCK.liner, BLOCK.cap, BLOCK.core, BLOCK.subsurface],
  pyre: { zone: ZONE, fuelBudget: FUEL_BUDGET, lavaIndex: BLOCK.lava },
  probes: [
    { x: BODY.centerX, y: 0, z: BODY.centerZ },
    { x: BODY.centerX, y: 8, z: BODY.centerZ },
    { x: 10, y: 10, z: 17 },
    { x: 28, y: 10, z: 17 },
    { x: 19, y: 10, z: 26 },
  ],
  strata: {
    core: BLOCK.core,
    subsurface: BLOCK.soil,
    surface: BLOCK.surface,
  },
  orePockets: [
    orePocket({
      index: BLOCK.ore,
      minY: 3,
      maxY: 8,
      offsets: [
        [-10, 3],
        [-9, 3],
        [-9, 4],
        [9, -8],
        [10, -8],
        [10, -7],
      ],
    }),
  ],
  stamps: [
    scatterStamp({
      index: BLOCK.subsurface,
      y: BODY.topY,
      offsets: [
        [-16, 1],
        [-14, -7],
        [-12, 10],
        [14, 6],
        [15, -3],
        [2, 14],
        [-4, -13],
      ],
    }),
  ],
  features: [...SPIRES, ...CALDERA, FUEL],
});
