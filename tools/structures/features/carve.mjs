// Negative relief: caves, chasms, and arches.
//
// RULE 3 of the air/void contract lives here. Every carve takes the island
// `body` and writes `airIndex` ONLY where `body.contains(x, y, z)` is true. A
// carve node whose radius reaches outside the body simply writes nothing there,
// which is what lets caves sit next to component seams and neighbouring islands
// without punching holes in them.

function emptyResult(cells, air) {
  return { cells, air, liquid: [], liner: [], spouts: [] };
}

/** Integer 3D line between two waypoints; rounding is half-up on integers. */
export function linePoints(from, to) {
  const [x0, y0, z0] = from;
  const [x1, y1, z1] = to;
  const steps = Math.max(
    Math.abs(x1 - x0),
    Math.abs(y1 - y0),
    Math.abs(z1 - z0),
  );

  if (steps === 0) {
    return [[x0, y0, z0]];
  }

  const points = [];
  const half = steps;
  const scale = steps * 2;

  for (let step = 0; step <= steps; step += 1) {
    points.push([
      x0 + Math.floor(((x1 - x0) * step * 2 + half) / scale),
      y0 + Math.floor(((y1 - y0) * step * 2 + half) / scale),
      z0 + Math.floor(((z1 - z0) * step * 2 + half) / scale),
    ]);
  }

  return points;
}

/**
 * A walkable tunnel through the interior. `roofDepth` keeps the tube from
 * breaking the walkable surface implicitly; use `caveMouth` where an opening is
 * actually wanted.
 */
export function caveTube({ path, radius, airIndex, body, roofDepth = 2 }) {
  if (roofDepth < 2) {
    throw new Error("caveTube roofDepth must be at least 2.");
  }

  const ceiling = body.topY - roofDepth;
  const seen = new Set();
  const cells = [];
  const air = [];

  for (let node = 0; node + 1 < path.length; node += 1) {
    for (const [px, py, pz] of linePoints(path[node], path[node + 1])) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        for (let dy = -radius; dy <= radius; dy += 1) {
          for (let dz = -radius; dz <= radius; dz += 1) {
            const x = px + dx;
            const y = py + dy;
            const z = pz + dz;

            if (y > ceiling || !body.contains(x, y, z)) {
              continue;
            }

            const key = `${x},${y},${z}`;

            if (seen.has(key)) {
              continue;
            }

            seen.add(key);
            cells.push([x, y, z, airIndex]);
            air.push([x, y, z]);
          }
        }
      }
    }
  }

  return emptyResult(cells, air);
}

/** The only carve permitted to reach `body.topY`: a deliberate cave entrance. */
export function caveMouth({ x, y, z, radius, airIndex, body }) {
  const cells = [];
  const air = [];

  for (let dx = -radius; dx <= radius; dx += 1) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        const cx = x + dx;
        const cy = y + dy;
        const cz = z + dz;

        if (!body.contains(cx, cy, cz)) {
          continue;
        }

        cells.push([cx, cy, cz, airIndex]);
        air.push([cx, cy, cz]);
      }
    }
  }

  return emptyResult(cells, air);
}

/**
 * A straight canyon. `axis: "x"` runs along X and is described by
 * `minX/maxX/centerZ`; `axis: "z"` runs along Z and is described by
 * `minZ/maxZ/centerX`.
 */
export function chasm({
  axis = "x",
  minX,
  maxX,
  centerZ,
  minZ,
  maxZ,
  centerX,
  width,
  topY,
  bottomY,
  airIndex,
  body,
}) {
  const half = Math.floor(width / 2);
  const cells = [];
  const air = [];

  const spanFrom = axis === "x" ? minX : minZ;
  const spanTo = axis === "x" ? maxX : maxZ;
  const crossCenter = axis === "x" ? centerZ : centerX;

  for (let along = spanFrom; along <= spanTo; along += 1) {
    for (
      let cross = crossCenter - half;
      cross <= crossCenter + half;
      cross += 1
    ) {
      for (let y = bottomY; y <= topY; y += 1) {
        const x = axis === "x" ? along : cross;
        const z = axis === "x" ? cross : along;

        if (!body.contains(x, y, z)) {
          continue;
        }

        cells.push([x, y, z, airIndex]);
        air.push([x, y, z]);
      }
    }
  }

  return emptyResult(cells, air);
}

/**
 * A chasm expressed as a mask instead of a carve.
 *
 * Continent components build their slab from a mask rather than from a
 * tapered ellipsoid, so a chasm that cuts fully through the slab is genuinely
 * outside the silhouette: those cells stay -1 and cost nothing, instead of
 * ~1800 force-clear air cells that would not fit the component air budget.
 */
export function chasmMask({ axis = "z", center, width }) {
  const half = Math.floor(width / 2);

  return (x, z) => {
    const cross = axis === "z" ? x : z;
    return cross >= center - half && cross <= center + half;
  };
}

/**
 * An arched opening through a wall of rock. The profile is a pure-integer
 * parabola: no trig, no floating-point exponentials.
 */
export function arch({
  x,
  z,
  y,
  span,
  height,
  airIndex,
  body,
  axis = "x",
  depth = 1,
}) {
  const half = Math.floor(span / 2);
  const cells = [];
  const air = [];

  for (let offset = -half; offset <= half; offset += 1) {
    const rise =
      height - Math.floor((height * offset * offset * 4) / (span * span));

    for (let layer = 0; layer < rise; layer += 1) {
      for (let thickness = 0; thickness < depth; thickness += 1) {
        const cx = axis === "x" ? x + offset : x + thickness;
        const cz = axis === "x" ? z + thickness : z + offset;
        const cy = y + layer;

        if (!body.contains(cx, cy, cz)) {
          continue;
        }

        cells.push([cx, cy, cz, airIndex]);
        air.push([cx, cy, cz]);
      }
    }
  }

  return emptyResult(cells, air);
}
