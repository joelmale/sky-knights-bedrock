// Continent component: the continental massif. Always occupies the centre slot
// (2, 2) of the 5x5 grid, so every continent has exactly one of these and it is
// always in the middle.

import { mountainPeak, spire } from "./features/relief.mjs";
import {
  CBLOCK,
  CONTINENT_DATUM,
  INTERIOR_ROOT_PROFILE,
  cellFeature,
  continentSlab,
  defineContinentComponent,
} from "./continent_shared.mjs";

const SLAB = continentSlab({ rootProfile: INTERIOR_ROOT_PROFILE });

// baseRadius 8 / height 16 rather than the spec's 11 / 14..18: an 11-radius
// massif is ~2500 solid blocks on top of a ~9340-block slab, which breaks the
// 11000 per-component ceiling that keeps any single place() call bounded.
const MASSIF = mountainPeak({
  centerX: 14,
  centerZ: 14,
  baseY: CONTINENT_DATUM.surfaceY + 1,
  height: 16,
  baseRadius: 8,
  coreIndex: CBLOCK.core,
  capIndex: CBLOCK.rock,
  capDepth: 4,
});

const SPIRES = [
  spire({
    x: 5,
    z: 22,
    baseY: CONTINENT_DATUM.surfaceY + 1,
    height: 10,
    radius: 1,
    index: CBLOCK.rock,
    flareIndex: CBLOCK.core,
  }),
  spire({
    x: 24,
    z: 6,
    baseY: CONTINENT_DATUM.surfaceY + 1,
    height: 8,
    radius: 1,
    index: CBLOCK.rock,
    flareIndex: CBLOCK.core,
  }),
];

const ORE = cellFeature(
  [
    [5, 14, 8],
    [6, 14, 8],
    [6, 15, 8],
    [24, 13, 20],
    [23, 13, 20],
    [23, 14, 20],
  ].map(([x, y, z]) => [x, y, z, CBLOCK.ore]),
);

export const island = defineContinentComponent({
  id: "comp_ridge",
  role: "ridge",
  budget: "interior",
  probes: [
    { x: 4, y: 13, z: 4 },
    { x: 25, y: 13, z: 4 },
    { x: 4, y: 13, z: 25 },
    { x: 25, y: 13, z: 25 },
    { x: 14, y: 13, z: 14 },
  ],
  features: [SLAB, ORE, ...SPIRES, MASSIF],
});
