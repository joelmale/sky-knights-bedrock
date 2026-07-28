// Continent component: a canyon cutting fully through the slab.
//
// The chasm is a MASK, not a carve. A canyon that goes all the way through the
// continent is genuinely outside the silhouette, so those columns are simply
// never emitted and stay -1. Carving them instead would cost ~1800 force-clear
// air cells, and the continent-interior air ceiling is 2600 of which the frozen
// seam shell already spends 2204. Looking down the canyon you see the void
// beneath the continent, which is correct, dramatic, and free.
//
// Carries the frozen bridge abutments on -X and +X, plus a landing causeway that
// ramps from each abutment down to the surface datum, so a bridge arriving from
// a neighbouring component has somewhere to put a player.

import { chasmMask } from "./features/carve.mjs";
import {
  CBLOCK,
  CONTINENT_BRIDGE_Y,
  CONTINENT_DATUM,
  INTERIOR_ROOT_PROFILE,
  cellFeature,
  continentSlab,
  defineContinentComponent,
} from "./continent_shared.mjs";

const CHASM = chasmMask({ axis: "z", center: 14, width: 7 });
const SURFACE_Y = CONTINENT_DATUM.surfaceY;

const SLAB = continentSlab({
  mask: (x, z) => !CHASM(x, z),
  rootProfile: INTERIOR_ROOT_PROFILE,
});

function causeway(xs, deckYFor) {
  const cells = [];

  for (const x of xs) {
    const deckY = deckYFor(x);

    for (let z = 13; z <= 16; z += 1) {
      for (let y = SURFACE_Y + 1; y <= deckY; y += 1) {
        cells.push([x, y, z, y === deckY ? CBLOCK.deck : CBLOCK.rock]);
      }
    }
  }

  return cellFeature(cells);
}

const WEST_LANDING = causeway([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], (x) =>
  Math.max(SURFACE_Y + 1, CONTINENT_BRIDGE_Y + 1 - x),
);

const EAST_LANDING = causeway(
  [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28],
  (x) => Math.max(SURFACE_Y + 1, x - 2),
);

const RIM = cellFeature(
  [
    [10, 12],
    [10, 18],
    [18, 11],
    [18, 19],
    [10, 6],
    [18, 24],
  ].map(([x, z]) => [x, SURFACE_Y, z, CBLOCK.rock]),
);

export const island = defineContinentComponent({
  id: "comp_chasm",
  role: "chasm",
  budget: "interior",
  hasChasm: true,
  bridgeAbutments: ["-x", "+x"],
  probes: [
    { x: 4, y: 13, z: 4 },
    { x: 25, y: 13, z: 4 },
    { x: 4, y: 13, z: 25 },
    { x: 25, y: 13, z: 25 },
    { x: 5, y: 13, z: 14 },
  ],
  features: [SLAB, RIM, WEST_LANDING, EAST_LANDING],
});
