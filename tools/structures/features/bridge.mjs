// Land bridges: a decked span between two points with an integer-only sag
// parabola, plus the frozen abutment stub continent components use to meet
// across a seam (RULE 5 of the air/void contract).

/**
 * A straight or axis-aligned deck from `(fromX,fromZ)` to `(toX,toZ)` at
 * layer `y`, `width` blocks wide, with one supporting layer below that sags
 * toward the middle of the span. Sag is a pure-integer parabola:
 * `floor(archDepth * step * (span - step) * 4 / (span * span))` - no
 * floating point, no trig.
 */
export function landBridge({ fromX, fromZ, toX, toZ, y, width, archDepth, index, railIndex }) {
  const span = Math.max(Math.abs(toX - fromX), Math.abs(toZ - fromZ), 1);
  const halfWidth = Math.floor(width / 2);
  const travelAlongX = fromZ === toZ;
  const steps = [];

  for (let step = 0; step <= span; step += 1) {
    steps.push({
      x: fromX + Math.round(((toX - fromX) * step) / span),
      z: fromZ + Math.round(((toZ - fromZ) * step) / span),
      sag: Math.floor((archDepth * step * (span - step) * 4) / (span * span)),
    });
  }

  return {
    resolve(context) {
      const { x, y: cy, z } = context;

      for (const step of steps) {
        const onSpan = travelAlongX ? x === step.x : z === step.z;

        if (!onSpan) {
          continue;
        }

        const lateral = travelAlongX ? Math.abs(z - step.z) : Math.abs(x - step.x);

        if (lateral > halfWidth) {
          continue;
        }

        if (cy === y) {
          return index;
        }

        if (cy === y - 1 - step.sag) {
          return index;
        }

        if (railIndex !== undefined && cy === y + 1 && lateral === halfWidth) {
          return railIndex;
        }

        return undefined;
      }

      return undefined;
    },
  };
}

/**
 * The frozen bridge-abutment stub. Continent components declare
 * `bridgeAbutments: ["-x", "+x"]`; `defineContinentComponent` calls this for
 * each declared edge and splices the result into the border shell over the
 * compile-time-fixed window `z in [13,16]`, `y in [25,26]`, so any two
 * abutment-bearing components meet block-for-block.
 */
export function bridgeAbutment({ edge, index }) {
  const x = edge === "-x" ? 0 : 29;

  return {
    resolve(context) {
      const { x: cx, y, z } = context;

      if (cx !== x || z < 13 || z > 16 || y < 25 || y > 26) {
        return undefined;
      }

      return index;
    },
  };
}
