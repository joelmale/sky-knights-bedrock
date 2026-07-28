// Generation-time invariants shared by every tier and continent module.
//
// THE -1 CONTRACT (normative, from docs/design/archipelago_variety_spec.json)
//
//   -1                     = Bedrock STRUCTURE VOID. Placement leaves the
//                            existing block untouched.
//   palette index of "air" = FORCE-CLEAR. Placement writes air over whatever
//                            was there.
//
// The two are NOT interchangeable. Void is the default for every cell outside
// the silhouette; air is only ever emitted for a declared reason. Everything in
// this file exists so that "declared" is machine-checked instead of a comment.
//
// This module is deliberately separate from `shape.mjs`: carved cells carry a
// real air palette index (>= 0), so `assertSolidBody` keeps passing unmodified
// and `shape.mjs` needs no changes at all.

import { zyxIndex } from "./nbt.mjs";

const CONCRETE_POWDER_SUFFIX = "_concrete_powder";

/** Blocks that fall when the cell beneath them is air or void. */
export const GRAVITY_BLOCKS = new Set([
  "minecraft:sand",
  "minecraft:red_sand",
  "minecraft:gravel",
  "minecraft:suspicious_sand",
  "minecraft:suspicious_gravel",
  "minecraft:anvil",
  "minecraft:dragon_egg",
  "minecraft:pointed_dripstone",
  "minecraft:scaffolding",
]);

/** Blocks that must never be chosen as an integrity probe target. */
export const UNSTABLE_PROBE_BLOCKS = new Set([
  "minecraft:air",
  "minecraft:fire",
  "minecraft:soul_fire",
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava",
  "minecraft:oak_log",
  "minecraft:oak_leaves",
  "minecraft:spruce_log",
  "minecraft:spruce_leaves",
  "minecraft:crimson_stem",
  "minecraft:nether_wart_block",
  "minecraft:cactus",
]);

export function isGravityBlock(name) {
  return GRAVITY_BLOCKS.has(name) || name.endsWith(CONCRETE_POWDER_SUFFIX);
}

/** Stable string key for a cell, used to build declared-air sets. */
export function cellKey(x, y, z) {
  return `${x},${y},${z}`;
}

/** Builds a lookup set from an array of `[x, y, z]` triples. */
export function cellSet(cells) {
  const set = new Set();

  for (const [x, y, z] of cells) {
    set.add(cellKey(x, y, z));
  }

  return set;
}

function toSet(value) {
  if (value === undefined) {
    return new Set();
  }

  return new Set(Array.isArray(value) ? value : [value]);
}

/**
 * Census of a finished index array.
 *
 * `solid` counts every index that is neither -1, nor `airIndex`, nor a declared
 * liquid index. `liquid` counts water, lava, and fire.
 */
export function countIndices(
  indices,
  { airIndex = -2, liquidIndices = [] } = {},
) {
  const liquid = toSet(liquidIndices);
  const counts = {
    void: 0,
    air: 0,
    solid: 0,
    liquid: 0,
    total: indices.length,
  };

  for (const index of indices) {
    if (index === -1) {
      counts.void += 1;
    } else if (index === airIndex) {
      counts.air += 1;
    } else if (liquid.has(index)) {
      counts.liquid += 1;
    } else {
      counts.solid += 1;
    }
  }

  return counts;
}

/**
 * RULE 2(a). Every in-body cell holding `airIndex` must be reported by the
 * module's `carved` predicate. In-body -1 is still caught by `assertSolidBody`.
 */
export function assertCarveIsIntentional({
  name,
  size,
  body,
  indices,
  airIndex,
  carved,
}) {
  const [width, height, depth] = size;

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        if (indices[zyxIndex(size, x, y, z)] !== airIndex) {
          continue;
        }

        if (!body.contains(x, y, z)) {
          continue;
        }

        if (!carved(x, y, z)) {
          throw new Error(
            `${name} carved an undeclared body cell at ${x},${y},${z}.`,
          );
        }
      }
    }
  }
}

/**
 * RULE 3 and RULE 7. No air anywhere the module did not declare, inside the
 * silhouette or out. This is the check that stops a generator quietly emitting
 * a rectangular block of air into the sky.
 */
export function assertAirIsDeclared({
  name,
  size,
  indices,
  airIndex,
  declared,
}) {
  const [width, height, depth] = size;

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        if (indices[zyxIndex(size, x, y, z)] !== airIndex) {
          continue;
        }

        if (!declared(x, y, z)) {
          throw new Error(`${name} emitted undeclared air at ${x},${y},${z}.`);
        }
      }
    }
  }
}

/**
 * A liquid cell may only touch liquid or liner on its four lateral faces and
 * below, and liquid, air, or a declared spout above. This is what stops a
 * sealed basin from re-flowing and draining the island on placement.
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
  const [width, height, depth] = size;
  const liquid = toSet(liquidIndices);
  const liner = toSet(linerIndices);
  const spoutCells = cellSet(spouts);

  const at = (x, y, z) => {
    if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= depth) {
      return undefined;
    }

    return indices[zyxIndex(size, x, y, z)];
  };

  const sealed = (index) =>
    index !== undefined && (liquid.has(index) || liner.has(index));

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        if (!liquid.has(at(x, y, z))) {
          continue;
        }

        const lateral = [
          [x - 1, y, z],
          [x + 1, y, z],
          [x, y, z - 1],
          [x, y, z + 1],
          [x, y - 1, z],
        ];

        for (const [nx, ny, nz] of lateral) {
          if (spoutCells.has(cellKey(nx, ny, nz))) {
            continue;
          }

          if (!sealed(at(nx, ny, nz))) {
            throw new Error(
              `${name} has an unsealed liquid cell at ${x},${y},${z} (leaks toward ${nx},${ny},${nz}).`,
            );
          }
        }

        const above = at(x, y + 1, z);

        if (
          above !== undefined &&
          above !== airIndex &&
          !liquid.has(above) &&
          !liner.has(above) &&
          !spoutCells.has(cellKey(x, y + 1, z))
        ) {
          throw new Error(
            `${name} liquid cell ${x},${y},${z} has an undeclared block above it.`,
          );
        }
      }
    }
  }
}

/**
 * Every declared rim-fall column cell must be force-cleared air, the spout's
 * lateral neighbours must be solid so the outflow is exactly one block wide,
 * and the per-island fall caps must hold.
 */
export function assertFallColumn({
  name,
  size,
  indices,
  airIndex,
  columns,
  maxColumns = 3,
  maxVoidColumns = 1,
  maxLavaColumns = 1,
}) {
  if (columns.length > maxColumns) {
    throw new Error(
      `${name} declares ${columns.length} rim falls; the cap is ${maxColumns}.`,
    );
  }

  const voidColumns = columns.filter((column) => column.type === "void");

  if (voidColumns.length > maxVoidColumns) {
    throw new Error(
      `${name} declares ${voidColumns.length} void falls; the cap is ${maxVoidColumns}.`,
    );
  }

  if (voidColumns.some((column) => column.liquid === "lava")) {
    throw new Error(
      `${name} declares a void lava fall; lava falls are bounded.`,
    );
  }

  const lavaColumns = columns.filter((column) => column.liquid === "lava");

  if (lavaColumns.length > maxLavaColumns) {
    throw new Error(
      `${name} declares ${lavaColumns.length} lava falls; the cap is ${maxLavaColumns}.`,
    );
  }

  for (const column of columns) {
    for (const [x, y, z] of column.cells) {
      if (indices[zyxIndex(size, x, y, z)] !== airIndex) {
        throw new Error(
          `${name} fall column cell ${x},${y},${z} is not force-cleared air.`,
        );
      }
    }

    for (const [x, y, z] of column.lateral) {
      const index = indices[zyxIndex(size, x, y, z)];

      if (index === -1 || index === airIndex) {
        throw new Error(
          `${name} fall spout at ${column.spout.join(",")} is not walled at ${x},${y},${z}.`,
        );
      }
    }
  }
}

/**
 * Eternal-ember safety ring. Bedrock spreads fire to flammable blocks within
 * |dx|,|dz| <= 1 and dy in -1..4; this guard is deliberately larger.
 */
export function assertFireSafety({
  name,
  size,
  indices,
  fireIndex,
  flammableIndices,
}) {
  const [width, height, depth] = size;
  const flammable = toSet(flammableIndices);

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        if (indices[zyxIndex(size, x, y, z)] !== fireIndex) {
          continue;
        }

        for (let dx = -4; dx <= 4; dx += 1) {
          for (let dz = -4; dz <= 4; dz += 1) {
            for (let dy = -2; dy <= 5; dy += 1) {
              const nx = x + dx;
              const ny = y + dy;
              const nz = z + dz;

              if (
                nx < 0 ||
                nx >= width ||
                ny < 0 ||
                ny >= height ||
                nz < 0 ||
                nz >= depth
              ) {
                continue;
              }

              if (flammable.has(indices[zyxIndex(size, nx, ny, nz)])) {
                throw new Error(
                  `${name} fire at ${x},${y},${z} is within the safety ring of flammable ${nx},${ny},${nz}.`,
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
 * The four termination conditions for a reactive pyre island: finite fuel,
 * contained fuel, sealed ignition, and no re-ignition substrate.
 */
export function assertPyreTermination({
  name,
  size,
  indices,
  flammableIndices,
  lavaIndex,
  linerIndices,
  zone,
  fuelBudget,
  airIndex,
  fireIndex,
  palette = [],
}) {
  const [width, height, depth] = size;
  const flammable = toSet(flammableIndices);
  const liner = toSet(linerIndices);

  const at = (x, y, z) => {
    if (x < 0 || x >= width || y < 0 || y >= height || z < 0 || z >= depth) {
      return undefined;
    }

    return indices[zyxIndex(size, x, y, z)];
  };

  const inZone = (x, y, z) =>
    x >= zone.minX &&
    x <= zone.maxX &&
    y >= zone.minY &&
    y <= zone.maxY &&
    z >= zone.minZ &&
    z <= zone.maxZ;

  // (4) NO REIGNITION SOURCE.
  for (const name_ of palette) {
    if (
      name_ === "minecraft:netherrack" ||
      name_ === "minecraft:soul_soil" ||
      name_ === "minecraft:soul_sand" ||
      name_ === "minecraft:magma"
    ) {
      throw new Error(
        `${name} carries ${name_}; a reactive pyre must have no eternal-fire substrate.`,
      );
    }
  }

  let fuel = 0;
  let lava = 0;

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        const index = at(x, y, z);

        if (fireIndex !== undefined && index === fireIndex) {
          throw new Error(
            `${name} ships a fire block at ${x},${y},${z}; a reactive pyre ships unburnt.`,
          );
        }

        if (index === lavaIndex) {
          lava += 1;

          // (3) SEALED IGNITION.
          const walls = [
            [x - 1, y, z],
            [x + 1, y, z],
            [x, y, z - 1],
            [x, y, z + 1],
            [x, y - 1, z],
          ];

          for (const [nx, ny, nz] of walls) {
            if (!liner.has(at(nx, ny, nz))) {
              throw new Error(
                `${name} lava cup at ${x},${y},${z} is not lined at ${nx},${ny},${nz}.`,
              );
            }
          }

          if (at(x, y + 1, z) !== airIndex) {
            throw new Error(
              `${name} lava cup at ${x},${y},${z} needs force-cleared air above it.`,
            );
          }

          continue;
        }

        if (!flammable.has(index)) {
          continue;
        }

        fuel += 1;

        // (2) CONTAINED FUEL.
        if (!inZone(x, y, z)) {
          throw new Error(
            `${name} has flammable fuel outside the declared zone at ${x},${y},${z}.`,
          );
        }
      }
    }
  }

  // (1) FINITE FUEL.
  if (fuel > fuelBudget) {
    throw new Error(
      `${name} carries ${fuel} flammable cells; the fuel budget is ${fuelBudget}.`,
    );
  }

  if (lava !== 2) {
    throw new Error(
      `${name} must carry exactly 2 sealed lava cells, not ${lava}.`,
    );
  }

  // (2) CONTAINED FUEL, second half: a 2-block non-flammable shell below and
  // laterally, so nothing can carry fire off the zone or re-light it later.
  for (let y = zone.minY - 1; y <= zone.maxY + 2; y += 1) {
    for (let x = zone.minX - 2; x <= zone.maxX + 2; x += 1) {
      for (let z = zone.minZ - 2; z <= zone.maxZ + 2; z += 1) {
        if (inZone(x, y, z)) {
          continue;
        }

        if (flammable.has(at(x, y, z))) {
          throw new Error(
            `${name} has flammable fuel in the containment shell at ${x},${y},${z}.`,
          );
        }
      }
    }
  }

  for (let y = zone.minY; y <= zone.maxY; y += 1) {
    for (let z = zone.minZ; z <= zone.maxZ; z += 1) {
      for (const x of [
        zone.minX - 1,
        zone.minX - 2,
        zone.maxX + 1,
        zone.maxX + 2,
      ]) {
        const index = at(x, y, z);

        if (index === undefined || index === -1 || index === airIndex) {
          throw new Error(`${name} pyre zone is not walled at ${x},${y},${z}.`);
        }
      }
    }

    for (let x = zone.minX; x <= zone.maxX; x += 1) {
      for (const z of [
        zone.minZ - 1,
        zone.minZ - 2,
        zone.maxZ + 1,
        zone.maxZ + 2,
      ]) {
        const index = at(x, y, z);

        if (index === undefined || index === -1 || index === airIndex) {
          throw new Error(`${name} pyre zone is not walled at ${x},${y},${z}.`);
        }
      }
    }
  }

  for (let x = zone.minX; x <= zone.maxX; x += 1) {
    for (let z = zone.minZ; z <= zone.maxZ; z += 1) {
      for (const y of [zone.minY - 1, zone.minY - 2]) {
        const index = at(x, y, z);

        if (index === undefined || index === -1 || index === airIndex) {
          throw new Error(`${name} pyre zone has no floor at ${x},${y},${z}.`);
        }
      }
    }
  }
}

/**
 * `structureBuffer` writes `states: compound({})`, so leaves get
 * `persistent_bit=false` and decay unless a log is close enough.
 */
export function assertLeafSupport({
  name,
  size,
  indices,
  leafIndex,
  logIndex,
  maxDistance = 4,
}) {
  const [width, height, depth] = size;
  const leaves = toSet(leafIndex);
  const logs = toSet(logIndex);
  const logCells = [];
  const leafCells = [];

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        const index = indices[zyxIndex(size, x, y, z)];

        if (logs.has(index)) {
          logCells.push([x, y, z]);
        } else if (leaves.has(index)) {
          leafCells.push([x, y, z]);
        }
      }
    }
  }

  for (const [x, y, z] of leafCells) {
    const supported = logCells.some(
      ([lx, ly, lz]) =>
        Math.abs(lx - x) + Math.abs(ly - y) + Math.abs(lz - z) <= maxDistance,
    );

    if (!supported) {
      throw new Error(
        `${name} has a leaf at ${x},${y},${z} further than ${maxDistance} blocks from any log; it would decay.`,
      );
    }
  }
}

/** RULE 7. Sand, gravel, and concrete powder must never sit over emptiness. */
export function assertNoUnsupportedGravityBlocks({
  name,
  size,
  palette,
  indices,
  airIndex,
}) {
  const [width, height, depth] = size;
  const gravity = new Set();

  palette.forEach((blockName, index) => {
    if (isGravityBlock(blockName)) {
      gravity.add(index);
    }
  });

  if (gravity.size === 0) {
    return;
  }

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        if (!gravity.has(indices[zyxIndex(size, x, y, z)])) {
          continue;
        }

        const below = y === 0 ? -1 : indices[zyxIndex(size, x, y - 1, z)];

        if (below === -1 || below === airIndex) {
          throw new Error(
            `${name} has an unsupported gravity block at ${x},${y},${z}.`,
          );
        }
      }
    }
  }
}

/** The hard per-tier ceilings from the spec's blockBudgets table. */
export function assertBlockBudget({ name, counts, budget }) {
  if (counts.total !== budget.boxCells) {
    throw new Error(
      `${name} iterated ${counts.total} cells; the ${budget.tier} tier box is ${budget.boxCells}.`,
    );
  }

  if (counts.solid > budget.maxSolid) {
    throw new Error(
      `${name} emits ${counts.solid} solid blocks; the ${budget.tier} ceiling is ${budget.maxSolid}.`,
    );
  }

  if (counts.air > budget.maxAir) {
    throw new Error(
      `${name} emits ${counts.air} air cells; the ${budget.tier} ceiling is ${budget.maxAir}.`,
    );
  }

  if (counts.liquid > budget.maxLiquid) {
    throw new Error(
      `${name} emits ${counts.liquid} liquid cells; the ${budget.tier} ceiling is ${budget.maxLiquid}.`,
    );
  }

  if (budget.occupancy !== undefined) {
    const occupancy = counts.solid + counts.air + counts.liquid;

    if (occupancy > budget.occupancy) {
      throw new Error(
        `${name} occupies ${occupancy} cells; the ${budget.tier} ceiling is ${budget.occupancy}.`,
      );
    }
  }

  if (budget.voidFloor !== undefined) {
    const floor = Math.ceil(budget.boxCells * budget.voidFloor);

    if (counts.void < floor) {
      throw new Error(
        `${name} leaves only ${counts.void} void cells; the ${budget.tier} floor is ${floor}.`,
      );
    }
  }
}

/** Integrity probes must target inert core blocks, never fire, liquid, or fuel. */
export function assertProbeIsStable({ name, palette, probes }) {
  for (const probe of probes) {
    if (UNSTABLE_PROBE_BLOCKS.has(probe.typeId)) {
      throw new Error(
        `${name} integrity probe at ${probe.offset.x},${probe.offset.y},${probe.offset.z} targets ${probe.typeId}, which can change after placement.`,
      );
    }

    if (!palette.includes(probe.typeId)) {
      throw new Error(
        `${name} integrity probe targets ${probe.typeId}, which is not in its palette.`,
      );
    }
  }
}
