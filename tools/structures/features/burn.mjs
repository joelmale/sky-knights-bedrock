// The two burn features.
//
// emberField - `minecraft:fire` on `minecraft:netherrack`. Vanilla netherrack
//              fire never extinguishes and never consumes its substrate, so an
//              ember island burns forever and costs zero ongoing block updates.
//              The generator-enforced safety ring in `assertFireSafety` keeps
//              every flammable block far outside Bedrock's spread neighbourhood.
//
// pyreFuel   - a healthy grove plus exactly two SEALED lava sources. The island
//              ships unburnt and burns down once a player arrives. Termination
//              is proved by `assertPyreTermination`, not by hope.

function result(cells, extra = {}) {
  return { cells, air: [], liquid: [], liner: [], spouts: [], ...extra };
}

export function emberField({
  cells: footprint,
  surfaceY,
  netherrackIndex,
  fireIndex,
}) {
  const cells = [];
  const fireCells = [];

  for (const [x, z] of footprint) {
    cells.push([x, surfaceY, z, netherrackIndex]);
    cells.push([x, surfaceY + 1, z, fireIndex]);
    fireCells.push([x, surfaceY + 1, z]);
  }

  return result(cells, { fireCells });
}

/**
 * A contained grove and its two sealed ignition cups.
 *
 * `trees` is a fixed per-module table - modules are static files and must
 * produce byte-identical output, so nothing here is ever hashed at runtime.
 */
export function pyreFuel({
  zone,
  trees,
  lavaCups,
  fuelBudget,
  logIndex,
  leafIndex,
  lavaIndex,
  linerIndex,
  airIndex,
}) {
  const cells = [];
  const air = [];
  const liquid = [];
  const liner = [];
  const flammable = [];

  const inZone = (x, y, z) =>
    x >= zone.minX &&
    x <= zone.maxX &&
    y >= zone.minY &&
    y <= zone.maxY &&
    z >= zone.minZ &&
    z <= zone.maxZ;

  for (const { x, z, height } of trees) {
    for (let layer = 0; layer < height; layer += 1) {
      const y = zone.minY + layer;

      if (!inZone(x, y, z)) {
        throw new Error(
          `pyreFuel trunk cell ${x},${y},${z} escapes the fuel zone.`,
        );
      }

      cells.push([x, y, z, logIndex]);
      flammable.push([x, y, z]);
    }

    const crownY = zone.minY + height - 1;

    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          if (dx === 0 && dz === 0 && dy <= 0) {
            continue;
          }

          if (dy === 1 && (dx !== 0 || dz !== 0)) {
            continue;
          }

          const lx = x + dx;
          const ly = crownY + dy;
          const lz = z + dz;

          if (!inZone(lx, ly, lz)) {
            throw new Error(
              `pyreFuel leaf cell ${lx},${ly},${lz} escapes the fuel zone.`,
            );
          }

          cells.push([lx, ly, lz, leafIndex]);
          flammable.push([lx, ly, lz]);
        }
      }
    }
  }

  if (flammable.length > fuelBudget) {
    throw new Error(
      `pyreFuel laid ${flammable.length} flammable cells; the budget is ${fuelBudget}.`,
    );
  }

  if (lavaCups.length !== 2) {
    throw new Error(
      `pyreFuel needs exactly 2 sealed lava cups, not ${lavaCups.length}.`,
    );
  }

  for (const { x, y, z } of lavaCups) {
    const walls = [
      [x - 1, y, z],
      [x + 1, y, z],
      [x, y, z - 1],
      [x, y, z + 1],
      [x, y - 1, z],
    ];

    for (const [wx, wy, wz] of walls) {
      cells.push([wx, wy, wz, linerIndex]);
      liner.push([wx, wy, wz]);
    }

    cells.push([x, y, z, lavaIndex]);
    liquid.push([x, y, z]);
    cells.push([x, y + 1, z, airIndex]);
    air.push([x, y + 1, z]);
  }

  return { cells, air, liquid, liner, spouts: [], flammable };
}
