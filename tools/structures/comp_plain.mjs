// Continent component: open plain. The common interior slot.
//
// Interior components are always placed with Rotation.None, which is what lets
// `duo_mesa` be byte-identical whether it is a continent interior part or a
// solo landmark-tier island.

import { foliageTree } from "./features/relief.mjs";
import {
  CBLOCK,
  CONTINENT_DATUM,
  INTERIOR_ROOT_PROFILE,
  cellFeature,
  continentSlab,
  defineContinentComponent,
} from "./continent_shared.mjs";

const SLAB = continentSlab({ rootProfile: INTERIOR_ROOT_PROFILE });

const ORE = cellFeature(
  [
    [6, 14, 7],
    [7, 14, 7],
    [6, 15, 7],
    [22, 13, 21],
    [23, 13, 21],
    [23, 14, 21],
  ].map(([x, y, z]) => [x, y, z, CBLOCK.ore]),
);

const GROVE = [
  { x: 7, z: 9, trunkHeight: 5 },
  { x: 11, z: 20, trunkHeight: 6 },
  { x: 20, z: 8, trunkHeight: 5 },
  { x: 24, z: 17, trunkHeight: 6 },
  { x: 17, z: 25, trunkHeight: 5 },
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

const OUTCROPS = cellFeature([
  [4, 21, 22, CBLOCK.rock],
  [5, 21, 22, CBLOCK.rock],
  [4, 21, 23, CBLOCK.rock],
  [5, 22, 22, CBLOCK.rock],
  [26, 21, 6, CBLOCK.rock],
  [25, 21, 6, CBLOCK.rock],
  [26, 21, 5, CBLOCK.rock],
  [14, 21, 13, CBLOCK.shore],
  [15, 21, 13, CBLOCK.shore],
  [14, 21, 14, CBLOCK.shore],
]);

export const island = defineContinentComponent({
  id: "comp_plain",
  role: "plain",
  budget: "interior",
  probes: [
    { x: 4, y: 13, z: 4 },
    { x: 25, y: 13, z: 4 },
    { x: 4, y: 13, z: 25 },
    { x: 25, y: 13, z: 25 },
    { x: 14, y: 13, z: 14 },
  ],
  features: [SLAB, ORE, ...GROVE, OUTCROPS],
});
