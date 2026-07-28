// Shared contract for the tiered ambient islands (islet / crag / landmark).
//
// This is the tier analogue of `ambient_shared.mjs`. It deliberately does NOT
// import it: the four existing `ambient_*.mjs` modules are frozen and must keep
// producing byte-identical output, so they keep their own definer and nothing
// here can perturb them.
//
// `defineTierIsland` is where the air/void contract and the per-tier block
// budgets stop being documentation and become build-time failures:
//
//   * `airIndex` must be the LAST palette entry and must be `minecraft:air`,
//     so adding it never shifts an existing index constant.
//   * every force-clear cell must be declared by a feature or by the module's
//     own `carved` predicate - undeclared air throws.
//   * every in-body -1 still throws through the existing `assertSolidBody`.
//   * solid / air / liquid counts, the occupancy ceiling, and the 70% void
//     floor are hard ceilings. An over-budget island cannot be generated.

import { structureBuffer, zyxIndex } from "./nbt.mjs";
import {
  assertSolidBody,
  boxStamp,
  buildIslandIndices,
  taperedEllipsoidBody,
} from "./shape.mjs";
import {
  assertAirIsDeclared,
  assertBlockBudget,
  assertCarveIsIntentional,
  assertFallColumn,
  assertFireSafety,
  assertLeafSupport,
  assertNoUnsupportedGravityBlocks,
  assertProbeIsStable,
  assertPyreTermination,
  assertSealedBasin,
  cellKey,
  countIndices,
} from "./assert.mjs";

/** The hard ceilings from the spec's blockBudgets table. */
export const TIER_BUDGETS = Object.freeze({
  islet: {
    tier: "islet",
    boxCells: 792,
    maxSolid: 220,
    maxAir: 40,
    maxLiquid: 0,
    voidFloor: 0.7,
  },
  standard: {
    tier: "standard",
    boxCells: 1950,
    maxSolid: 420,
    maxAir: 90,
    maxLiquid: 12,
    voidFloor: 0.7,
  },
  crag: {
    tier: "crag",
    boxCells: 8694,
    maxSolid: 1900,
    maxAir: 400,
    maxLiquid: 60,
    occupancy: 2434,
    voidFloor: 0.7,
  },
  landmark: {
    tier: "landmark",
    boxCells: 40950,
    maxSolid: 8500,
    maxAir: 1600,
    maxLiquid: 260,
    occupancy: 11466,
    voidFloor: 0.7,
  },
});

/** Footprints, safe-dock heights, and planner radii, per tier. */
export const TIER_GEOMETRY = Object.freeze({
  islet: { size: [11, 8, 9], dockY: 4, clearanceRadius: 14, heightRadius: 8 },
  standard: {
    size: [15, 10, 13],
    dockY: 6,
    clearanceRadius: 16,
    heightRadius: 9,
  },
  crag: {
    size: [23, 18, 21],
    dockY: 10,
    clearanceRadius: 22,
    heightRadius: 13,
  },
  landmark: {
    size: [39, 30, 35],
    dockY: 15,
    clearanceRadius: 33,
    heightRadius: 19,
  },
});

/**
 * Per-family palettes shared by every solo tier. `air` is always the LAST
 * entry, so a module that adds a carve never shifts an existing constant.
 */
export const FAMILY_KITS = Object.freeze({
  verdant: {
    palette: [
      "minecraft:stone",
      "minecraft:dirt",
      "minecraft:grass_block",
      "minecraft:moss_block",
      "minecraft:oak_log",
      "minecraft:oak_leaves",
      "minecraft:andesite",
      "minecraft:cobblestone",
      "minecraft:coal_ore",
      "minecraft:water",
      "minecraft:air",
    ],
    block: {
      core: 0,
      subsurface: 1,
      surface: 2,
      accent: 3,
      trunk: 4,
      leaves: 5,
      cap: 6,
      liner: 7,
      ore: 8,
      water: 9,
      air: 10,
    },
  },
  desert: {
    palette: [
      "minecraft:sandstone",
      "minecraft:red_sandstone",
      "minecraft:sand",
      "minecraft:terracotta",
      "minecraft:cactus",
      "minecraft:smooth_sandstone",
      "minecraft:chiseled_sandstone",
      "minecraft:gold_ore",
      "minecraft:water",
      "minecraft:air",
    ],
    block: {
      core: 0,
      subsurface: 1,
      surface: 2,
      accent: 3,
      trunk: 4,
      cap: 5,
      liner: 0,
      rim: 6,
      ore: 7,
      water: 8,
      air: 9,
    },
  },
  tundra: {
    palette: [
      "minecraft:stone",
      "minecraft:packed_ice",
      "minecraft:snow_block",
      "minecraft:blue_ice",
      "minecraft:spruce_log",
      "minecraft:spruce_leaves",
      "minecraft:andesite",
      "minecraft:cobblestone",
      "minecraft:iron_ore",
      "minecraft:water",
      "minecraft:air",
    ],
    block: {
      core: 0,
      subsurface: 1,
      surface: 2,
      accent: 3,
      trunk: 4,
      leaves: 5,
      cap: 6,
      liner: 7,
      ore: 8,
      water: 9,
      air: 10,
    },
  },
  volcanic: {
    palette: [
      "minecraft:blackstone",
      "minecraft:basalt",
      "minecraft:netherrack",
      "minecraft:magma",
      "minecraft:crimson_stem",
      "minecraft:nether_wart_block",
      "minecraft:polished_blackstone",
      "minecraft:gold_ore",
      "minecraft:lava",
      "minecraft:air",
    ],
    block: {
      core: 0,
      subsurface: 1,
      surface: 2,
      accent: 3,
      trunk: 4,
      leaves: 5,
      cap: 6,
      liner: 3,
      ore: 7,
      lava: 8,
      air: 9,
    },
  },
});

/**
 * The crag body is built with `taperedEllipsoidBody` directly rather than with
 * `canonicalIslandBody`, whose topY for a 23x18x21 footprint would be 13 and
 * would leave only four layers of headroom. Dropping topY to 9 frees eight
 * layers, and that single decision is what makes a crag read as peaked instead
 * of as an oversized standard island.
 */
export function cragBody() {
  return taperedEllipsoidBody({
    centerX: 11,
    centerZ: 10,
    topY: 9,
    growthX: 8,
    growthZ: 7,
    baseRadiusX: 3,
    baseRadiusZ: 2,
  });
}

/** The landmark body: radiusAt(14) = [18, 16], spanning x 1..37 and z 1..33. */
export function landmarkBody() {
  return taperedEllipsoidBody({
    centerX: 19,
    centerZ: 17,
    topY: 14,
    growthX: 15,
    growthZ: 14,
    baseRadiusX: 3,
    baseRadiusZ: 2,
  });
}

/** A stamp backed by an explicit cell table; later cells win. */
export function featureStamp(cells) {
  const table = new Map();

  for (const [x, y, z, index] of cells) {
    table.set(cellKey(x, y, z), index);
  }

  return {
    resolve(context) {
      return table.get(cellKey(context.x, context.y, context.z));
    },
  };
}

/**
 * A surface layer that only lays `index` where the cell beneath it is body.
 *
 * Every tapered island widens as it rises, so the top layer overhangs the one
 * below it. Sand laid on that overhang would fall the instant the structure is
 * placed, so desert surfaces are stamped through this instead.
 */
export function supportedSurfaceStamp({ index, y, body }) {
  return boxStamp({
    index,
    minY: y,
    maxY: y,
    filter: (context) =>
      context.inBody && body.contains(context.x, y - 1, context.z),
  });
}

/**
 * Default probe offsets: one deep core cell plus four surface cells at three
 * quarters of the top-layer radius, which keeps them clear of any centred peak.
 */
export function tierProbeOffsets(body) {
  const [radiusX, radiusZ] = body.radiusAt(body.topY);
  const insetX = Math.floor((radiusX * 3) / 4);
  const insetZ = Math.floor((radiusZ * 3) / 4);

  return [
    { x: body.centerX, y: 0, z: body.centerZ },
    { x: body.centerX - insetX, y: body.topY, z: body.centerZ },
    { x: body.centerX + insetX, y: body.topY, z: body.centerZ },
    { x: body.centerX, y: body.topY, z: body.centerZ - insetZ },
    { x: body.centerX, y: body.topY, z: body.centerZ + insetZ },
  ];
}

/**
 * Resolves probe type ids from the finished index array, then proves each one
 * targets an inert block. Deriving the type id instead of hand-maintaining it
 * is what keeps `landmark_volcanic_pyre` from probing a block the fire eats.
 */
function resolveProbes({
  id,
  size,
  palette,
  indices,
  offsets,
  airIndex,
  unstableIndices,
}) {
  return offsets.map((offset) => {
    const index = indices[zyxIndex(size, offset.x, offset.y, offset.z)];

    if (index === -1 || index === airIndex) {
      throw new Error(
        `${id} integrity probe ${offset.x},${offset.y},${offset.z} lands on emptiness.`,
      );
    }

    if (unstableIndices.has(index)) {
      throw new Error(
        `${id} integrity probe ${offset.x},${offset.y},${offset.z} lands on ${palette[index]}, which changes after placement.`,
      );
    }

    return { offset, typeId: palette[index] };
  });
}

export function defineTierIsland({
  id,
  family,
  tier,
  size = TIER_GEOMETRY[tier].size,
  palette,
  body,
  strata,
  orePockets = [],
  stamps = [],
  features = [],
  carved,
  airIndex,
  liquidIndices = [],
  linerIndices = [],
  flammableIndices = [],
  fireIndex,
  leafIndex,
  logIndex,
  pyre,
  probes = tierProbeOffsets(body),
  dockY = TIER_GEOMETRY[tier].dockY,
  clearanceRadius = TIER_GEOMETRY[tier].clearanceRadius,
  heightRadius = TIER_GEOMETRY[tier].heightRadius,
  maxColumns = 3,
  maxVoidColumns = 1,
  maxLavaColumns = 1,
}) {
  const budget = TIER_BUDGETS[tier];

  if (budget === undefined) {
    throw new Error(`${id} declares unknown tier ${tier}.`);
  }

  if (
    airIndex !== palette.length - 1 ||
    palette[airIndex] !== "minecraft:air"
  ) {
    throw new Error(
      `${id} must declare minecraft:air as the LAST palette entry so existing index constants never shift.`,
    );
  }

  if (size[0] * size[1] * size[2] !== budget.boxCells) {
    throw new Error(
      `${id} footprint ${size.join("x")} does not match the ${tier} tier box of ${budget.boxCells} cells.`,
    );
  }

  const featureStamps = features.map((feature) => featureStamp(feature.cells));
  const declaredAir = new Set();

  for (const feature of features) {
    for (const [x, y, z] of feature.air) {
      declaredAir.add(cellKey(x, y, z));
    }
  }

  const isDeclaredAir = (x, y, z) =>
    declaredAir.has(cellKey(x, y, z)) ||
    (carved !== undefined && carved(x, y, z));

  const columns = features
    .map((feature) => feature.column)
    .filter((column) => column !== undefined);
  const spouts = features.flatMap((feature) => feature.spouts ?? []);

  const budgetLiquid =
    fireIndex === undefined ? liquidIndices : [...liquidIndices, fireIndex];

  const unstableIndices = new Set(
    [
      ...liquidIndices,
      ...flammableIndices,
      ...(fireIndex === undefined ? [] : [fireIndex]),
    ].filter((index) => index !== undefined),
  );

  let cached;

  function buildIndices() {
    if (cached !== undefined) {
      return cached;
    }

    const indices = buildIslandIndices({
      size,
      body,
      strata,
      orePockets,
      stamps: [...stamps, ...featureStamps],
    });

    assertSolidBody({ name: id, size, body, indices });
    assertCarveIsIntentional({
      name: id,
      size,
      body,
      indices,
      airIndex,
      carved: isDeclaredAir,
    });
    assertAirIsDeclared({
      name: id,
      size,
      indices,
      airIndex,
      declared: isDeclaredAir,
    });
    assertNoUnsupportedGravityBlocks({
      name: id,
      size,
      palette,
      indices,
      airIndex,
    });

    if (liquidIndices.length > 0) {
      assertSealedBasin({
        name: id,
        size,
        indices,
        liquidIndices,
        linerIndices,
        airIndex,
        spouts,
      });
    }

    assertFallColumn({
      name: id,
      size,
      indices,
      airIndex,
      columns,
      maxColumns,
      maxVoidColumns,
      maxLavaColumns,
    });

    if (leafIndex !== undefined) {
      assertLeafSupport({ name: id, size, indices, leafIndex, logIndex });
    }

    if (fireIndex !== undefined) {
      assertFireSafety({
        name: id,
        size,
        indices,
        fireIndex,
        flammableIndices,
      });
    }

    if (pyre !== undefined) {
      assertPyreTermination({
        name: id,
        size,
        indices,
        flammableIndices,
        linerIndices,
        airIndex,
        fireIndex,
        palette,
        ...pyre,
      });
    }

    assertBlockBudget({
      name: id,
      counts: countIndices(indices, { airIndex, liquidIndices: budgetLiquid }),
      budget,
    });

    cached = indices;
    return indices;
  }

  function integrityBlocks() {
    const resolved = resolveProbes({
      id,
      size,
      palette,
      indices: buildIndices(),
      offsets: probes,
      airIndex,
      unstableIndices,
    });

    assertProbeIsStable({ name: id, palette, probes: resolved });
    return resolved;
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
    dockY,
    clearanceRadius,
    heightRadius,
    get integrityBlocks() {
      return integrityBlocks();
    },
    inspect() {
      const indices = buildIndices();

      return {
        id,
        tier,
        family,
        size,
        palette: [...palette],
        indices,
        counts: countIndices(indices, {
          airIndex,
          liquidIndices: budgetLiquid,
        }),
        budget,
        integrityBlocks: integrityBlocks(),
      };
    },
    build() {
      integrityBlocks();
      return structureBuffer(size, palette, buildIndices());
    },
  };
}
