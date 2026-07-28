// Burn-gate features. See the design spec's `burningGate` section for the
// full safety/termination argument; this file only builds the geometry.

/**
 * An eternal ember field: netherrack at the surface, fire directly above,
 * for each `[x,z]` in `cells`. Fire on netherrack never extinguishes and
 * never consumes its substrate, so this is mechanically inert once placed -
 * `assertFireSafety` is what proves it cannot spread.
 */
export function emberField({ cells, surfaceY, netherrackIndex, fireIndex }) {
  const cellSet = new Set(cells.map(([x, z]) => `${x},${z}`));

  return {
    resolve(context) {
      const { x, y, z } = context;

      if (!cellSet.has(`${x},${z}`)) {
        return undefined;
      }

      if (y === surfaceY) {
        return netherrackIndex;
      }

      if (y === surfaceY + 1) {
        return fireIndex;
      }

      return undefined;
    },
  };
}

/**
 * A finite, contained oak grove plus sealed lava cups, for the reactive
 * pyre. The grove is a simple trunk grid (every 3rd column, in both axes,
 * inside `zone`) topped with a leaf canopy - `assertLeafSupport` keeps every
 * leaf within range of a log. Each lava cup is fully lined on five sides
 * (open only straight up, across the fixed air gap toward the grove) so it
 * cannot flow, spread, or create new lava; ignition only ever happens across
 * that one declared gap. Returns an ordered stamp array (grove first, then
 * one stamp per cup).
 */
export function pyreFuel({ zone, lavaCups, logIndex, leafIndex, lavaIndex, linerIndex, airIndex }) {
  const stamps = [
    {
      resolve(context) {
        const { x, y, z } = context;

        if (
          x < zone.minX ||
          x > zone.maxX ||
          y < zone.minY ||
          y > zone.maxY ||
          z < zone.minZ ||
          z > zone.maxZ
        ) {
          return undefined;
        }

        const isTrunkColumn =
          (x - zone.minX) % 3 === 0 && (z - zone.minZ) % 3 === 0;

        if (isTrunkColumn && y <= zone.minY + 3) {
          return logIndex;
        }

        if (y > zone.minY + 3) {
          return leafIndex;
        }

        return undefined;
      },
    },
  ];

  for (const cup of lavaCups) {
    const { x, y, z } = cup;

    stamps.push({
      resolve(context) {
        const dx = context.x - x;
        const dy = context.y - y;
        const dz = context.z - z;

        if (dx === 0 && dy === 0 && dz === 0) {
          return lavaIndex;
        }

        if (dy === -1 && dx === 0 && dz === 0) {
          return linerIndex;
        }

        if (dy === 0 && ((Math.abs(dx) === 1 && dz === 0) || (dx === 0 && Math.abs(dz) === 1))) {
          return linerIndex;
        }

        if (dx === 0 && dy === 1 && dz === 0) {
          return airIndex;
        }

        return undefined;
      },
    });
  }

  return stamps;
}
