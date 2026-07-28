// Sealed lake/lava basins. `liquidIndex` is generic so the same function
// builds a water pond or a lava cup - only the caller's palette differs.
//
// Emit order (liner first, then liquid, then headroom) matters only in the
// sense that liner must fully bound the liquid; because this is expressed as
// a single stamp keyed on distance-from-centre, the ring is always written
// wherever the liquid is not, so the ordering constraint is satisfied by
// construction rather than by two separate passes.

function insideRing(dx, dz, radiusX, radiusZ) {
  return (dx * dx) / (radiusX * radiusX) + (dz * dz) / (radiusZ * radiusZ) <= 1;
}

/**
 * Returns `{ stamps, liquidCells, linerCells }`. `liquidCells`/`linerCells`
 * are plain `[x,y,z]` lists, useful for tests and for `assertSealedBasin`.
 */
export function lakeBasin({
  centerX,
  centerZ,
  radiusX,
  radiusZ,
  surfaceY,
  depth,
  liquidIndex,
  linerIndex,
  airIndex,
}) {
  const floorY = surfaceY - depth - 1;
  const liquidCells = [];
  const linerCells = [];

  for (let dx = -(radiusX + 1); dx <= radiusX + 1; dx += 1) {
    for (let dz = -(radiusZ + 1); dz <= radiusZ + 1; dz += 1) {
      const interior = insideRing(dx, dz, radiusX, radiusZ);
      const ring = insideRing(dx, dz, radiusX + 1, radiusZ + 1);

      if (interior) {
        for (let y = surfaceY - depth; y <= surfaceY; y += 1) {
          liquidCells.push([centerX + dx, y, centerZ + dz]);
        }
        linerCells.push([centerX + dx, floorY, centerZ + dz]);
      } else if (ring) {
        for (let y = floorY; y <= surfaceY; y += 1) {
          linerCells.push([centerX + dx, y, centerZ + dz]);
        }
      }
    }
  }

  const stamp = {
    resolve(context) {
      const { x, y, z } = context;
      const dx = x - centerX;
      const dz = z - centerZ;

      if (insideRing(dx, dz, radiusX, radiusZ)) {
        if (y === surfaceY + 1) {
          return airIndex;
        }

        if (y >= surfaceY - depth && y <= surfaceY) {
          return liquidIndex;
        }

        if (y === floorY) {
          return linerIndex;
        }

        return undefined;
      }

      if (insideRing(dx, dz, radiusX + 1, radiusZ + 1) && y >= floorY && y <= surfaceY) {
        return linerIndex;
      }

      return undefined;
    },
  };

  return { stamps: [stamp], liquidCells, linerCells };
}
