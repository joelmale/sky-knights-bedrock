// Rim falls: the waterfalls and lavafalls that pour off an island edge.
//
// A fall is a 1x1 notch cut through the rim at `surfaceY`, a sealed one-block
// source directly inboard of it, and a force-cleared column running down the
// outward face. The column is AIR at generation time: Bedrock's own flow builds
// the visible fall from the source, so the structure carries no flowing liquid.
//
//   spillType "bounded" - the column ends in a sealed catch cup carried by a
//                         stepped underside spur. Nothing updates after it
//                         settles. This is the default and the only legal form
//                         for lava.
//   spillType "void"    - no cup; the column exits the structure's bottom face
//                         and the liquid falls into the sky. Rationed to one
//                         per island.

const BOUNDED_WATER_DROP = 8;
const BOUNDED_LAVA_DROP = 6;
const MAX_SPUR_STEPS = 16;

export function rimFall({
  spoutX,
  spoutZ,
  surfaceY,
  spillType = "bounded",
  liquid: liquidKind = "water",
  liquidIndex,
  linerIndex,
  airIndex,
  structureMinY = 0,
  outward,
  body,
}) {
  if (outward === undefined) {
    throw new Error(
      "rimFall needs an outward direction, e.g. outward: [1, 0].",
    );
  }

  if (spillType === "void" && liquidKind === "lava") {
    throw new Error(
      "rimFall refuses a void lava fall; lava falls are bounded.",
    );
  }

  const [ox, oz] = outward;
  const inX = spoutX - ox;
  const inZ = spoutZ - oz;
  const outX = spoutX + ox;
  const outZ = spoutZ + oz;
  const perpendicular = [oz, -ox];

  const cells = [];
  const air = [];
  const liquid = [];
  const liner = [];
  const spouts = [];
  const columnCells = [];

  const addLiner = (x, y, z) => {
    cells.push([x, y, z, linerIndex]);
    liner.push([x, y, z]);
  };

  const addAir = (x, y, z) => {
    cells.push([x, y, z, airIndex]);
    air.push([x, y, z]);
  };

  // Sealed one-block source, inboard of the notch.
  addLiner(inX, surfaceY - 1, inZ);
  addLiner(inX - ox, surfaceY, inZ - oz);
  addLiner(inX + perpendicular[0], surfaceY, inZ + perpendicular[1]);
  addLiner(inX - perpendicular[0], surfaceY, inZ - perpendicular[1]);
  cells.push([inX, surfaceY, inZ, liquidIndex]);
  liquid.push([inX, surfaceY, inZ]);
  addAir(inX, surfaceY + 1, inZ);

  // The notch is one block wide: its two lateral neighbours and its floor are
  // forced to liner so the outflow can only ever travel outward.
  const lateral = [
    [spoutX + perpendicular[0], surfaceY, spoutZ + perpendicular[1]],
    [spoutX - perpendicular[0], surfaceY, spoutZ - perpendicular[1]],
  ];

  for (const [x, y, z] of lateral) {
    addLiner(x, y, z);
  }

  addLiner(spoutX, surfaceY - 1, spoutZ);
  addAir(spoutX, surfaceY, spoutZ);
  spouts.push([spoutX, surfaceY, spoutZ]);

  const drop =
    spillType === "bounded" && liquidKind === "lava"
      ? BOUNDED_LAVA_DROP
      : BOUNDED_WATER_DROP;
  const cupY = surfaceY - drop;
  const bottomY = spillType === "void" ? structureMinY : cupY + 1;

  for (let y = surfaceY; y >= bottomY; y -= 1) {
    addAir(outX, y, outZ);
    columnCells.push([outX, y, outZ]);
  }

  if (spillType === "bounded") {
    if (body === undefined) {
      throw new Error(
        "A bounded rimFall needs the island body to anchor its spur.",
      );
    }

    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dz = -1; dz <= 1; dz += 1) {
        addLiner(outX + dx, cupY - 1, outZ + dz);

        if (dx !== 0 || dz !== 0) {
          addLiner(outX + dx, cupY, outZ + dz);
        }
      }
    }

    cells.push([outX, cupY, outZ, liquidIndex]);
    liquid.push([outX, cupY, outZ]);

    // Stepped underside spur: one cell inboard per layer until it reaches the
    // body. A cup that cannot be anchored is a generation error, not a shrug.
    let anchored = false;
    let spurX = outX;
    let spurZ = outZ;

    for (let step = 0; step < MAX_SPUR_STEPS; step += 1) {
      const y = cupY - 1 + step;
      spurX -= ox;
      spurZ -= oz;

      if (body.contains(spurX, y, spurZ)) {
        anchored = true;
        break;
      }

      addLiner(spurX, y, spurZ);
    }

    if (!anchored) {
      throw new Error(
        `rimFall cup at ${outX},${cupY},${outZ} could not be anchored to the island body.`,
      );
    }
  }

  return {
    cells,
    air,
    liquid,
    liner,
    spouts,
    column: {
      type: spillType,
      liquid: liquidKind,
      spout: [spoutX, surfaceY, spoutZ],
      cells: columnCells,
      lateral,
    },
  };
}
