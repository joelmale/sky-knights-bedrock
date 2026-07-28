// Owns the continent seam contract (RULE 4 / RULE 5 of the air/void
// contract). Every `comp_*` and `duo_mesa` module builds through
// `defineContinentComponent`, which writes the border shell itself and
// refuses any stamp - carve, feature, or ore - that resolves inside it.
//
// Continent components are flat 30x40x30 slabs, not ellipsoid island bodies,
// so they do not go through `buildIslandIndices`/`assertSolidBody`. Instead
// the interior (everything except the 1-block border) is filled with a solid
// core slab plus one surface layer, and every feature stamp lays on top of
// that, guarded against writing into the frozen shell.

import { structureBuffer, zyxIndex } from "./nbt.mjs";
import {
  assertCarveIsIntentional,
  assertLeafSupport,
  countIndices,
} from "./assert.mjs";
import { bridgeAbutment } from "./features/bridge.mjs";

export const CONTINENT_SIZE = [30, 40, 30];

// Family-neutral continent palette (see the design spec's `notesForEngineers`
// scoping decision: one shared temperate palette instead of four).
export const CONTINENT_PALETTE = [
  "minecraft:stone", // 0 rock (root/core)
  "minecraft:grass_block", // 1 surface
  "minecraft:water", // 2 liquid
  "minecraft:oak_log", // 3 trunk
  "minecraft:oak_leaves", // 4 canopy
  "minecraft:sand", // 5 coast beach (gravity - only ever placed on solid ground)
  "minecraft:gravel", // 6 coast shallows / chasm rubble (gravity - same rule)
  "minecraft:cobblestone", // 7 bridge deck / rail
  "minecraft:stone_bricks", // 8 relief cap (mountain / mesa banding)
  "minecraft:air", // 9 explicit air - LAST, per the palette convention
];

export const CBLOCK = {
  rock: 0,
  surface: 1,
  water: 2,
  trunk: 3,
  leaves: 4,
  sand: 5,
  gravel: 6,
  deck: 7,
  cap: 8,
  air: 9,
};

// rootMinY/rootMaxY are kept for documentation parity with the design spec;
// this implementation insets the root taper all the way to nothing (root
// layers are left void) so every component's solid-block count stays well
// under its budget. Only the 8-layer core slab + one surface layer are ever
// solid on an interior column.
export const CONTINENT_DATUM = {
  rootMinY: 4,
  rootMaxY: 11,
  coreMinY: 12,
  coreMaxY: 19,
  surfaceY: 20,
  reliefMaxY: 39,
};

export const CONTINENT_BRIDGE_Y = 26;

const [SIZE_X, , SIZE_Z] = CONTINENT_SIZE;

function isBorderShell(x, z) {
  return x === 0 || x === SIZE_X - 1 || z === 0 || z === SIZE_Z - 1;
}

function seamProfileValue(role, y) {
  const { rootMaxY, coreMinY, coreMaxY, surfaceY } = CONTINENT_DATUM;

  if (y <= rootMaxY) {
    return -1;
  }

  if (y >= coreMinY && y <= coreMaxY) {
    return CBLOCK.rock;
  }

  if (y === surfaceY) {
    return CBLOCK.surface;
  }

  // y > surfaceY: interior seams clear to air so a re-placed neighbour never
  // leaves stale geometry wedged in the joint; coast seams stay open sky.
  return role === "coast" ? -1 : CBLOCK.air;
}

/** `edgeRole`: `"interior"` (default) or `"coast"` - see `comp_coast.mjs`. */
export function seamShellStamp(edgeRole = "interior") {
  return {
    resolve(context) {
      const { x, y, z } = context;

      if (!isBorderShell(x, z)) {
        return undefined;
      }

      // Only the local -Z border is ever the outward coast face; the other
      // three borders of a coast component still need to match their
      // interior neighbours.
      const role = edgeRole === "coast" && z === 0 ? "coast" : "interior";
      return seamProfileValue(role, y);
    },
  };
}

/** Re-reads the finished index array and verifies every shell cell matches. */
export function assertSeamShell({ name, indices, edgeRole = "interior" }) {
  const shell = seamShellStamp(edgeRole);

  for (let x = 0; x < CONTINENT_SIZE[0]; x += 1) {
    for (let y = 0; y < CONTINENT_SIZE[1]; y += 1) {
      for (let z = 0; z < CONTINENT_SIZE[2]; z += 1) {
        if (!isBorderShell(x, z)) {
          continue;
        }

        const expected = shell.resolve({ x, y, z });
        const actual = indices[zyxIndex(CONTINENT_SIZE, x, y, z)];

        if (actual !== expected) {
          throw new Error(
            `${name} seam shell mismatch at ${x},${y},${z}: expected ${expected}, saw ${actual}.`,
          );
        }
      }
    }
  }
}

/**
 * Builds one continent component. `stamps` are ordinary stamp objects
 * (`{ resolve(context) }`) applied after the base slab fill; every stamp is
 * wrapped so it throws if it ever resolves a value inside the frozen border
 * shell, except within the compile-time-fixed bridge-abutment window on an
 * edge declared in `bridgeAbutments`.
 */
export function defineContinentComponent({
  id,
  edgeRole = "interior",
  stamps = [],
  carved = () => false,
  bridgeAbutments = [],
  leafSupport,
  budget,
}) {
  const size = CONTINENT_SIZE;

  const bodyLike = {
    topY: CONTINENT_DATUM.reliefMaxY,
    contains(x, y, z) {
      return !isBorderShell(x, z) && y >= 0 && y <= CONTINENT_DATUM.reliefMaxY;
    },
  };

  function inAbutmentWindow(x, z) {
    return (x === 0 || x === size[0] - 1) && z >= 13 && z <= 16;
  }

  function guardedStamp(stamp) {
    return {
      resolve(context) {
        const value = stamp.resolve(context);

        if (value === undefined) {
          return undefined;
        }

        const { x, z } = context;

        if (isBorderShell(x, z) && !inAbutmentWindow(x, z)) {
          throw new Error(
            `${id}: a stamp resolved inside the frozen border shell at ${x},${context.y},${z}.`,
          );
        }

        return value;
      },
    };
  }

  const abutmentStamps = bridgeAbutments.map((edge) =>
    bridgeAbutment({ edge, index: CBLOCK.deck }),
  );

  function buildIndices() {
    const indices = new Array(size[0] * size[1] * size[2]).fill(-1);
    const shell = seamShellStamp(edgeRole);

    for (let x = 0; x < size[0]; x += 1) {
      for (let z = 0; z < size[2]; z += 1) {
        const border = isBorderShell(x, z);

        for (let y = 0; y < size[1]; y += 1) {
          let value = -1;

          if (border) {
            value = shell.resolve({ x, y, z }) ?? -1;
          } else if (y >= CONTINENT_DATUM.coreMinY && y <= CONTINENT_DATUM.coreMaxY) {
            value = CBLOCK.rock;
          } else if (y === CONTINENT_DATUM.surfaceY) {
            value = CBLOCK.surface;
          }

          indices[zyxIndex(size, x, y, z)] = value;
        }
      }
    }

    for (const stamp of abutmentStamps) {
      for (let x = 0; x < size[0]; x += 1) {
        for (let y = 0; y < size[1]; y += 1) {
          for (let z = 0; z < size[2]; z += 1) {
            const value = stamp.resolve({ x, y, z });

            if (value !== undefined) {
              indices[zyxIndex(size, x, y, z)] = value;
            }
          }
        }
      }
    }

    for (const stamp of stamps) {
      const guarded = guardedStamp(stamp);

      for (let x = 0; x < size[0]; x += 1) {
        for (let y = 0; y < size[1]; y += 1) {
          for (let z = 0; z < size[2]; z += 1) {
            const context = { x, y, z, inBody: bodyLike.contains(x, y, z) };
            const value = guarded.resolve(context);

            if (value !== undefined) {
              indices[zyxIndex(size, x, y, z)] = value;
            }
          }
        }
      }
    }

    assertSeamShell({ name: id, indices, edgeRole });
    assertCarveIsIntentional({
      name: id,
      size,
      body: bodyLike,
      indices,
      airIndex: CBLOCK.air,
      carved,
    });

    if (leafSupport) {
      assertLeafSupport({
        name: id,
        size,
        indices,
        leafIndex: leafSupport.leafIndex,
        logIndex: leafSupport.logIndex,
        maxDistance: leafSupport.maxDistance ?? 4,
      });
    }

    if (budget) {
      const counts = countIndices(indices, {
        airIndex: CBLOCK.air,
        liquidIndices: budget.liquidIndices ?? [CBLOCK.water],
      });

      if (counts.solid > budget.maxSolid) {
        throw new Error(`${id} solid block count ${counts.solid} exceeds ${budget.maxSolid}.`);
      }

      if (counts.air > budget.maxAir) {
        throw new Error(`${id} air cell count ${counts.air} exceeds ${budget.maxAir}.`);
      }

      if (counts.liquid > budget.maxLiquid) {
        throw new Error(`${id} liquid cell count ${counts.liquid} exceeds ${budget.maxLiquid}.`);
      }

      if (budget.maxOccupancyRatio !== undefined) {
        const boxCells = size[0] * size[1] * size[2];
        const occupied = counts.solid + counts.air + counts.liquid;

        if (occupied > boxCells * budget.maxOccupancyRatio) {
          throw new Error(
            `${id} occupancy ${occupied} exceeds ${(budget.maxOccupancyRatio * 100).toFixed(0)}% of ${boxCells}.`,
          );
        }
      }
    }

    return indices;
  }

  function build() {
    return structureBuffer(size, CONTINENT_PALETTE, buildIndices());
  }

  return {
    id,
    family: "continent",
    tier: "continent-interior",
    edgeRole,
    structureId: `skyknights:${id}`,
    outputPath: [
      "behavior_packs",
      "sk_bp",
      "structures",
      "skyknights",
      `${id}.mcstructure`,
    ],
    size,
    palette: CONTINENT_PALETTE,
    inspect() {
      return { palette: [...CONTINENT_PALETTE], indices: buildIndices() };
    },
    build,
  };
}
