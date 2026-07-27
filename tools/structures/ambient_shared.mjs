// Shared contract for compact ambient islands placed by the lazy archipelago
// generator. Ambient templates deliberately have no docks, containers, block
// entities, or gameplay anchors.

import { structureBuffer, zyxIndex } from "./nbt.mjs";
import { assertSolidBody, buildIslandIndices } from "./shape.mjs";

function integrityBlocks(size, body, palette, strata) {
  return [
    {
      offset: { x: body.centerX, y: 0, z: body.centerZ },
      typeId: palette[strata.core],
    },
    {
      offset: { x: 1, y: body.topY, z: body.centerZ },
      typeId: palette[strata.surface],
    },
    {
      offset: { x: size[0] - 2, y: body.topY, z: body.centerZ },
      typeId: palette[strata.surface],
    },
    {
      offset: { x: body.centerX, y: body.topY, z: 1 },
      typeId: palette[strata.surface],
    },
    {
      offset: { x: body.centerX, y: body.topY, z: size[2] - 2 },
      typeId: palette[strata.surface],
    },
  ];
}

export function defineAmbientIsland({
  id,
  family,
  size,
  palette,
  body,
  strata,
  stamps,
}) {
  const probes = integrityBlocks(size, body, palette, strata);

  function buildIndices() {
    const indices = buildIslandIndices({
      size,
      body,
      strata,
      stamps,
    });

    assertSolidBody({
      name: id,
      size,
      body,
      indices,
    });

    for (const probe of probes) {
      const { x, y, z } = probe.offset;
      const paletteIndex = indices[zyxIndex(size, x, y, z)];

      if (palette[paletteIndex] !== probe.typeId) {
        throw new Error(
          `${id} integrity probe ${x},${y},${z} expected ${probe.typeId}.`,
        );
      }
    }

    return indices;
  }

  function build() {
    return structureBuffer(size, palette, buildIndices());
  }

  return {
    id,
    family,
    structureId: `skyknights:${id}`,
    outputPath: [
      "behavior_packs",
      "sk_bp",
      "structures",
      "skyknights",
      `${id}.mcstructure`,
    ],
    size,
    palette,
    body,
    integrityBlocks: probes,
    inspect() {
      return {
        palette: [...palette],
        indices: buildIndices(),
      };
    },
    build,
  };
}
