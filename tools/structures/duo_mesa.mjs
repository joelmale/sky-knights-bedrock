// THE dual-purpose module.
//
// As a continent interior component it honours the full seam contract. As a
// solo landmark-tier island the planner simply places it alone: the seam shell
// reads as a clean cliff wall on all four sides, which is exactly why the seam
// profile terminates in a solid vertical face rather than in a ragged edge.
//
// Both forms are the SAME bytes. Interior components are always placed with
// Rotation.None, so nothing about the component form can diverge from the solo
// form. Solo planner values: clearanceRadius 28, heightRadius 24, dockY 21.

import { mesaStep, spire } from "./features/relief.mjs";
import {
  CBLOCK,
  CONTINENT_DATUM,
  INTERIOR_ROOT_PROFILE,
  cellFeature,
  continentSlab,
  defineContinentComponent,
} from "./continent_shared.mjs";

const SLAB = continentSlab({ rootProfile: INTERIOR_ROOT_PROFILE });

const TERRACES = [
  { y: 21, radiusX: 10, radiusZ: 9, index: CBLOCK.shore },
  { y: 22, radiusX: 9, radiusZ: 8, index: CBLOCK.rock },
  { y: 23, radiusX: 8, radiusZ: 7, index: CBLOCK.rock },
  { y: 24, radiusX: 7, radiusZ: 6, index: CBLOCK.shore },
  { y: 25, radiusX: 6, radiusZ: 5, index: CBLOCK.rock },
  { y: 26, radiusX: 5, radiusZ: 4, index: CBLOCK.rock },
  { y: 27, radiusX: 4, radiusZ: 3, index: CBLOCK.shore },
  { y: 28, radiusX: 3, radiusZ: 2, index: CBLOCK.rock },
].map(({ y, radiusX, radiusZ, index }) =>
  mesaStep({ centerX: 14, centerZ: 14, y, radiusX, radiusZ, index }),
);

const SPIRES = [
  spire({
    x: 5,
    z: 8,
    baseY: CONTINENT_DATUM.surfaceY + 1,
    height: 9,
    radius: 1,
    index: CBLOCK.rock,
    flareIndex: CBLOCK.core,
  }),
  spire({
    x: 25,
    z: 22,
    baseY: CONTINENT_DATUM.surfaceY + 1,
    height: 11,
    radius: 1,
    index: CBLOCK.rock,
    flareIndex: CBLOCK.core,
  }),
];

const ORE = cellFeature(
  [
    [6, 14, 22],
    [7, 14, 22],
    [7, 15, 22],
    [23, 13, 7],
    [22, 13, 7],
    [22, 14, 7],
  ].map(([x, y, z]) => [x, y, z, CBLOCK.ore]),
);

export const island = defineContinentComponent({
  id: "duo_mesa",
  role: "mesa",
  budget: "interior",
  probes: [
    { x: 4, y: 13, z: 4 },
    { x: 25, y: 13, z: 4 },
    { x: 4, y: 13, z: 25 },
    { x: 25, y: 13, z: 25 },
    { x: 14, y: 13, z: 14 },
  ],
  features: [SLAB, ORE, ...SPIRES, ...TERRACES],
});
