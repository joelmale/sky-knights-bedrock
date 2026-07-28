// Continent component: the outer ring edge.
//
// The local -Z border is the OUTWARD (coast) face; +Z, -X and +X use the
// interior seam profile. The footprint is square, so rotation about the
// structure origin maps it onto itself exactly and one module serves all twelve
// edge slots: j==0 -> Rotate180, j==4 -> None, i==0 -> Rotate90, i==4 ->
// Rotate270.
//
// The rim taper is what makes a coast read as a coast: the core slab thins from
// nine layers inland to two at the shoreline, so the frozen shell at z=0 stands
// as an undercut cliff rather than as the blunt end of a slab.
//
// NO RIM WATERFALL. The spec asks for a bounded fall on up to three coast slots,
// but a fall off the coast face would have to cut its notch and run its column
// through the frozen border shell, which RULE 4 forbids without exception. See
// SPEC DEVIATIONS in the handoff.

import { foliageTree } from "./features/relief.mjs";
import {
  CBLOCK,
  COAST_ROOT_PROFILE,
  CONTINENT_DATUM,
  cellFeature,
  continentSlab,
  defineContinentComponent,
} from "./continent_shared.mjs";

const SURFACE_Y = CONTINENT_DATUM.surfaceY;

const SLAB = continentSlab({
  coreFloor: (unusedX, z) =>
    Math.max(CONTINENT_DATUM.coreMinY, CONTINENT_DATUM.surfaceY - z),
  rootProfile: COAST_ROOT_PROFILE,
  rootMask: (unusedX, z) => z >= 11,
});

const SHORE = cellFeature(
  (() => {
    const cells = [];

    for (let x = 1; x <= 28; x += 1) {
      for (let z = 1; z <= 3; z += 1) {
        cells.push([x, SURFACE_Y, z, CBLOCK.shore]);
      }
    }

    return cells;
  })(),
);

const OUTCROPS = cellFeature([
  [6, 21, 5, CBLOCK.rock],
  [7, 21, 5, CBLOCK.rock],
  [6, 22, 5, CBLOCK.rock],
  [21, 21, 4, CBLOCK.rock],
  [22, 21, 4, CBLOCK.rock],
  [13, 21, 3, CBLOCK.rock],
  [14, 21, 3, CBLOCK.rock],
]);

const GROVE = [
  { x: 6, z: 20, trunkHeight: 5 },
  { x: 15, z: 24, trunkHeight: 6 },
  { x: 24, z: 19, trunkHeight: 5 },
  { x: 20, z: 13, trunkHeight: 4 },
].map(({ x, z, trunkHeight }) =>
  foliageTree({
    x,
    z,
    baseY: SURFACE_Y + 1,
    trunkHeight,
    trunkIndex: CBLOCK.trunk,
    leafIndex: CBLOCK.leaves,
  }),
);

export const island = defineContinentComponent({
  id: "comp_coast",
  role: "coast",
  budget: "coast",
  coastFaces: ["-z"],
  probes: [
    { x: 4, y: 13, z: 14 },
    { x: 25, y: 13, z: 14 },
    { x: 14, y: 13, z: 25 },
    { x: 9, y: 13, z: 20 },
    { x: 20, y: 13, z: 20 },
  ],
  features: [SLAB, SHORE, OUTCROPS, ...GROVE],
});
