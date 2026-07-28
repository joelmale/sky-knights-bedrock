// Land bridges and the frozen seam abutments they terminate in.

import { linePoints } from "./carve.mjs";

/** The compile-time abutment window, so any two abutment-bearing parts meet. */
export const ABUTMENT_WINDOW = Object.freeze({
  minZ: 13,
  maxZ: 16,
  width: 4,
});

function solid(cells, extra = {}) {
  return { cells, air: [], liquid: [], liner: [], spouts: [], ...extra };
}

/**
 * A deck laid along an integer Bresenham path, with a supporting belly whose
 * sag is a pure-integer parabola.
 */
export function landBridge({
  fromX,
  fromZ,
  toX,
  toZ,
  y,
  width,
  archDepth = 0,
  index,
  railIndex,
}) {
  const path = linePoints([fromX, 0, fromZ], [toX, 0, toZ]);
  const span = path.length - 1;
  const alongX = Math.abs(toX - fromX) >= Math.abs(toZ - fromZ);
  const half = Math.floor((width - 1) / 2);
  const cells = [];

  path.forEach(([px, , pz], step) => {
    const sag =
      span === 0
        ? 0
        : Math.floor((archDepth * step * (span - step) * 4) / (span * span));

    for (let offset = -half; offset < width - half; offset += 1) {
      const x = alongX ? px : px + offset;
      const z = alongX ? pz + offset : pz;

      for (let depth = 0; depth <= sag; depth += 1) {
        cells.push([x, y - 1 - depth, z, index]);
      }

      cells.push([x, y, z, index]);

      if (
        railIndex !== undefined &&
        (offset === -half || offset === width - half - 1)
      ) {
        cells.push([x, y + 1, z, railIndex]);
      }
    }
  });

  return solid(cells, { span });
}

/**
 * The only permitted exception to the frozen seam shell. The window is a
 * compile-time constant, so two abutment-bearing components always meet
 * block-for-block.
 */
export function bridgeAbutment({
  edge,
  y,
  width = ABUTMENT_WINDOW.width,
  index,
  size,
}) {
  const cells = [];
  const half = Math.floor((width - 1) / 2);
  const center = Math.floor((ABUTMENT_WINDOW.minZ + ABUTMENT_WINDOW.maxZ) / 2);
  const minZ = center - half;
  const maxZ = minZ + width - 1;

  if (minZ < ABUTMENT_WINDOW.minZ || maxZ > ABUTMENT_WINDOW.maxZ) {
    throw new Error(
      `bridgeAbutment width ${width} does not fit the frozen window z ${ABUTMENT_WINDOW.minZ}..${ABUTMENT_WINDOW.maxZ}.`,
    );
  }

  const x = edge === "-x" ? 0 : size[0] - 1;

  for (let z = minZ; z <= maxZ; z += 1) {
    cells.push([x, y - 1, z, index]);
    cells.push([x, y, z, index]);
  }

  return solid(cells, { edge, minZ, maxZ, x });
}

/** Cells the abutment window occupies on one face, for seam verification. */
export function abutmentWindowCells({
  edge,
  y,
  width = ABUTMENT_WINDOW.width,
  size,
}) {
  return bridgeAbutment({ edge, y, width, index: 0, size }).cells.map(
    ([x, cy, z]) => [x, cy, z],
  );
}
