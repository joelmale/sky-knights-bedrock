// Shared validation helpers for tier and continent-component generators.
//
// These assertions run at *generation time* (inside Node, while building the
// index array) and throw before a byte ever reaches an `.mcstructure` file.
// They exist to make the air/void contract and the burn-gate termination
// proofs testable without launching Minecraft. None of them mutate the index
// array; they only read it back and complain loudly if something is wrong.
//
// This file is new and deliberately separate from `shape.mjs`: the existing
// `assertSolidBody` (which throws on an in-body `-1`) is untouched, and every
// new check below is additive.

import { zyxIndex } from "./nbt.mjs";

function cellAt(size, indices, x, y, z) {
  const [width, height, depth] = size;

  if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= depth) {
    return undefined;
  }

  return indices[zyxIndex(size, x, y, z)];
}

/**
 * Tallies an index array into void / air / solid / liquid buckets.
 *
 * `airIndex` and `liquidIndices` are optional: omit them to just see the
 * void/non-void split. Every non-void, non-air, non-liquid index counts as
 * solid, matching the block-budget definition in the design spec.
 */
export function countIndices(indices, { airIndex, liquidIndices = [] } = {}) {
  const liquidSet = new Set(liquidIndices);
  let voidCount = 0;
  let air = 0;
  let liquid = 0;
  let solid = 0;

  for (const value of indices) {
    if (value === -1) {
      voidCount += 1;
    } else if (airIndex !== undefined && value === airIndex) {
      air += 1;
    } else if (liquidSet.has(value)) {
      liquid += 1;
    } else {
      solid += 1;
    }
  }

  return { void: voidCount, air, solid, liquid, total: indices.length };
}

/**
 * Every in-body cell equal to `airIndex` must be reported by the module's own
 * `carved(x,y,z)` predicate. In-body `-1` cells are still caught by the
 * existing `assertSolidBody` in shape.mjs; this only polices explicit air.
 */
export function assertCarveIsIntentional({
  name,
  size,
  body,
  indices,
  airIndex,
  carved,
}) {
  const [width, , depth] = size;

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y <= body.topY; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        if (!body.contains(x, y, z)) {
          continue;
        }

        const value = indices[zyxIndex(size, x, y, z)];

        if (value === airIndex && !carved(x, y, z)) {
          throw new Error(
            `${name} has unintentional air at ${x},${y},${z}; carved() must report every deliberate cut.`,
          );
        }
      }
    }
  }
}

/**
 * Proves a lake/lava basin cannot drain on placement: every liquid cell's
 * horizontal and downward neighbours must be liquid or liner, and its upward
 * neighbour must be liquid, air (headroom), or a declared spout.
 */
export function assertSealedBasin({
  name,
  size,
  indices,
  liquidIndices,
  linerIndices,
  airIndex,
  spouts = [],
}) {
  const liquidSet = new Set(liquidIndices);
  const linerSet = new Set(linerIndices);
  const spoutSet = new Set(spouts.map(([x, y, z]) => `${x},${y},${z}`));
  const [width, height, depth] = size;

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        const value = cellAt(size, indices, x, y, z);

        if (!liquidSet.has(value)) {
          continue;
        }

        const sideNeighbors = [
          [x - 1, y, z],
          [x + 1, y, z],
          [x, y, z - 1],
          [x, y, z + 1],
          [x, y - 1, z],
        ];

        for (const [nx, ny, nz] of sideNeighbors) {
          const neighbor = cellAt(size, indices, nx, ny, nz);

          if (!(liquidSet.has(neighbor) || linerSet.has(neighbor))) {
            throw new Error(
              `${name} basin leaks at ${x},${y},${z} toward ${nx},${ny},${nz}.`,
            );
          }
        }

        const above = cellAt(size, indices, x, y + 1, z);
        const isSpout = spoutSet.has(`${x},${y + 1},${z}`);

        if (!(liquidSet.has(above) || above === airIndex || isSpout)) {
          throw new Error(
            `${name} basin at ${x},${y},${z} is not open upward (headroom or spout expected).`,
          );
        }
      }
    }
  }
}

/**
 * Verifies every declared rim-fall column (the spout cell and the one cell
 * laterally outward, from the rim down to the column terminus) is air, and
 * enforces the per-island fall-count caps from the design spec.
 */
export function assertFallColumn({ name, indices, size, airIndex, columns }) {
  if (columns.length > 3) {
    throw new Error(
      `${name} declares ${columns.length} rim falls; the cap is 3 per island.`,
    );
  }

  const voidFalls = columns.filter((column) => column.type === "void").length;

  if (voidFalls > 1) {
    throw new Error(
      `${name} declares ${voidFalls} void rim falls; the cap is 1 per island.`,
    );
  }

  for (const column of columns) {
    const { x, z, lateralX, lateralZ, fromY, toY } = column;
    const top = Math.max(fromY, toY);
    const bottom = Math.min(fromY, toY);

    for (let y = bottom; y <= top; y += 1) {
      if (cellAt(size, indices, x, y, z) !== airIndex) {
        throw new Error(`${name} fall column blocked at ${x},${y},${z}.`);
      }

      if (cellAt(size, indices, lateralX, y, lateralZ) !== airIndex) {
        throw new Error(
          `${name} fall column blocked laterally at ${lateralX},${y},${lateralZ}.`,
        );
      }
    }
  }
}

/**
 * No flammable cell may exist within Bedrock's fire-spread neighbourhood (and
 * a safety margin beyond it) of any fire cell.
 */
export function assertFireSafety({
  name,
  size,
  indices,
  fireIndex,
  flammableIndices,
}) {
  const flammableSet = new Set(flammableIndices);
  const [width, height, depth] = size;

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        if (cellAt(size, indices, x, y, z) !== fireIndex) {
          continue;
        }

        for (let dx = -4; dx <= 4; dx += 1) {
          for (let dz = -4; dz <= 4; dz += 1) {
            for (let dy = -2; dy <= 5; dy += 1) {
              if (dx === 0 && dy === 0 && dz === 0) {
                continue;
              }

              if (flammableSet.has(cellAt(size, indices, x + dx, y + dy, z + dz))) {
                throw new Error(
                  `${name} fire at ${x},${y},${z} has a flammable neighbour within the safety ring.`,
                );
              }
            }
          }
        }
      }
    }
  }
}

/**
 * The four-condition reactive-pyre termination proof: finite fuel, fuel fully
 * contained inside `zone` with a two-block non-flammable margin, exactly two
 * sealed lava sources, and (by construction of the caller's palette) no
 * netherrack/soul-soil reignition source.
 */
export function assertPyreTermination({
  name,
  size,
  indices,
  flammableIndices,
  lavaIndex,
  zone,
  fuelBudget,
}) {
  const flammableSet = new Set(flammableIndices);
  const [width, height, depth] = size;
  let flammableCount = 0;
  let lavaCount = 0;

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        const value = cellAt(size, indices, x, y, z);

        if (flammableSet.has(value)) {
          flammableCount += 1;

          if (
            x < zone.minX ||
            x > zone.maxX ||
            y < zone.minY ||
            y > zone.maxY ||
            z < zone.minZ ||
            z > zone.maxZ
          ) {
            throw new Error(
              `${name} pyre fuel at ${x},${y},${z} escapes its declared zone.`,
            );
          }
        }

        if (value === lavaIndex) {
          lavaCount += 1;
        }
      }
    }
  }

  if (flammableCount > fuelBudget) {
    throw new Error(
      `${name} pyre fuel ${flammableCount} exceeds the budget of ${fuelBudget}.`,
    );
  }

  if (lavaCount !== 2) {
    throw new Error(
      `${name} pyre must contain exactly 2 lava cells; found ${lavaCount}.`,
    );
  }

  // Two-block non-flammable margin around the zone: nothing flammable may
  // exist in the shell immediately outside it.
  for (let x = zone.minX - 2; x <= zone.maxX + 2; x += 1) {
    for (let y = zone.minY - 2; y <= zone.maxY + 2; y += 1) {
      for (let z = zone.minZ - 2; z <= zone.maxZ + 2; z += 1) {
        const outsideZone =
          x < zone.minX ||
          x > zone.maxX ||
          y < zone.minY ||
          y > zone.maxY ||
          z < zone.minZ ||
          z > zone.maxZ;

        if (!outsideZone) {
          continue;
        }

        const value = cellAt(size, indices, x, y, z);

        if (value !== undefined && flammableSet.has(value)) {
          throw new Error(
            `${name} pyre shell breach at ${x},${y},${z}: flammable block outside the containment margin.`,
          );
        }
      }
    }
  }
}

/**
 * Bedrock structures carry no leaf `persistent_bit`, so every leaf cell must
 * sit within `maxDistance` taxicab blocks of a log cell or it will decay.
 */
export function assertLeafSupport({
  name,
  size,
  indices,
  leafIndex,
  logIndex,
  maxDistance,
}) {
  const [width, height, depth] = size;
  const logs = [];

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        if (cellAt(size, indices, x, y, z) === logIndex) {
          logs.push([x, y, z]);
        }
      }
    }
  }

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        if (cellAt(size, indices, x, y, z) !== leafIndex) {
          continue;
        }

        const supported = logs.some(
          ([lx, ly, lz]) =>
            Math.abs(lx - x) + Math.abs(ly - y) + Math.abs(lz - z) <= maxDistance,
        );

        if (!supported) {
          throw new Error(
            `${name} leaf at ${x},${y},${z} exceeds the ${maxDistance}-block log support distance and will decay.`,
          );
        }
      }
    }
  }
}

/**
 * Gravity-affected blocks (sand, gravel, concrete powder, ...) directly above
 * void or explicit air fall on placement. Bonus check beyond the spec's named
 * export list, used internally by tier_shared/continent_shared wherever a
 * palette carries a gravity-affected block.
 */
export function assertNoUnsupportedGravityBlocks({
  name,
  size,
  indices,
  gravityIndices,
  airIndex,
}) {
  const gravitySet = new Set(gravityIndices);
  const [width, height, depth] = size;

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        if (!gravitySet.has(cellAt(size, indices, x, y, z))) {
          continue;
        }

        const below = y === 0 ? -1 : cellAt(size, indices, x, y - 1, z);

        if (below === -1 || below === airIndex) {
          throw new Error(
            `${name} gravity block at ${x},${y},${z} is unsupported and will fall on placement.`,
          );
        }
      }
    }
  }
}
