// Rim waterfalls/lavafalls: a one-block notch through the rim, a fall column
// straight down (plus the one cell laterally outward, per the air/void
// contract's fall-column carve-out), and - for a "bounded" fall - a small
// sealed catch cup partway down so the pour settles instead of spraying
// forever. A "void" fall has no cup: the column simply exits the structure's
// bottom face into open sky.

/**
 * Returns `{ stamps, column }`. `column` describes the declared air column
 * for `assertFallColumn`.
 */
export function rimFall({
  spoutX,
  spoutZ,
  surfaceY,
  spillType,
  liquidIndex,
  linerIndex,
  airIndex,
  structureMinY = 0,
  lateralDX = 1,
  lateralDZ = 0,
  dropDepth = 8,
}) {
  const toY = spillType === "void" ? structureMinY : surfaceY - dropDepth;
  const column = {
    x: spoutX,
    z: spoutZ,
    lateralX: spoutX + lateralDX,
    lateralZ: spoutZ + lateralDZ,
    fromY: surfaceY - 1,
    toY,
    type: spillType,
  };

  const stamps = [
    // The notch: the rim's outermost liquid cell sits directly at the spout.
    {
      resolve(context) {
        const { x, y, z } = context;

        if (y === surfaceY && x === spoutX && z === spoutZ) {
          return liquidIndex;
        }

        return undefined;
      },
    },
    // The fall column and its one lateral neighbour, air from the rim down
    // to the terminus.
    {
      resolve(context) {
        const { x, y, z } = context;
        const inColumn =
          (x === spoutX && z === spoutZ) ||
          (x === column.lateralX && z === column.lateralZ);

        if (!inColumn) {
          return undefined;
        }

        if (y >= Math.min(column.toY, column.fromY) && y <= column.fromY) {
          return airIndex;
        }

        return undefined;
      },
    },
  ];

  if (spillType === "bounded") {
    const cupY = surfaceY - dropDepth;

    stamps.push({
      resolve(context) {
        const { x, y, z } = context;

        if (Math.abs(x - spoutX) > 1 || Math.abs(z - spoutZ) > 1) {
          return undefined;
        }

        if (y === cupY - 1) {
          return linerIndex;
        }

        if (y === cupY) {
          return liquidIndex;
        }

        if (y === cupY + 1) {
          return airIndex;
        }

        return undefined;
      },
    });
  }

  return { stamps, column };
}
