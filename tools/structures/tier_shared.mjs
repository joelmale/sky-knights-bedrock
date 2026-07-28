// Shared contract for the four procedural tiers (islet/crag/landmark; the
// fifth tier, standard, stays on the frozen `ambient_shared.mjs` verbatim).
//
// This is the tier analogue of `ambient_shared.mjs`: it wraps
// `buildIslandIndices` + the existing `assertSolidBody` + the new
// `assert.mjs` checks + a per-tier block-count budget, and emits an
// integrity-probe list the same way `ambient_shared.mjs` does. It does not
// import or modify `ambient_shared.mjs`.

import { structureBuffer, zyxIndex } from "./nbt.mjs";
import { assertSolidBody, buildIslandIndices } from "./shape.mjs";
import {
  assertCarveIsIntentional,
  assertLeafSupport,
  assertNoUnsupportedGravityBlocks,
  countIndices,
} from "./assert.mjs";

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

export function defineTierIsland({
  id,
  family,
  tier,
  size,
  palette,
  body,
  strata,
  orePockets = [],
  stamps = [],
  carved = () => false,
  airIndex,
  leafSupport,
  gravityIndices = [],
  budget,
  extraProbes = [],
}) {
  const probes = [...integrityBlocks(size, body, palette, strata), ...extraProbes];

  function buildIndices() {
    const indices = buildIslandIndices({ size, body, strata, orePockets, stamps });

    assertSolidBody({ name: id, size, body, indices });

    if (airIndex !== undefined) {
      assertCarveIsIntentional({ name: id, size, body, indices, airIndex, carved });
    }

    if (leafSupport) {
      assertLeafSupport({
        name: id,
        size,
        indices,
        leafIndex: leafSupport.leafIndex,
        logIndex: leafSupport.logIndex,
        maxDistance: leafSupport.maxDistance ?? 4,
      });
    }

    if (gravityIndices.length > 0) {
      assertNoUnsupportedGravityBlocks({
        name: id,
        size,
        indices,
        gravityIndices,
        airIndex,
      });
    }

    if (budget) {
      const counts = countIndices(indices, {
        airIndex,
        liquidIndices: budget.liquidIndices ?? [],
      });

      if (counts.solid > budget.maxSolid) {
        throw new Error(`${id} solid block count ${counts.solid} exceeds ${budget.maxSolid}.`);
      }

      if (counts.air > budget.maxAir) {
        throw new Error(`${id} air cell count ${counts.air} exceeds ${budget.maxAir}.`);
      }

      if (counts.liquid > budget.maxLiquid) {
        throw new Error(`${id} liquid cell count ${counts.liquid} exceeds ${budget.maxLiquid}.`);
      }

      const boxCells = size[0] * size[1] * size[2];

      if (budget.voidFloorRatio !== undefined && counts.void < boxCells * budget.voidFloorRatio) {
        throw new Error(
          `${id} void ratio ${(counts.void / boxCells).toFixed(3)} is below the required ${budget.voidFloorRatio}.`,
        );
      }

      if (budget.maxOccupancyRatio !== undefined) {
        const occupied = counts.solid + counts.air + counts.liquid;

        if (occupied > boxCells * budget.maxOccupancyRatio) {
          throw new Error(
            `${id} occupancy ${occupied} exceeds ${(budget.maxOccupancyRatio * 100).toFixed(0)}% of ${boxCells}.`,
          );
        }
      }
    }

    for (const probe of probes) {
      const { x, y, z } = probe.offset;
      const value = indices[zyxIndex(size, x, y, z)];

      if (palette[value] !== probe.typeId) {
        throw new Error(
          `${id} integrity probe ${x},${y},${z} expected ${probe.typeId}, saw ${palette[value]}.`,
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
    tier,
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
      return { palette: [...palette], indices: buildIndices() };
    },
    build,
  };
}
