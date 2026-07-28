// Solid relief features layered above an island body: mountains, spires, and
// mesa steps. These add solid rock *above* `body.topY`, so they never touch
// the air/void contract - they are simply more silhouette, resolved the same
// way any other stamp is (last stamp in the array wins).

/**
 * A tapered, integer-only mountain. `radiusAt(y) = baseRadius -
 * floor((y - baseY) * baseRadius / height)`, so the top layer is always a
 * single-block tip. The top `capDepth` layers use `capIndex`.
 */
export function mountainPeak({
  centerX,
  centerZ,
  baseY,
  height,
  baseRadius,
  coreIndex,
  capIndex,
  capDepth,
}) {
  return {
    resolve(context) {
      const { x, y, z } = context;

      if (y < baseY || y > baseY + height) {
        return undefined;
      }

      const radius = baseRadius - Math.floor(((y - baseY) * baseRadius) / height);

      if (radius < 0) {
        return undefined;
      }

      const dx = x - centerX;
      const dz = z - centerZ;

      if (dx * dx + dz * dz > radius * radius) {
        return undefined;
      }

      const fromTop = baseY + height - y;
      return fromTop < capDepth ? capIndex : coreIndex;
    },
  };
}

/**
 * A solid vertical shaft with a one-layer flare at its base. Always solid -
 * a hollow spire is a fall hazard and needs no carve bookkeeping.
 */
export function spire({ x, z, baseY, height, radius, index, flareIndex }) {
  return {
    resolve(context) {
      const { x: cx, y, z: cz } = context;

      if (y < baseY || y > baseY + height) {
        return undefined;
      }

      const dx = cx - x;
      const dz = cz - z;

      if (y === baseY) {
        const flareRadius = radius + 1;

        if (dx * dx + dz * dz <= flareRadius * flareRadius) {
          return flareIndex ?? index;
        }

        return undefined;
      }

      if (dx * dx + dz * dz <= radius * radius) {
        return index;
      }

      return undefined;
    },
  };
}

/** A single flat elliptical step, used to band mesa-style silhouettes. */
export function mesaStep({ centerX, centerZ, y, radiusX, radiusZ, index }) {
  return {
    resolve(context) {
      if (context.y !== y) {
        return undefined;
      }

      const dx = context.x - centerX;
      const dz = context.z - centerZ;

      if ((dx * dx) / (radiusX * radiusX) + (dz * dz) / (radiusZ * radiusZ) <= 1) {
        return index;
      }

      return undefined;
    },
  };
}
