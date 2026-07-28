// Shared contract for continent components.
//
// A continent is 150x40x150 - far past Bedrock's 64x384x64 structure limit - so
// it is composed from 21 parts on a 5x5 grid with the four corners omitted.
// Components tile EDGE-TO-EDGE WITH ZERO OVERLAP: the grid pitch equals the
// component size, so cell x=29 of one component is adjacent to, never
// coincident with, cell x=0 of the next. Seams therefore need CONTINUITY, not
// overwrite semantics, and no component can ever erase another.
//
// THE SEAM CONTRACT (RULE 4 of the air/void contract)
//   * the border shell is every cell with x in {0,29} OR z in {0,29};
//   * NO stamp, feature, or ore pocket may resolve inside it -
//     `defineContinentComponent` throws if one does;
//   * the shell is written solely by `seamShellStamp(edgeRole)`, whose profile
//     depends ONLY on the edge role and the local y - never on the component's
//     identity or on the position along the edge.
//
// Because both sides of every interior seam emit the identical 8-layer core
// plus one surface column, the joint is invisible and gap-free by construction.
//
// The `y 21..39 -> air` on interior seams is deliberate: it guarantees that if a
// neighbour is re-placed after a player has built on the seam, the seam column
// is force-cleared to a known state instead of leaving half a block of stale
// geometry wedged in the joint.

import { structureBuffer, zyxIndex } from "./nbt.mjs";
import {
  assertAirIsDeclared,
  assertBlockBudget,
  assertLeafSupport,
  assertNoUnsupportedGravityBlocks,
  assertProbeIsStable,
  assertSealedBasin,
  cellKey,
  countIndices,
} from "./assert.mjs";
import { ABUTMENT_WINDOW } from "./features/bridge.mjs";

export const CONTINENT_SIZE = Object.freeze([30, 40, 30]);

export const CONTINENT_DATUM = Object.freeze({
  rootMinY: 4,
  rootMaxY: 11,
  coreMinY: 12,
  coreMaxY: 19,
  surfaceY: 20,
  reliefMaxY: 39,
});

export const CONTINENT_BRIDGE_Y = 26;

/**
 * Continents are family-neutral: one shared temperate palette rather than four
 * variants. That is what keeps the component kit at seven modules instead of
 * twenty-eight, and "the Green Continents" reads as worldbuilding rather than
 * as a missing feature. No gravity blocks appear anywhere in it.
 */
export const CONTINENT_PALETTE = Object.freeze([
  "minecraft:stone",
  "minecraft:dirt",
  "minecraft:grass_block",
  "minecraft:coarse_dirt",
  "minecraft:andesite",
  "minecraft:cobblestone",
  "minecraft:mossy_cobblestone",
  "minecraft:oak_log",
  "minecraft:oak_leaves",
  "minecraft:coal_ore",
  "minecraft:water",
  "minecraft:air",
]);

export const CBLOCK = Object.freeze({
  core: 0,
  subsurface: 1,
  surface: 2,
  shore: 3,
  rock: 4,
  deck: 5,
  liner: 6,
  trunk: 7,
  leaves: 8,
  ore: 9,
  water: 10,
  air: 11,
});

export const CONTINENT_BUDGETS = Object.freeze({
  interior: {
    tier: "continent-interior",
    boxCells: 36000,
    maxSolid: 11000,
    maxAir: 2600,
    maxLiquid: 420,
    occupancy: 14400,
  },
  coast: {
    tier: "continent-coast",
    boxCells: 36000,
    maxSolid: 8000,
    maxAir: 1800,
    maxLiquid: 300,
    occupancy: 10800,
  },
});

const [WIDTH, HEIGHT, DEPTH] = CONTINENT_SIZE;
const CENTER = 14;

export const EDGE_ROLE = Object.freeze({
  interior: "interior",
  coast: "coast",
});

/**
 * The frozen seam profile. Depends on the edge role and the local y ONLY.
 *
 *   INTERIOR  y  0..11 -> -1        (root taper is inset, never on the seam)
 *             y 12..19 -> core      (8-layer core slab)
 *             y 20     -> surface
 *             y 21..39 -> air       (force-clear, see the header)
 *   COAST     y  0..11 -> -1
 *             y 12..19 -> core      (reads as a cliff)
 *             y 20     -> surface
 *             y 21..39 -> -1        (open sky above a coast; no air needed)
 */
export function seamShellStamp(edgeRole) {
  return (y) => {
    if (y < CONTINENT_DATUM.coreMinY) {
      return -1;
    }

    if (y <= CONTINENT_DATUM.coreMaxY) {
      return CBLOCK.core;
    }

    if (y === CONTINENT_DATUM.surfaceY) {
      return CBLOCK.surface;
    }

    return edgeRole === EDGE_ROLE.coast ? -1 : CBLOCK.air;
  };
}

function isShell(x, z) {
  return x === 0 || x === WIDTH - 1 || z === 0 || z === DEPTH - 1;
}

function abutmentCells(bridgeAbutments) {
  const cells = new Map();

  for (const edge of bridgeAbutments) {
    const x = edge === "-x" ? 0 : WIDTH - 1;

    for (let z = ABUTMENT_WINDOW.minZ; z <= ABUTMENT_WINDOW.maxZ; z += 1) {
      for (const y of [CONTINENT_BRIDGE_Y - 1, CONTINENT_BRIDGE_Y]) {
        cells.set(cellKey(x, y, z), CBLOCK.deck);
      }
    }
  }

  return cells;
}

/**
 * The base slab.
 *
 * `mask(x, z)` false means the column is simply not emitted, so it stays -1.
 * That is how `comp_chasm` cuts fully through the slab: a chasm through a
 * continent is genuinely outside the silhouette, so it costs nothing instead of
 * the ~1800 force-clear air cells a carve would need.
 */
export function continentSlab({
  mask = () => true,
  coreFloor = () => CONTINENT_DATUM.coreMinY,
  coreIndex = CBLOCK.core,
  subsurfaceIndex = CBLOCK.subsurface,
  surfaceIndex = CBLOCK.surface,
  rootIndex = CBLOCK.core,
  rootProfile,
  rootMask = () => true,
}) {
  const cells = [];

  for (let x = 1; x < WIDTH - 1; x += 1) {
    for (let z = 1; z < DEPTH - 1; z += 1) {
      if (!mask(x, z)) {
        continue;
      }

      const floor = coreFloor(x, z);

      for (let y = floor; y <= CONTINENT_DATUM.coreMaxY; y += 1) {
        const index =
          y >= CONTINENT_DATUM.coreMaxY - 1 ? subsurfaceIndex : coreIndex;
        cells.push([x, y, z, index]);
      }

      cells.push([x, CONTINENT_DATUM.surfaceY, z, surfaceIndex]);
    }
  }

  if (rootProfile !== undefined) {
    for (const { y, radius } of rootProfile) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dz = -radius; dz <= radius; dz += 1) {
          if (dx * dx + dz * dz > radius * radius) {
            continue;
          }

          const x = CENTER + dx;
          const z = CENTER + dz;

          if (!mask(x, z) || !rootMask(x, z)) {
            continue;
          }

          cells.push([x, y, z, rootIndex]);
        }
      }
    }
  }

  return { cells, air: [], liquid: [], liner: [], spouts: [] };
}

/** Wraps a plain cell table as an ordered feature. */
export function cellFeature(cells) {
  return { cells, air: [], liquid: [], liner: [], spouts: [] };
}

/** The full-bodied underside keel used by every interior component. */
export const INTERIOR_ROOT_PROFILE = Object.freeze([
  { y: 11, radius: 12 },
  { y: 10, radius: 10 },
  { y: 9, radius: 8 },
  { y: 8, radius: 6 },
  { y: 7, radius: 5 },
  { y: 6, radius: 4 },
  { y: 5, radius: 3 },
  { y: 4, radius: 2 },
]);

/** A slimmer keel for coast components, whose budget is tighter. */
export const COAST_ROOT_PROFILE = Object.freeze([
  { y: 11, radius: 7 },
  { y: 10, radius: 6 },
  { y: 9, radius: 5 },
  { y: 8, radius: 4 },
  { y: 7, radius: 3 },
  { y: 6, radius: 3 },
  { y: 5, radius: 2 },
  { y: 4, radius: 1 },
]);

/** Re-reads the finished array and proves every shell cell is frozen. */
export function assertSeamShell({
  name,
  indices,
  edgeRole,
  coastFaces = [],
  bridgeAbutments = [],
}) {
  const abutment = abutmentCells(bridgeAbutments);
  const interiorProfile = seamShellStamp(EDGE_ROLE.interior);
  const coastProfile = seamShellStamp(EDGE_ROLE.coast);

  const faceIsCoast = (x, z) =>
    (coastFaces.includes("-z") && z === 0) ||
    (coastFaces.includes("+z") && z === DEPTH - 1) ||
    (coastFaces.includes("-x") && x === 0) ||
    (coastFaces.includes("+x") && x === WIDTH - 1);

  for (let x = 0; x < WIDTH; x += 1) {
    for (let z = 0; z < DEPTH; z += 1) {
      if (!isShell(x, z)) {
        continue;
      }

      for (let y = 0; y < HEIGHT; y += 1) {
        const key = cellKey(x, y, z);
        const expected = abutment.has(key)
          ? abutment.get(key)
          : faceIsCoast(x, z) || edgeRole === EDGE_ROLE.coast
            ? coastProfile(y)
            : interiorProfile(y);
        const actual = indices[zyxIndex(CONTINENT_SIZE, x, y, z)];

        if (actual !== expected) {
          throw new Error(
            `${name} broke the seam shell at ${x},${y},${z}: expected ${expected}, found ${actual}.`,
          );
        }
      }
    }
  }
}

export function defineContinentComponent({
  id,
  role,
  budget = "interior",
  coastFaces = [],
  stamps = [],
  features = [],
  carved,
  bridgeAbutments = [],
  probes,
  liquidIndices = [],
  linerIndices = [],
  hasChasm = false,
  hasLake = false,
  palette = CONTINENT_PALETTE,
  block = CBLOCK,
}) {
  // A chasm that clips a basin liner drains it, so the two are mutually
  // exclusive within one component.
  if (hasChasm && hasLake) {
    throw new Error(
      `${id} declares both a chasm and a sealed lake; they are mutually exclusive in one component.`,
    );
  }

  if (
    block.air !== palette.length - 1 ||
    palette[block.air] !== "minecraft:air"
  ) {
    throw new Error(
      `${id} must declare minecraft:air as the LAST palette entry so existing index constants never shift.`,
    );
  }

  const abutment = abutmentCells(bridgeAbutments);
  const interiorProfile = seamShellStamp(EDGE_ROLE.interior);
  const coastProfile = seamShellStamp(EDGE_ROLE.coast);
  const columns = [];
  let cached;

  const faceIsCoast = (x, z) =>
    (coastFaces.includes("-z") && z === 0) ||
    (coastFaces.includes("+z") && z === DEPTH - 1) ||
    (coastFaces.includes("-x") && x === 0) ||
    (coastFaces.includes("+x") && x === WIDTH - 1);

  const table = new Map();

  for (const feature of features) {
    for (const [x, y, z, index] of feature.cells) {
      table.set(cellKey(x, y, z), index);
    }
  }

  const declaredAir = new Set();

  for (const feature of features) {
    for (const [x, y, z] of feature.air) {
      declaredAir.add(cellKey(x, y, z));
    }

    if (feature.column !== undefined) {
      columns.push(feature.column);
    }
  }

  const spouts = features.flatMap((feature) => feature.spouts ?? []);

  function resolveInterior(x, y, z) {
    let index;

    for (const stamp of stamps) {
      const resolved = stamp.resolve({
        x,
        y,
        z,
        dx: x - CENTER,
        dz: z - CENTER,
        inBody: true,
        size: CONTINENT_SIZE,
      });

      if (resolved !== undefined) {
        index = resolved;
      }
    }

    const featureIndex = table.get(cellKey(x, y, z));

    return featureIndex === undefined ? index : featureIndex;
  }

  function buildIndices() {
    if (cached !== undefined) {
      return cached;
    }

    const indices = [];

    for (let x = 0; x < WIDTH; x += 1) {
      for (let y = 0; y < HEIGHT; y += 1) {
        for (let z = 0; z < DEPTH; z += 1) {
          if (isShell(x, z)) {
            const key = cellKey(x, y, z);

            if (resolveInterior(x, y, z) !== undefined) {
              throw new Error(
                `${id} resolved a stamp inside the frozen border shell at ${x},${y},${z}.`,
              );
            }

            if (abutment.has(key)) {
              indices.push(abutment.get(key));
              continue;
            }

            indices.push(
              faceIsCoast(x, z) ? coastProfile(y) : interiorProfile(y),
            );
            continue;
          }

          const resolved = resolveInterior(x, y, z);
          indices.push(resolved === undefined ? -1 : resolved);
        }
      }
    }

    // The shell's own force-clear column is declared air by construction.
    for (let x = 0; x < WIDTH; x += 1) {
      for (let z = 0; z < DEPTH; z += 1) {
        if (!isShell(x, z) || faceIsCoast(x, z)) {
          continue;
        }

        for (let y = CONTINENT_DATUM.surfaceY + 1; y < HEIGHT; y += 1) {
          declaredAir.add(cellKey(x, y, z));
        }
      }
    }

    assertSeamShell({
      name: id,
      indices,
      edgeRole: EDGE_ROLE.interior,
      coastFaces,
      bridgeAbutments,
    });

    assertAirIsDeclared({
      name: id,
      size: CONTINENT_SIZE,
      indices,
      airIndex: block.air,
      declared: (x, y, z) =>
        declaredAir.has(cellKey(x, y, z)) ||
        (carved !== undefined && carved(x, y, z)),
    });

    assertNoUnsupportedGravityBlocks({
      name: id,
      size: CONTINENT_SIZE,
      palette,
      indices,
      airIndex: block.air,
    });

    if (liquidIndices.length > 0) {
      assertSealedBasin({
        name: id,
        size: CONTINENT_SIZE,
        indices,
        liquidIndices,
        linerIndices,
        airIndex: block.air,
        spouts,
      });
    }

    assertLeafSupport({
      name: id,
      size: CONTINENT_SIZE,
      indices,
      leafIndex: block.leaves,
      logIndex: block.trunk,
    });

    assertBlockBudget({
      name: id,
      counts: countIndices(indices, {
        airIndex: block.air,
        liquidIndices,
      }),
      budget: CONTINENT_BUDGETS[budget],
    });

    cached = indices;
    return indices;
  }

  function integrityBlocks() {
    const indices = buildIndices();
    const resolved = probes.map((offset) => {
      const index =
        indices[zyxIndex(CONTINENT_SIZE, offset.x, offset.y, offset.z)];

      if (index === -1 || index === block.air) {
        throw new Error(
          `${id} integrity probe ${offset.x},${offset.y},${offset.z} lands on emptiness.`,
        );
      }

      return { offset, typeId: palette[index] };
    });

    assertProbeIsStable({ name: id, palette, probes: resolved });
    return resolved;
  }

  return {
    id,
    family: "continent",
    tier: "continent",
    role,
    structureId: `skyknights:${id}`,
    outputPath: [
      "behavior_packs",
      "sk_bp",
      "structures",
      "skyknights",
      `${id}.mcstructure`,
    ],
    size: CONTINENT_SIZE,
    palette,
    bridgeAbutments,
    coastFaces,
    get integrityBlocks() {
      return integrityBlocks();
    },
    inspect() {
      const indices = buildIndices();

      return {
        id,
        tier: `continent-${budget}`,
        family: "continent",
        role,
        size: CONTINENT_SIZE,
        palette: [...palette],
        indices,
        counts: countIndices(indices, { airIndex: block.air, liquidIndices }),
        budget: CONTINENT_BUDGETS[budget],
        integrityBlocks: integrityBlocks(),
      };
    },
    build() {
      integrityBlocks();
      return structureBuffer(CONTINENT_SIZE, palette, buildIndices());
    },
  };
}
