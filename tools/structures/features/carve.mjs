// Interior carves: cave tubes, cave mouths, chasms, and arches. Every one of
// these tests `context.inBody` (computed by `buildIslandIndices`/
// `defineContinentComponent` from the same `body` the module builds with)
// before writing air, per RULE 3 of the air/void contract - a carve node
// whose radius reaches outside the body silhouette simply writes nothing
// there, so caves can never punch a hole in a neighbour.

function linePoints([x0, y0, z0], [x1, y1, z1]) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), 1);
  const points = [];

  for (let i = 0; i <= steps; i += 1) {
    points.push([
      x0 + Math.round(((x1 - x0) * i) / steps),
      y0 + Math.round(((y1 - y0) * i) / steps),
      z0 + Math.round(((z1 - z0) * i) / steps),
    ]);
  }

  return points;
}

/**
 * A tube along an integer waypoint path. `roofDepth` (>= 2) keeps every
 * carved cell at or below `body.topY - roofDepth`, so a tube can never break
 * the walkable surface implicitly - use `caveMouth` for that.
 *
 * Returns `{ stamp, carved }`: `carved(x,y,z)` reports every cell the stamp
 * can carve, for `assertCarveIsIntentional` - independent of `body.contains`,
 * since a carve node whose radius reaches outside the body simply never
 * gets asked about by that assertion (which only visits in-body cells).
 */
export function caveTube({ path, radius, airIndex, body, roofDepth }) {
  const nodes = path.length === 1 ? [path[0]] : [];

  for (let i = 0; i < path.length - 1; i += 1) {
    nodes.push(...linePoints(path[i], path[i + 1]));
  }

  function inTube(x, y, z) {
    if (y > body.topY - roofDepth) {
      return false;
    }

    return nodes.some(
      ([nx, ny, nz]) =>
        Math.abs(x - nx) <= radius && Math.abs(y - ny) <= radius && Math.abs(z - nz) <= radius,
    );
  }

  return {
    stamp: {
      resolve(context) {
        const { x, y, z, inBody } = context;
        return inBody && inTube(x, y, z) ? airIndex : undefined;
      },
    },
    carved: inTube,
  };
}

/** The one carve permitted to reach `body.topY` - an explicit cave opening. */
export function caveMouth({ x, y, z, radius, airIndex }) {
  function inMouth(cx, cy, cz) {
    const dx = cx - x;
    const dy = cy - y;
    const dz = cz - z;
    return dx * dx + dy * dy + dz * dz <= radius * radius;
  }

  return {
    stamp: {
      resolve(context) {
        return context.inBody && inMouth(context.x, context.y, context.z)
          ? airIndex
          : undefined;
      },
    },
    carved: inMouth,
  };
}

/** A straight canyon along X, clipped to the body silhouette. */
export function chasm({ minX, maxX, centerZ, width, topY, bottomY, airIndex }) {
  const halfWidth = Math.floor(width / 2);

  function inChasm(x, y, z) {
    if (x < minX || x > maxX || y < bottomY || y > topY) {
      return false;
    }

    return Math.abs(z - centerZ) <= halfWidth;
  }

  return {
    stamp: {
      resolve(context) {
        return context.inBody && inChasm(context.x, context.y, context.z)
          ? airIndex
          : undefined;
      },
    },
    carved: inChasm,
  };
}

/** A short horizontal opening through a solid mass, e.g. under a bridge. */
export function arch({ x, z, y, span, airIndex }) {
  const half = Math.floor(span / 2);

  function inArch(cx, cy, cz) {
    if (Math.abs(cx - x) > half || cz !== z) {
      return false;
    }

    return cy >= y && cy <= y + 2;
  }

  return {
    stamp: {
      resolve(context) {
        return context.inBody && inArch(context.x, context.y, context.z)
          ? airIndex
          : undefined;
      },
    },
    carved: inArch,
  };
}
