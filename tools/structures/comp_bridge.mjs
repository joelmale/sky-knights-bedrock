// Continent component: the same canyon as `comp_chasm`, plus the land bridge
// that spans it.
//
// The deck runs the full width at CONTINENT_BRIDGE_Y and terminates exactly at
// the frozen abutment window (z 13..16, y 25..26) on both -X and +X, so any two
// abutment-bearing components meet block for block. Nothing else in this module
// is permitted to write into the border shell, and
// `defineContinentComponent` throws if a stamp tries.

import { landBridge } from "./features/bridge.mjs";
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

const DECK = landBridge({
  fromX: 1,
  fromZ: 14,
  toX: 28,
  toZ: 14,
  y: CONTINENT_BRIDGE_Y,
  width: 4,
  archDepth: 2,
  index: CBLOCK.deck,
  railIndex: CBLOCK.liner,
});

// Two stairs, one per side, so the deck is reachable from the surface datum.
function stair(xs, topYFor) {
  const cells = [];

  for (const x of xs) {
    const top = topYFor(x);

    for (let z = 17; z <= 18; z += 1) {
      for (let y = SURFACE_Y + 1; y <= top; y += 1) {
        cells.push([x, y, z, y === top ? CBLOCK.deck : CBLOCK.rock]);
      }
    }
  }

  return cellFeature(cells);
}

const WEST_STAIR = stair([1, 2, 3, 4, 5, 6], (x) => CONTINENT_BRIDGE_Y + 1 - x);
const EAST_STAIR = stair([23, 24, 25, 26, 27, 28], (x) => x - 2);

export const island = defineContinentComponent({
  id: "comp_bridge",
  role: "bridge",
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
  features: [SLAB, DECK, WEST_STAIR, EAST_STAIR],
});
