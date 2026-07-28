// Positive relief: the shapes that stack on top of an island body.
//
// Every feature in `tools/structures/features/` returns the same plain record
// so that `tier_shared.mjs` and `continent_shared.mjs` can compose them without
// knowing what they are:
//
//   {
//     cells:  [[x, y, z, paletteIndex], ...]  written in order, last wins
//     air:    [[x, y, z], ...]                declared force-clear cells
//     liquid: [[x, y, z], ...]                declared liquid cells
//     liner:  [[x, y, z], ...]                declared sealing cells
//     spouts: [[x, y, z], ...]                declared basin openings
//     column: {...} | undefined               declared rim-fall column
//   }
//
// Relief features never emit air, liquid, or spouts: they are solid by
// construction. A hollow spire is a fall hazard and a carve-predicate headache.

const EMPTY = Object.freeze({
  air: [],
  liquid: [],
  liner: [],
  spouts: [],
});

function solid(cells, extra = {}) {
  return { ...EMPTY, cells, ...extra };
}

/**
 * A solid conical peak. Radius at layer `y` is
 * `baseRadius - floor((y - baseY) * baseRadius / height)`, so the last layer is
 * a one-block tip. Integer arithmetic only.
 */
export function mountainPeak({
  centerX,
  centerZ,
  baseY,
  height,
  baseRadius,
  coreIndex,
  capIndex,
  capDepth = 0,
  emitLayers = height,
}) {
  if (height <= 0) {
    throw new Error("mountainPeak height must be positive.");
  }

  if (emitLayers > height) {
    throw new Error("mountainPeak cannot emit more layers than its height.");
  }

  const cells = [];
  const radii = [];

  // `emitLayers < height` truncates the cone into a plateau while keeping the
  // slope of the full cone. That is what gives landmarks a summit wide enough
  // to carry a tarn with no rock left hanging above it.
  for (let layer = 0; layer <= emitLayers; layer += 1) {
    const y = baseY + layer;
    const radius = baseRadius - Math.floor((layer * baseRadius) / height);
    const index = layer > emitLayers - capDepth ? capIndex : coreIndex;
    radii.push(radius);

    if (radius <= 0) {
      cells.push([centerX, y, centerZ, index]);
      continue;
    }

    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        if (dx * dx + dz * dz <= radius * radius) {
          cells.push([centerX + dx, y, centerZ + dz, index]);
        }
      }
    }
  }

  return solid(cells, { topY: baseY + emitLayers, radii });
}

/** A solid vertical shaft with a one-layer flare at its base. */
export function spire({
  x,
  z,
  baseY,
  height,
  radius,
  index,
  flareIndex = index,
}) {
  const cells = [];
  const flare = radius + 1;

  for (let dx = -flare; dx <= flare; dx += 1) {
    for (let dz = -flare; dz <= flare; dz += 1) {
      if (dx * dx + dz * dz <= flare * flare) {
        cells.push([x + dx, baseY, z + dz, flareIndex]);
      }
    }
  }

  for (let layer = 0; layer < height; layer += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dz = -radius; dz <= radius; dz += 1) {
        if (dx * dx + dz * dz <= radius * radius) {
          cells.push([x + dx, baseY + layer, z + dz, index]);
        }
      }
    }
  }

  return solid(cells, { topY: baseY + height - 1 });
}

/**
 * A single tree. Leaves stay within one block of the trunk in x/z and within
 * two above it, so every leaf is comfortably inside the four-block taxicab
 * radius `assertLeafSupport` requires: `structureBuffer` writes empty state
 * compounds, so leaves place with `persistent_bit=false` and decay otherwise.
 */
export function foliageTree({
  x,
  z,
  baseY,
  trunkHeight,
  trunkIndex,
  leafIndex,
}) {
  const cells = [];
  const crownY = baseY + trunkHeight - 1;

  for (let dy = -1; dy <= 0; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        if (dx === 0 && dz === 0) {
          continue;
        }

        cells.push([x + dx, crownY + dy, z + dz, leafIndex]);
      }
    }
  }

  cells.push([x, crownY + 1, z, leafIndex]);

  for (let layer = 0; layer < trunkHeight; layer += 1) {
    cells.push([x, baseY + layer, z, trunkIndex]);
  }

  return solid(cells, { crownY });
}

/**
 * One elliptical terrace layer, used to build stepped mesas and plateaus.
 *
 * Supplying `innerRadiusX`/`innerRadiusZ` turns the step into a ring, which is
 * how a caldera wall is built: the interior is simply never emitted, so it
 * stays -1 instead of costing force-clear air.
 */
export function mesaStep({
  centerX,
  centerZ,
  y,
  radiusX,
  radiusZ,
  innerRadiusX = 0,
  innerRadiusZ = 0,
  index,
}) {
  const cells = [];
  const hollow = innerRadiusX > 0 && innerRadiusZ > 0;

  for (let dx = -radiusX; dx <= radiusX; dx += 1) {
    for (let dz = -radiusZ; dz <= radiusZ; dz += 1) {
      if (
        (dx * dx) / (radiusX * radiusX) + (dz * dz) / (radiusZ * radiusZ) >
        1
      ) {
        continue;
      }

      if (
        hollow &&
        (dx * dx) / (innerRadiusX * innerRadiusX) +
          (dz * dz) / (innerRadiusZ * innerRadiusZ) <=
          1
      ) {
        continue;
      }

      cells.push([centerX + dx, y, centerZ + dz, index]);
    }
  }

  return solid(cells);
}
