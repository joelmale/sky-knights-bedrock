// Run-3 large ambient-island structure catalog.
//
// This module is deliberately additive. The run-1/run-2 modules and their
// structure identifiers remain untouched, while the planner can opt new `a3`
// islands into this catalog. Logical crags and landmarks are composed from
// square, edge-to-edge parts so the same source structure can be rotated into
// multiple grid slots without overlaps or seams.

import { structureBuffer, zyxIndex } from "./nbt.mjs";
import {
  assertBlockBudget,
  assertNoUnsupportedGravityBlocks,
  assertProbeIsStable,
  countIndices,
} from "./assert.mjs";
import {
  A3_AMBIENT_PART_BOX_CEILING,
  A3_AMBIENT_SOLID_BLOCK_CEILING,
  A3_TIER_GEOMETRY,
  FAMILY_KITS,
} from "./tier_shared.mjs";

export const A3_AMBIENT_FAMILIES = Object.freeze([
  "verdant",
  "desert",
  "tundra",
  "volcanic",
]);
export const A3_AMBIENT_TIERS = Object.freeze([
  "islet",
  "standard",
  "crag",
  "landmark",
]);

const ROTATIONS = Object.freeze({
  none: "None",
  clockwise: "Rotate90",
  half: "Rotate180",
  counterclockwise: "Rotate270",
});

const FAMILY_SALT = Object.freeze({
  verdant: 3,
  desert: 7,
  tundra: 11,
  volcanic: 17,
});

function a3Palette(family) {
  const kit = FAMILY_KITS[family];
  // Sand is intentionally replaced by smooth sandstone. A tapered island's
  // widest surface overhangs the layer below, so emitting sand there would
  // create falling-block churn as soon as a part loads.
  const stableSurface =
    family === "desert"
      ? kit.palette[kit.block.cap]
      : kit.palette[kit.block.surface];

  return Object.freeze([
    kit.palette[kit.block.core],
    kit.palette[kit.block.subsurface],
    stableSurface,
    kit.palette[kit.block.accent],
    kit.palette[kit.block.ore],
    "minecraft:air",
  ]);
}

const BLOCK = Object.freeze({
  core: 0,
  subsurface: 1,
  surface: 2,
  accent: 3,
  ore: 4,
  air: 5,
});

/**
 * Integer-only square ellipsoid. Doubled coordinates preserve exact symmetry
 * around the half-block centre of even-sized crags and landmarks.
 */
function a3Body(geometry) {
  const width = geometry.size[0];
  const depth = geometry.size[2];
  const centerX2 = width - 1;
  const centerZ2 = depth - 1;
  const baseRadius = 3;

  const radiusAt = (y) =>
    baseRadius +
    Math.floor((y * (geometry.topRadius - baseRadius)) / geometry.topY);

  const contains = (x, y, z) => {
    if (y < 0 || y > geometry.topY) {
      return false;
    }

    const radius2 = radiusAt(y) * 2;
    const dx2 = x * 2 - centerX2;
    const dz2 = z * 2 - centerZ2;
    return dx2 * dx2 + dz2 * dz2 <= radius2 * radius2;
  };

  return Object.freeze({
    centerX: centerX2 / 2,
    centerZ: centerZ2 / 2,
    topY: geometry.topY,
    radiusAt,
    contains,
  });
}

function topSurfaceCells(geometry, body) {
  let cells = 0;

  for (let x = 0; x < geometry.size[0]; x += 1) {
    for (let z = 0; z < geometry.size[2]; z += 1) {
      if (body.contains(x, body.topY, z)) {
        cells += 1;
      }
    }
  }

  return cells;
}

function rotatedIntegrityBlock(probe, size, rotation) {
  const { x, y, z } = probe.offset;

  if (rotation === ROTATIONS.clockwise) {
    return {
      offset: { x: size[2] - 1 - z, y, z: x },
      typeId: probe.typeId,
    };
  }
  if (rotation === ROTATIONS.half) {
    return {
      offset: { x: size[0] - 1 - x, y, z: size[2] - 1 - z },
      typeId: probe.typeId,
    };
  }
  if (rotation === ROTATIONS.counterclockwise) {
    return {
      offset: { x: z, y, z: size[0] - 1 - x },
      typeId: probe.typeId,
    };
  }
  return probe;
}

function paletteIndexAt(family, body, globalX, y, globalZ) {
  if (!body.contains(globalX, y, globalZ)) {
    return -1;
  }

  if (y === body.topY) {
    const accentRoll = (globalX * 31 + globalZ * 17 + FAMILY_SALT[family]) % 29;
    return accentRoll === 0 ? BLOCK.accent : BLOCK.surface;
  }

  if (
    y <= body.topY - 4 &&
    (globalX * 13 + y * 19 + globalZ * 23 + FAMILY_SALT[family]) % 97 === 0
  ) {
    return BLOCK.ore;
  }

  return y >= body.topY - 2 ? BLOCK.subsurface : BLOCK.core;
}

function integrityProbe(id, size, palette, indices) {
  const [width, height, depth] = size;
  const centerX = Math.floor((width - 1) / 2);
  const centerZ = Math.floor((depth - 1) / 2);
  let selected;
  let selectedDistance = Number.POSITIVE_INFINITY;

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        const index = indices[zyxIndex(size, x, y, z)];

        if (index < 0 || index === BLOCK.air) {
          continue;
        }

        const distance =
          Math.abs(x - centerX) + Math.abs(z - centerZ) + Math.abs(y);

        if (distance < selectedDistance) {
          selected = {
            offset: { x, y, z },
            typeId: palette[index],
          };
          selectedDistance = distance;
        }
      }
    }
  }

  if (selected === undefined) {
    throw new Error(`${id} has no stable integrity-probe candidate.`);
  }

  assertProbeIsStable({ name: id, palette, probes: [selected] });
  return selected;
}

function defineA3Part({
  id,
  family,
  tier,
  role,
  geometry,
  body,
  sourceColumn,
  sourceRow,
}) {
  const size = Object.freeze([
    geometry.partSize,
    geometry.size[1],
    geometry.partSize,
  ]);
  const boxCells = size[0] * size[1] * size[2];

  if (size[0] > 64 || size[2] > 64) {
    throw new Error(
      `${id} exceeds Bedrock's 64-block horizontal structure limit.`,
    );
  }
  if (boxCells > A3_AMBIENT_PART_BOX_CEILING) {
    throw new Error(
      `${id} has ${boxCells} box cells; the a3 part ceiling is ${A3_AMBIENT_PART_BOX_CEILING}.`,
    );
  }

  const palette = a3Palette(family);
  let cached;

  function inspect() {
    if (cached !== undefined) {
      return cached;
    }

    const indices = new Array(boxCells);
    const originX = sourceColumn * geometry.partSize;
    const originZ = sourceRow * geometry.partSize;

    for (let x = 0; x < size[0]; x += 1) {
      for (let y = 0; y < size[1]; y += 1) {
        for (let z = 0; z < size[2]; z += 1) {
          indices[zyxIndex(size, x, y, z)] = paletteIndexAt(
            family,
            body,
            originX + x,
            y,
            originZ + z,
          );
        }
      }
    }

    assertNoUnsupportedGravityBlocks({
      name: id,
      size,
      palette,
      indices,
      airIndex: BLOCK.air,
    });

    const counts = countIndices(indices, {
      airIndex: BLOCK.air,
      liquidIndices: [],
    });
    const budget = Object.freeze({
      tier: `a3-${tier}-part`,
      boxCells,
      maxSolid: A3_AMBIENT_SOLID_BLOCK_CEILING,
      maxAir: 0,
      maxLiquid: 0,
    });
    assertBlockBudget({ name: id, counts, budget });

    cached = Object.freeze({
      id,
      family,
      tier,
      role,
      size,
      palette,
      indices,
      counts: Object.freeze(counts),
      budget,
      integrityBlocks: Object.freeze([
        integrityProbe(id, size, palette, indices),
      ]),
    });
    return cached;
  }

  return Object.freeze({
    id,
    family,
    tier,
    role,
    structureId: `skyknights:${id}`,
    outputPath: Object.freeze([
      "behavior_packs",
      "sk_bp",
      "structures",
      "skyknights",
      `${id}.mcstructure`,
    ]),
    size,
    palette,
    get integrityBlocks() {
      return inspect().integrityBlocks;
    },
    inspect,
    build() {
      const inspection = inspect();
      return structureBuffer(size, palette, inspection.indices);
    },
  });
}

function sourceRoles(tier) {
  if (tier === "islet" || tier === "standard") {
    return [{ role: "whole", column: 0, row: 0 }];
  }
  if (tier === "crag") {
    return [{ role: "quadrant", column: 0, row: 0 }];
  }
  return [
    { role: "outer_corner", column: 0, row: 0 },
    { role: "outer_left", column: 1, row: 0 },
    { role: "outer_right", column: 2, row: 0 },
    { role: "inner", column: 1, row: 1 },
  ];
}

function placementSpecs(tier) {
  if (tier === "islet" || tier === "standard") {
    return [{ role: "whole", column: 0, row: 0, rotation: ROTATIONS.none }];
  }
  if (tier === "crag") {
    return [
      { role: "quadrant", column: 0, row: 0, rotation: ROTATIONS.none },
      { role: "quadrant", column: 1, row: 0, rotation: ROTATIONS.clockwise },
      { role: "quadrant", column: 1, row: 1, rotation: ROTATIONS.half },
      {
        role: "quadrant",
        column: 0,
        row: 1,
        rotation: ROTATIONS.counterclockwise,
      },
    ];
  }
  return [
    { role: "outer_corner", column: 0, row: 0, rotation: ROTATIONS.none },
    { role: "outer_left", column: 1, row: 0, rotation: ROTATIONS.none },
    { role: "outer_right", column: 2, row: 0, rotation: ROTATIONS.none },
    {
      role: "outer_corner",
      column: 3,
      row: 0,
      rotation: ROTATIONS.clockwise,
    },
    {
      role: "outer_left",
      column: 3,
      row: 1,
      rotation: ROTATIONS.clockwise,
    },
    {
      role: "inner",
      column: 1,
      row: 1,
      rotation: ROTATIONS.none,
    },
    {
      role: "inner",
      column: 2,
      row: 1,
      rotation: ROTATIONS.clockwise,
    },
    {
      role: "outer_right",
      column: 3,
      row: 2,
      rotation: ROTATIONS.clockwise,
    },
    {
      role: "inner",
      column: 1,
      row: 2,
      rotation: ROTATIONS.counterclockwise,
    },
    {
      role: "inner",
      column: 2,
      row: 2,
      rotation: ROTATIONS.half,
    },
    {
      role: "outer_corner",
      column: 3,
      row: 3,
      rotation: ROTATIONS.half,
    },
    {
      role: "outer_left",
      column: 2,
      row: 3,
      rotation: ROTATIONS.half,
    },
    {
      role: "outer_right",
      column: 1,
      row: 3,
      rotation: ROTATIONS.half,
    },
    {
      role: "outer_corner",
      column: 0,
      row: 3,
      rotation: ROTATIONS.counterclockwise,
    },
    {
      role: "outer_left",
      column: 0,
      row: 2,
      rotation: ROTATIONS.counterclockwise,
    },
    {
      role: "outer_right",
      column: 0,
      row: 1,
      rotation: ROTATIONS.counterclockwise,
    },
  ].sort((left, right) => left.row - right.row || left.column - right.column);
}

function catalogEntry(tier, family, structures) {
  const geometry = A3_TIER_GEOMETRY[tier];
  const body = a3Body(geometry);
  const byRole = new Map(
    structures.map((structure) => [structure.role, structure]),
  );
  const parts = placementSpecs(tier).map((placement) => {
    const source = byRole.get(placement.role);

    if (source === undefined) {
      throw new Error(`Missing a3 ${tier}/${family}/${placement.role} source.`);
    }

    const sourceIntegrityBlock = source.integrityBlocks[0];
    return Object.freeze({
      structureId: source.structureId,
      origin: Object.freeze({
        x: placement.column * geometry.partSize,
        y: 0,
        z: placement.row * geometry.partSize,
      }),
      rotation: placement.rotation,
      row: placement.row,
      size: source.size,
      integrityBlock: rotatedIntegrityBlock(
        sourceIntegrityBlock,
        source.size,
        placement.rotation,
      ),
      sourceIntegrityBlock,
    });
  });
  const center = Math.floor((geometry.size[0] - 1) / 2);

  return Object.freeze({
    id: `a3_${tier}_${family}`,
    family,
    tier,
    size: Object.freeze({
      x: geometry.size[0],
      y: geometry.size[1],
      z: geometry.size[2],
    }),
    radius: geometry.clearanceRadius,
    heightRadius: geometry.heightRadius,
    observerClearance: Math.max(80, geometry.clearanceRadius + 48),
    safeDock: Object.freeze({
      x: center,
      y: geometry.topY + 1,
      z: center,
    }),
    topY: geometry.topY,
    topSurfaceCells: topSurfaceCells(geometry, body),
    partGrid: geometry.grid,
    parts: Object.freeze(parts),
    body,
  });
}

const modules = [];
const entries = {};

for (const family of A3_AMBIENT_FAMILIES) {
  for (const tier of A3_AMBIENT_TIERS) {
    const geometry = A3_TIER_GEOMETRY[tier];
    const body = a3Body(geometry);
    const tierStructures = sourceRoles(tier).map(({ role, column, row }) =>
      defineA3Part({
        id: `a3_${tier}_${family}_${role}`,
        family,
        tier,
        role,
        geometry,
        body,
        sourceColumn: column,
        sourceRow: row,
      }),
    );
    modules.push(...tierStructures);
    entries[`${tier}_${family}`] = catalogEntry(tier, family, tierStructures);
  }
}

/** Spread this list into `tools/generate-structures.mjs` during integration. */
export const A3_AMBIENT_STRUCTURE_MODULES = Object.freeze(
  modules.sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  ),
);

/** Planner-facing logical templates; multipart origins are relative to island origin. */
export const A3_AMBIENT_CATALOG = Object.freeze(entries);
