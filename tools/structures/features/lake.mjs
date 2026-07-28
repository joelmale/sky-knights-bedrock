// Sealed liquid basins.
//
// `structureBuffer` writes `states: compound({})`, so Bedrock applies defaults
// and `minecraft:water` / `minecraft:lava` place as SOURCE blocks. A source that
// is sealed on all five lower faces never flows, never updates, and never
// drains the island.
//
// Emit order is normative:
//   1. liner shell   (written first, so liquid can only overwrite interior)
//   2. liquid fill
//   3. one layer of headroom air, never a column

const inEllipse = (dx, dz, radiusX, radiusZ) =>
  (dx * dx) / (radiusX * radiusX) + (dz * dz) / (radiusZ * radiusZ) <= 1;

export function lakeBasin({
  centerX,
  centerZ,
  radiusX,
  radiusZ,
  surfaceY,
  depth,
  liquidIndex,
  linerIndex,
  rimIndex = linerIndex,
  airIndex,
}) {
  const floorY = surfaceY - depth - 1;
  const cells = [];
  const air = [];
  const liquid = [];
  const liner = [];
  const linerSeen = new Set();

  const addLiner = (x, y, z, index) => {
    const key = `${x},${y},${z}`;

    if (linerSeen.has(key)) {
      return;
    }

    linerSeen.add(key);
    cells.push([x, y, z, index]);
    liner.push([x, y, z]);
  };

  // 1. LINER SHELL.
  const outerX = radiusX + 1;
  const outerZ = radiusZ + 1;

  for (let dx = -outerX; dx <= outerX; dx += 1) {
    for (let dz = -outerZ; dz <= outerZ; dz += 1) {
      if (!inEllipse(dx, dz, outerX, outerZ)) {
        continue;
      }

      const x = centerX + dx;
      const z = centerZ + dz;
      const interior = inEllipse(dx, dz, radiusX, radiusZ);

      addLiner(x, floorY, z, linerIndex);

      if (interior) {
        continue;
      }

      for (let y = floorY; y <= surfaceY; y += 1) {
        addLiner(x, y, z, y === surfaceY ? rimIndex : linerIndex);
      }
    }
  }

  // 2. LIQUID FILL.
  for (let dx = -radiusX; dx <= radiusX; dx += 1) {
    for (let dz = -radiusZ; dz <= radiusZ; dz += 1) {
      if (!inEllipse(dx, dz, radiusX, radiusZ)) {
        continue;
      }

      const x = centerX + dx;
      const z = centerZ + dz;

      for (let y = surfaceY - depth; y <= surfaceY; y += 1) {
        cells.push([x, y, z, liquidIndex]);
        liquid.push([x, y, z]);
      }

      // 3. HEADROOM: exactly one layer.
      cells.push([x, surfaceY + 1, z, airIndex]);
      air.push([x, surfaceY + 1, z]);
    }
  }

  // Safety dilation. The inclusive-ring liner is correct for every basin this
  // pack ships, but proving it for arbitrary radii is fiddly, so any lateral or
  // downward neighbour of a liquid cell that is not itself liquid is forced to
  // liner. This can only ever add blocks, so it stays deterministic.
  const liquidSeen = new Set(liquid.map(([x, y, z]) => `${x},${y},${z}`));

  for (const [x, y, z] of liquid) {
    const neighbours = [
      [x - 1, y, z],
      [x + 1, y, z],
      [x, y, z - 1],
      [x, y, z + 1],
      [x, y - 1, z],
    ];

    for (const [nx, ny, nz] of neighbours) {
      if (liquidSeen.has(`${nx},${ny},${nz}`)) {
        continue;
      }

      addLiner(nx, ny, nz, ny === surfaceY ? rimIndex : linerIndex);
    }
  }

  return {
    cells,
    air,
    liquid,
    liner,
    spouts: [],
    liquidCells: liquid.length,
    linerCells: liner.length,
    floorY,
  };
}
