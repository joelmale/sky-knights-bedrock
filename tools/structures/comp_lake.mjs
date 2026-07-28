// Continent component: a sealed inland lake carved down from the surface datum
// into the 8-layer core slab, leaving four layers of slab below the floor. It is
// sealed by construction rather than by luck, and `assertSealedBasin` proves it.

import { foliageTree } from "./features/relief.mjs";
import { lakeBasin } from "./features/lake.mjs";
import {
  CBLOCK,
  CONTINENT_DATUM,
  INTERIOR_ROOT_PROFILE,
  cellFeature,
  continentSlab,
  defineContinentComponent,
} from "./continent_shared.mjs";

const SLAB = continentSlab({ rootProfile: INTERIOR_ROOT_PROFILE });

// radiusX 6 / radiusZ 5 / depth 2 rather than the spec's 8x7x4: an 8x7x4 basin
// is 880 liquid cells and the continent-interior liquid ceiling is 420.
const LAKE = lakeBasin({
  centerX: 14,
  centerZ: 14,
  radiusX: 6,
  radiusZ: 5,
  surfaceY: CONTINENT_DATUM.surfaceY,
  depth: 2,
  liquidIndex: CBLOCK.water,
  linerIndex: CBLOCK.liner,
  rimIndex: CBLOCK.shore,
  airIndex: CBLOCK.air,
});

const GROVE = [
  { x: 5, z: 6, trunkHeight: 5 },
  { x: 24, z: 7, trunkHeight: 6 },
  { x: 6, z: 24, trunkHeight: 6 },
  { x: 25, z: 23, trunkHeight: 5 },
].map(({ x, z, trunkHeight }) =>
  foliageTree({
    x,
    z,
    baseY: CONTINENT_DATUM.surfaceY + 1,
    trunkHeight,
    trunkIndex: CBLOCK.trunk,
    leafIndex: CBLOCK.leaves,
  }),
);

const SHORE = cellFeature(
  [
    [14, 5],
    [15, 5],
    [13, 5],
    [14, 23],
    [15, 23],
    [13, 23],
    [5, 14],
    [5, 15],
    [23, 14],
    [23, 13],
  ].map(([x, z]) => [x, CONTINENT_DATUM.surfaceY, z, CBLOCK.shore]),
);

export const island = defineContinentComponent({
  id: "comp_lake",
  role: "lake",
  budget: "interior",
  hasLake: true,
  liquidIndices: [CBLOCK.water],
  linerIndices: [CBLOCK.liner, CBLOCK.shore, CBLOCK.core, CBLOCK.subsurface],
  probes: [
    { x: 4, y: 13, z: 4 },
    { x: 25, y: 13, z: 4 },
    { x: 4, y: 13, z: 25 },
    { x: 25, y: 13, z: 25 },
    { x: 14, y: 13, z: 14 },
  ],
  features: [SLAB, SHORE, LAKE, ...GROVE],
});
