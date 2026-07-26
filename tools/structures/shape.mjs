// Shared island-body helpers for every `.mcstructure` generator.
//
// Every island module composes the same three phases so that terrain shape,
// strata, ore seeding, docks, wall stamping, and vegetation stay consistent:
//
//   1. `taperedEllipsoidBody` / `canonicalIslandBody` describe the solid body.
//   2. `buildIslandIndices` fills strata, then ore pockets, then ordered stamps.
//   3. `assertSolidBody` proves the body has no interior gap before writing NBT.
//
// Stamps are applied in array order and the last match wins, so ordering inside
// an island module is part of that island's output contract.

import { zyxIndex } from "./nbt.mjs";

const DEFAULT_BASE_RADIUS_X = 3;
const DEFAULT_BASE_RADIUS_Z = 2;
const DEFAULT_SUBSURFACE_DEPTH = 2;

/**
 * A vertically tapered elliptical island body.
 *
 * Radii grow with `y` using integer arithmetic only, so the same body is
 * reproduced by every JavaScript engine.
 */
export function taperedEllipsoidBody({
  centerX,
  centerZ,
  topY,
  growthX,
  growthZ,
  baseRadiusX = DEFAULT_BASE_RADIUS_X,
  baseRadiusZ = DEFAULT_BASE_RADIUS_Z,
}) {
  if (topY <= 0) {
    throw new Error(`Island body topY must be positive; received ${topY}.`);
  }

  const radiusAt = (y) => [
    baseRadiusX + Math.floor((y * growthX) / topY),
    baseRadiusZ + Math.floor((y * growthZ) / topY),
  ];

  const contains = (x, y, z) => {
    if (y < 0 || y > topY) {
      return false;
    }

    const [radiusX, radiusZ] = radiusAt(y);
    const dx = x - centerX;
    const dz = z - centerZ;
    return (
      (dx * dx) / (radiusX * radiusX) + (dz * dz) / (radiusZ * radiusZ) <= 1
    );
  };

  return {
    centerX,
    centerZ,
    topY,
    growthX,
    growthZ,
    baseRadiusX,
    baseRadiusZ,
    radiusAt,
    contains,
  };
}

/**
 * The canonical body derived from a structure size.
 *
 * `centerX`/`centerZ` sit one block inside the widest ring so the top layer
 * spans `1..size[0] - 2` and `1..size[2] - 2`, leaving room for the dock deck
 * that overhangs the low-X face. Matches the hand-tuned Ember Outpost and
 * Frostspire bodies exactly.
 */
export function canonicalIslandBody(size) {
  const geometry = canonicalGeometry(size);
  return taperedEllipsoidBody({
    centerX: geometry.centerX,
    centerZ: geometry.centerZ,
    topY: geometry.topY,
    growthX: geometry.centerX - 4,
    growthZ: geometry.centerZ - 3,
  });
}

/** Canonical center/top-layer geometry for a structure size. */
export function canonicalGeometry(size) {
  return {
    centerX: Math.floor((size[0] - 1) / 2),
    centerZ: Math.floor((size[2] - 1) / 2),
    topY: size[1] - 5,
  };
}

/** Resolves the strata palette index for a body cell. */
export function strataIndex(y, body, strata) {
  const subsurfaceDepth = strata.subsurfaceDepth ?? DEFAULT_SUBSURFACE_DEPTH;

  if (y === body.topY) {
    return strata.surface;
  }

  if (y >= body.topY - subsurfaceDepth) {
    return strata.subsurface;
  }

  return strata.core;
}

function resolveIndex(index, context) {
  return typeof index === "function" ? index(context) : index;
}

/** An axis-aligned solid region, optionally narrowed by `filter`. */
export function boxStamp({
  index,
  minX = 0,
  maxX = Number.POSITIVE_INFINITY,
  minY,
  maxY = minY,
  minZ = 0,
  maxZ = Number.POSITIVE_INFINITY,
  filter,
}) {
  return {
    resolve(context) {
      const { x, y, z } = context;

      if (
        x < minX ||
        x > maxX ||
        y < minY ||
        y > maxY ||
        z < minZ ||
        z > maxZ
      ) {
        return undefined;
      }

      if (filter !== undefined && !filter(context)) {
        return undefined;
      }

      return resolveIndex(index, context);
    },
  };
}

/** A single block, used for chests and other exact anchors. */
export function blockStamp({ index, x, y, z }) {
  return {
    resolve(context) {
      if (context.x !== x || context.y !== y || context.z !== z) {
        return undefined;
      }

      return resolveIndex(index, context);
    },
  };
}

/**
 * Hollow perimeter walls for huts, ruins, towers, shrines, and arenas.
 *
 * `index` may be a function of the cell context to produce weathered masonry.
 * `opening` marks doorway cells that stay empty.
 */
export function perimeterStamp({
  index,
  minX,
  maxX,
  minY,
  maxY,
  minZ,
  maxZ,
  opening,
}) {
  return {
    resolve(context) {
      const { x, y, z } = context;

      if (
        x < minX ||
        x > maxX ||
        y < minY ||
        y > maxY ||
        z < minZ ||
        z > maxZ
      ) {
        return undefined;
      }

      const onPerimeter = x === minX || x === maxX || z === minZ || z === maxZ;

      if (!onPerimeter) {
        return undefined;
      }

      if (opening !== undefined && opening(context)) {
        return undefined;
      }

      return resolveIndex(index, context);
    },
  };
}

/**
 * Center-relative decoration at one layer: vegetation, magma vents, ice shards.
 *
 * Offsets are `[dx, dz]` pairs measured from the body center so decoration
 * follows the silhouette instead of the structure corner.
 */
export function scatterStamp({ index, y, offsets }) {
  return {
    resolve(context) {
      if (context.y !== y) {
        return undefined;
      }

      for (const [dx, dz] of offsets) {
        if (context.dx === dx && context.dz === dz) {
          return resolveIndex(index, context);
        }
      }

      return undefined;
    },
  };
}

/** A tree canopy or other solid vegetation mass above the surface layer. */
export function canopyStamp({ index, y, minX, maxX, minZ, maxZ }) {
  return boxStamp({ index, minX, maxX, minY: y, maxY: y, minZ, maxZ });
}

/**
 * A center-relative ore cluster. Ore only replaces body cells, so a pocket can
 * never punch a hole in the silhouette.
 */
export function orePocket({ index, minY, maxY, offsets }) {
  return {
    resolve(context) {
      if (!context.inBody || context.y < minY || context.y > maxY) {
        return undefined;
      }

      for (const [dx, dz] of offsets) {
        if (context.dx === dx && context.dz === dz) {
          return resolveIndex(index, context);
        }
      }

      return undefined;
    },
  };
}

/**
 * A landing deck plus optional support beams, returned as an ordered stamp
 * array. Every island exposes exactly one dock so ship arrival stays uniform.
 */
export function dockPlatform({ index, y, minX, maxX, minZ, maxZ, supports }) {
  const stamps = [
    boxStamp({ index, minX, maxX, minY: y, maxY: y, minZ, maxZ }),
  ];

  if (supports !== undefined) {
    const rows = [...supports.z].sort((left, right) => left - right);
    stamps.push(
      boxStamp({
        index: supports.index ?? index,
        minX: supports.minX,
        maxX: supports.maxX,
        minY: supports.y,
        maxY: supports.y,
        minZ: rows[0],
        maxZ: rows[rows.length - 1],
        filter: (context) => rows.includes(context.z),
      }),
    );
  }

  return stamps;
}

/**
 * Fills a structure index array in Bedrock ZYX order (Z fastest, then Y, then
 * X). Resolution order per cell is: air, body strata, ore pockets, stamps.
 */
export function buildIslandIndices({
  size,
  body,
  strata,
  orePockets = [],
  stamps = [],
}) {
  const [width, height, depth] = size;
  const indices = [];

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        const inBody = body.contains(x, y, z);
        const context = {
          x,
          y,
          z,
          dx: x - body.centerX,
          dz: z - body.centerZ,
          inBody,
          size,
        };
        let index = -1;

        if (inBody) {
          index = strataIndex(y, body, strata);

          for (const pocket of orePockets) {
            const resolved = pocket.resolve(context);

            if (resolved !== undefined) {
              index = resolved;
            }
          }
        }

        for (const stamp of stamps) {
          const resolved = stamp.resolve(context);

          if (resolved !== undefined) {
            index = resolved;
          }
        }

        indices.push(index);
      }
    }
  }

  return indices;
}

/**
 * The solidity assertion every island generator must call before writing NBT.
 * A body cell left as air (-1) would place a floating island with a hole a
 * player can fall through, so this throws instead of shipping the structure.
 */
export function assertSolidBody({ name, size, body, indices }) {
  const [width, , depth] = size;

  for (let y = 0; y <= body.topY; y += 1) {
    for (let x = 0; x < width; x += 1) {
      for (let z = 0; z < depth; z += 1) {
        if (!body.contains(x, y, z)) {
          continue;
        }

        if (indices[zyxIndex(size, x, y, z)] === -1) {
          throw new Error(`${name} contains a body gap at ${x},${y},${z}.`);
        }
      }
    }
  }
}
