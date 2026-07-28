// Seeded island layout registry for the deterministic sky realm (roadmap 7/11).
//
// Determinism contract:
// - Every derived value comes from `(worldSeed, layoutVersion, islandId)`.
// - Random streams are separated by purpose, so retuning loot never moves an
//   island and retuning ore never changes an encounter.
// - Only `+ - * /`, `Math.floor`, `Math.round`, `Math.abs`, `Math.min`, and
//   `Math.max` are used. Trigonometric and exponential functions are avoided
//   because their last-bit results are implementation-defined, and the host
//   test runner and the in-game engine must agree exactly.
// - Iteration order is always an explicitly sorted array.
//
// Migration safety: `starter_island`, `ember_outpost`, and `frostspire` shipped
// with hand-tuned origins. They are `pinned` and the layout planner must return
// those exact origins forever, or every live test world regenerates on top of
// player edits. Only new islands take seeded placement.

import {
  BlockVector,
  StructureBounds,
  structureBounds,
} from "../generation/bounds";
import { fnv1a32 } from "../util/hash";

export interface FloatVector {
  x: number;
  y: number;
  z: number;
}

export interface IslandDockLocation {
  dimensionId: string;
  x: number;
  y: number;
  z: number;
}

// ---------------------------------------------------------------------------
// Random streams
// ---------------------------------------------------------------------------

export type RandomPurpose =
  "encounter" | "layout" | "loot" | "ore" | "structure" | "vegetation";

export const RANDOM_PURPOSES: readonly RandomPurpose[] = [
  "encounter",
  "layout",
  "loot",
  "ore",
  "structure",
  "vegetation",
];

export interface RandomStream {
  nextUint32(): number;
  nextFloat(): number;
  nextInt(minInclusive: number, maxExclusive: number): number;
  pick<T>(values: readonly T[]): T;
}

const KEY_SEPARATOR = "\0";
const UINT32_SCALE = 4294967296;

export function randomStreamKey(parts: readonly (string | number)[]): string {
  return parts.map((part) => String(part)).join(KEY_SEPARATOR);
}

export function createRandomStream(
  parts: readonly (string | number)[],
): RandomStream {
  let state = fnv1a32(randomStreamKey(parts)) >>> 0;

  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };

  const nextFloat = (): number => nextUint32() / UINT32_SCALE;

  const nextInt = (minInclusive: number, maxExclusive: number): number => {
    const span = maxExclusive - minInclusive;

    if (span <= 0) {
      return minInclusive;
    }

    return minInclusive + Math.floor(nextFloat() * span);
  };

  return {
    nextUint32,
    nextFloat,
    nextInt,
    pick<T>(values: readonly T[]): T {
      if (values.length === 0) {
        throw new Error("Cannot pick from an empty collection.");
      }

      return values[nextInt(0, values.length)];
    },
  };
}

/**
 * The purpose-separated stream every island content generator must use.
 * `contentVersion` is the island's own content version, so bumping loot content
 * reshuffles loot without touching layout (which uses `LAYOUT.layoutVersion`).
 */
export function islandRandomStream(
  worldSeed: number,
  contentVersion: number,
  islandId: string,
  purpose: RandomPurpose,
): RandomStream {
  return createRandomStream([
    worldSeed >>> 0,
    contentVersion,
    islandId,
    purpose,
  ]);
}

// ---------------------------------------------------------------------------
// Island families
// ---------------------------------------------------------------------------

export type IslandFamilyId = "desert" | "tundra" | "verdant" | "volcanic";

export interface IslandFamilyPalette {
  core: string;
  subsurface: string;
  surface: string;
  dock: string;
  accent: string;
  structure: string;
}

export interface IslandFamily {
  id: IslandFamilyId;
  paletteAnchor: string;
  palette: IslandFamilyPalette;
  oreTableId: string;
  structurePoolId: string;
  encounterTableId: string;
  minimumShipTier: number;
}

export const ISLAND_FAMILY_IDS: readonly IslandFamilyId[] = [
  "desert",
  "tundra",
  "verdant",
  "volcanic",
];

export const ISLAND_FAMILIES: Readonly<Record<IslandFamilyId, IslandFamily>> = {
  desert: {
    id: "desert",
    paletteAnchor: "sandstone/sand/terracotta",
    palette: {
      core: "minecraft:sandstone",
      subsurface: "minecraft:sand",
      surface: "minecraft:red_sand",
      dock: "minecraft:cut_sandstone",
      accent: "minecraft:terracotta",
      structure: "minecraft:chiseled_sandstone",
    },
    oreTableId: "skyknights:ore_table/desert",
    structurePoolId: "skyknights:structure_pool/desert",
    encounterTableId: "skyknights:encounter_table/desert",
    minimumShipTier: 1,
  },
  tundra: {
    id: "tundra",
    paletteAnchor: "snow/packed_ice/spruce",
    palette: {
      core: "minecraft:stone",
      subsurface: "minecraft:packed_ice",
      surface: "minecraft:snow_block",
      dock: "minecraft:spruce_planks",
      accent: "minecraft:blue_ice",
      structure: "minecraft:stone_bricks",
    },
    oreTableId: "skyknights:ore_table/tundra",
    structurePoolId: "skyknights:structure_pool/tundra",
    encounterTableId: "skyknights:encounter_table/tundra",
    minimumShipTier: 2,
  },
  verdant: {
    id: "verdant",
    paletteAnchor: "grass/dirt/oak",
    palette: {
      core: "minecraft:stone",
      subsurface: "minecraft:dirt",
      surface: "minecraft:grass_block",
      dock: "minecraft:oak_planks",
      accent: "minecraft:oak_log",
      structure: "minecraft:cobblestone",
    },
    oreTableId: "skyknights:ore_table/verdant",
    structurePoolId: "skyknights:structure_pool/verdant",
    encounterTableId: "skyknights:encounter_table/verdant",
    minimumShipTier: 0,
  },
  volcanic: {
    id: "volcanic",
    paletteAnchor: "blackstone/netherrack/basalt",
    palette: {
      core: "minecraft:blackstone",
      subsurface: "minecraft:basalt",
      surface: "minecraft:netherrack",
      dock: "minecraft:polished_blackstone_bricks",
      accent: "minecraft:magma",
      structure: "minecraft:stone_bricks",
    },
    oreTableId: "skyknights:ore_table/volcanic",
    structurePoolId: "skyknights:structure_pool/volcanic",
    encounterTableId: "skyknights:encounter_table/volcanic",
    minimumShipTier: 1,
  },
};

export function islandFamily(id: IslandFamilyId): IslandFamily {
  return ISLAND_FAMILIES[id];
}

// ---------------------------------------------------------------------------
// Island definitions
// ---------------------------------------------------------------------------

export interface IslandIntegrityBlock {
  offset: BlockVector;
  typeId: string;
}

export interface IslandAnchors {
  safeDock: FloatVector;
  lootChest?: BlockVector;
  encounterSpawn?: FloatVector;
}

export type IslandPlacementMode = "pinned" | "seeded";

/**
 * A structure can ship before its custom loot/entity definitions. Such an
 * island remains available to the deterministic layout, but script-side
 * gameplay preparation is forbidden until all referenced assets ship.
 */
export type IslandGameplayActivation = "ready" | "structure_only";

export interface IslandDefinition {
  id: string;
  family: IslandFamilyId;
  tier: number;
  structureId: string;
  dimensionId: string;
  contentVersion: number;
  size: BlockVector;
  placement: IslandPlacementMode;
  gameplayActivation: IslandGameplayActivation;
  pinnedOrigin?: BlockVector;
  integrityBlocks: readonly IslandIntegrityBlock[];
  anchors: IslandAnchors;
}

export const LAYOUT = {
  /**
   * Bumping this relocates every seeded island. It is intentionally separate
   * from per-island `contentVersion` so content retunes never move terrain.
   */
  layoutVersion: 1,
  dimensionId: "minecraft:overworld",
  /** Half-corridor kept empty around every island. */
  reservedPadding: { x: 12, y: 8, z: 12 },
  /** Cruising altitude of every inter-tier travel lane. */
  laneCruiseY: 208,
  /** Half-width of a travel lane corridor. */
  laneRadius: 6,
  maxPlacementAttempts: 64,
  /**
   * Chebyshev ring band per tier. Seeded islands sit on an integer square ring
   * so placement needs no trigonometry.
   */
  tierRings: [
    { min: 0, max: 0 },
    { min: 152, max: 200 },
    { min: 232, max: 288 },
    { min: 344, max: 408 },
  ],
  tierBaseY: [149, 148, 152, 156],
  tierAltitudeJitter: 9,
  /** Fraction (1/n) of a sector kept empty on both sides of an island. */
  sectorGuardDivisor: 6,
} as const;

export const ISLAND_STRUCTURE_IDS = {
  starter_island: "skyknights:starter_island",
  ember_outpost: "skyknights:ember_outpost",
  frostspire: "skyknights:frostspire",
  sunspire_reach: "skyknights:sunspire_reach",
  verdant_hollow: "skyknights:verdant_hollow",
  glacier_vault: "skyknights:glacier_vault",
  ashfall_crater: "skyknights:ashfall_crater",
  aether_sanctum: "skyknights:aether_sanctum",
} as const;

export interface CanonicalGeometry {
  centerX: number;
  centerZ: number;
  topY: number;
}

/**
 * The canonical body geometry every new island generator must reproduce.
 * Verified against the shipped Ember Outpost and Frostspire structures.
 */
export function canonicalGeometry(size: BlockVector): CanonicalGeometry {
  return {
    centerX: Math.floor((size.x - 1) / 2),
    centerZ: Math.floor((size.z - 1) / 2),
    topY: size.y - 5,
  };
}

/** The five integrity probes the generation service verifies after placement. */
export function canonicalIntegrityBlocks(
  size: BlockVector,
  palette: IslandFamilyPalette,
): readonly IslandIntegrityBlock[] {
  const { centerX, centerZ, topY } = canonicalGeometry(size);

  return [
    { offset: { x: centerX, y: 0, z: centerZ }, typeId: palette.core },
    { offset: { x: 0, y: topY, z: centerZ }, typeId: palette.dock },
    { offset: { x: size.x - 2, y: topY, z: centerZ }, typeId: palette.surface },
    { offset: { x: centerX, y: topY, z: 1 }, typeId: palette.surface },
    { offset: { x: centerX, y: topY, z: size.z - 2 }, typeId: palette.surface },
  ];
}

/** Canonical dock, loot, and encounter anchors as origin-relative offsets. */
export function canonicalAnchors(size: BlockVector): IslandAnchors {
  const { centerX, centerZ, topY } = canonicalGeometry(size);

  return {
    safeDock: { x: 2.5, y: topY + 1, z: centerZ + 0.5 },
    lootChest: { x: centerX, y: topY + 1, z: centerZ },
    encounterSpawn: { x: centerX + 0.5, y: topY + 1, z: centerZ + 4.5 },
  };
}

function seededIsland(
  id: keyof typeof ISLAND_STRUCTURE_IDS,
  family: IslandFamilyId,
  tier: number,
  size: BlockVector,
  gameplayActivation: IslandGameplayActivation = "structure_only",
): IslandDefinition {
  return {
    id,
    family,
    tier,
    structureId: ISLAND_STRUCTURE_IDS[id],
    dimensionId: LAYOUT.dimensionId,
    contentVersion: gameplayActivation === "ready" ? 2 : 1,
    size,
    placement: "seeded",
    gameplayActivation,
    integrityBlocks: canonicalIntegrityBlocks(
      size,
      ISLAND_FAMILIES[family].palette,
    ),
    anchors: canonicalAnchors(size),
  };
}

const STARTER_ISLAND_DEFINITION: IslandDefinition = {
  id: "starter_island",
  family: "verdant",
  tier: 0,
  structureId: ISLAND_STRUCTURE_IDS.starter_island,
  dimensionId: LAYOUT.dimensionId,
  contentVersion: 7,
  size: { x: 31, y: 16, z: 23 },
  placement: "pinned",
  gameplayActivation: "ready",
  pinnedOrigin: { x: -12, y: 149, z: -10 },
  // Hand-authored: the starter body is asymmetric and its dock overhangs +X.
  integrityBlocks: [
    { offset: { x: 12, y: 0, z: 10 }, typeId: "minecraft:stone" },
    { offset: { x: 1, y: 11, z: 10 }, typeId: "minecraft:grass_block" },
    { offset: { x: 23, y: 11, z: 10 }, typeId: "minecraft:oak_planks" },
    { offset: { x: 12, y: 11, z: 1 }, typeId: "minecraft:grass_block" },
    { offset: { x: 12, y: 11, z: 19 }, typeId: "minecraft:grass_block" },
    { offset: { x: 30, y: 11, z: 10 }, typeId: "minecraft:oak_planks" },
  ],
  anchors: {
    safeDock: { x: 21.5, y: 12, z: 10.5 },
  },
};

const EMBER_OUTPOST_SIZE: BlockVector = { x: 25, y: 14, z: 21 };
const FROSTSPIRE_SIZE: BlockVector = { x: 27, y: 15, z: 23 };

const EMBER_OUTPOST_DEFINITION: IslandDefinition = {
  id: "ember_outpost",
  family: "volcanic",
  tier: 1,
  structureId: ISLAND_STRUCTURE_IDS.ember_outpost,
  dimensionId: LAYOUT.dimensionId,
  contentVersion: 4,
  size: EMBER_OUTPOST_SIZE,
  placement: "pinned",
  gameplayActivation: "ready",
  pinnedOrigin: { x: 72, y: 151, z: -10 },
  integrityBlocks: canonicalIntegrityBlocks(
    EMBER_OUTPOST_SIZE,
    ISLAND_FAMILIES.volcanic.palette,
  ),
  anchors: canonicalAnchors(EMBER_OUTPOST_SIZE),
};

const FROSTSPIRE_DEFINITION: IslandDefinition = {
  id: "frostspire",
  family: "tundra",
  tier: 2,
  structureId: ISLAND_STRUCTURE_IDS.frostspire,
  dimensionId: LAYOUT.dimensionId,
  contentVersion: 2,
  size: FROSTSPIRE_SIZE,
  placement: "pinned",
  gameplayActivation: "ready",
  pinnedOrigin: { x: 240, y: 150, z: -11 },
  integrityBlocks: canonicalIntegrityBlocks(
    FROSTSPIRE_SIZE,
    ISLAND_FAMILIES.tundra.palette,
  ),
  anchors: canonicalAnchors(FROSTSPIRE_SIZE),
};

/** Sorted by id. Iteration order is part of the determinism contract. */
export const ISLAND_DEFINITIONS: readonly IslandDefinition[] = [
  seededIsland("aether_sanctum", "desert", 3, { x: 37, y: 22, z: 33 }, "ready"),
  seededIsland(
    "ashfall_crater",
    "volcanic",
    3,
    { x: 31, y: 18, z: 27 },
    "ready",
  ),
  EMBER_OUTPOST_DEFINITION,
  FROSTSPIRE_DEFINITION,
  seededIsland("glacier_vault", "tundra", 3, { x: 31, y: 18, z: 27 }, "ready"),
  STARTER_ISLAND_DEFINITION,
  seededIsland("sunspire_reach", "desert", 1, { x: 29, y: 16, z: 25 }, "ready"),
  seededIsland(
    "verdant_hollow",
    "verdant",
    1,
    { x: 27, y: 15, z: 23 },
    "ready",
  ),
];

export function islandDefinition(id: string): IslandDefinition {
  const definition = ISLAND_DEFINITIONS.find(
    (candidate) => candidate.id === id,
  );

  if (definition === undefined) {
    throw new Error(`Unknown Sky Knights island ${id}.`);
  }

  return definition;
}

/** Every .mcstructure that is expected in the shipped behavior pack. */
export function shippedIslandStructureIds(): readonly string[] {
  return ISLAND_DEFINITIONS.map((definition) => definition.structureId);
}

/** True only when script-side loot/entity preparation is safe to execute. */
export function isIslandGameplayReady(definition: IslandDefinition): boolean {
  return definition.gameplayActivation === "ready";
}

export function islandIdsByTier(tier: number): readonly string[] {
  return ISLAND_DEFINITIONS.filter(
    (definition) => definition.tier === tier,
  ).map((definition) => definition.id);
}

/** Lowest-id island of a tier; the hub every next-tier lane departs from. */
export function tierHubIslandId(tier: number): string {
  const ids = islandIdsByTier(tier);

  if (ids.length === 0) {
    throw new Error(`No Sky Knights island is registered for tier ${tier}.`);
  }

  return ids[0];
}

// ---------------------------------------------------------------------------
// Bounds helpers
// ---------------------------------------------------------------------------

const AXES: readonly ["x", "y", "z"] = ["x", "y", "z"];

export function expandBounds(
  bounds: StructureBounds,
  padding: BlockVector,
): StructureBounds {
  return {
    from: {
      x: bounds.from.x - padding.x,
      y: bounds.from.y - padding.y,
      z: bounds.from.z - padding.z,
    },
    to: {
      x: bounds.to.x + padding.x,
      y: bounds.to.y + padding.y,
      z: bounds.to.z + padding.z,
    },
  };
}

export function boundsOverlap(
  left: StructureBounds,
  right: StructureBounds,
): boolean {
  for (const axis of AXES) {
    if (left.from[axis] > right.to[axis] || right.from[axis] > left.to[axis]) {
      return false;
    }
  }

  return true;
}

/** Slab-method segment/AABB test. Used to prove travel lanes stay clear. */
export function segmentIntersectsBounds(
  from: BlockVector,
  to: BlockVector,
  bounds: StructureBounds,
): boolean {
  let enter = 0;
  let exit = 1;

  for (const axis of AXES) {
    const start = from[axis];
    const delta = to[axis] - start;
    const low = bounds.from[axis];
    const high = bounds.to[axis];

    if (delta === 0) {
      if (start < low || start > high) {
        return false;
      }

      continue;
    }

    let near = (low - start) / delta;
    let far = (high - start) / delta;

    if (near > far) {
      const swap = near;
      near = far;
      far = swap;
    }

    enter = Math.max(enter, near);
    exit = Math.min(exit, far);

    if (enter > exit) {
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Seeded layout
// ---------------------------------------------------------------------------

export interface IslandPlacement {
  id: string;
  family: IslandFamilyId;
  tier: number;
  structureId: string;
  dimensionId: string;
  contentVersion: number;
  placement: IslandPlacementMode;
  origin: BlockVector;
  size: BlockVector;
  center: BlockVector;
  bounds: StructureBounds;
  reserved: StructureBounds;
  integrityBlocks: readonly IslandIntegrityBlock[];
  safeDock: IslandDockLocation;
  lootChest?: BlockVector;
  encounterSpawn?: IslandDockLocation;
}

export interface TravelLane {
  fromIslandId: string;
  toIslandId: string;
  cruiseY: number;
  points: readonly BlockVector[];
}

export interface IslandLayout {
  worldSeed: number;
  layoutVersion: number;
  placements: readonly IslandPlacement[];
  lanes: readonly TravelLane[];
}

function ringPoint(radius: number, perimeterIndex: number): BlockVector {
  const sideLength = radius * 2;
  const perimeter = sideLength * 4;
  const wrapped = ((perimeterIndex % perimeter) + perimeter) % perimeter;
  const side = Math.floor(wrapped / sideLength);
  const offset = wrapped - side * sideLength - radius;

  if (side === 0) {
    return { x: radius, y: 0, z: offset };
  }

  if (side === 1) {
    return { x: -offset, y: 0, z: radius };
  }

  if (side === 2) {
    return { x: -radius, y: 0, z: -offset };
  }

  return { x: offset, y: 0, z: -radius };
}

function originFromCenter(
  center: BlockVector,
  size: BlockVector,
  y: number,
): BlockVector {
  return {
    x: center.x - Math.floor((size.x - 1) / 2),
    y,
    z: center.z - Math.floor((size.z - 1) / 2),
  };
}

function toPlacement(
  definition: IslandDefinition,
  origin: BlockVector,
): IslandPlacement {
  const bounds = structureBounds(origin, definition.size);
  const anchors = definition.anchors;

  return {
    id: definition.id,
    family: definition.family,
    tier: definition.tier,
    structureId: definition.structureId,
    dimensionId: definition.dimensionId,
    contentVersion: definition.contentVersion,
    placement: definition.placement,
    origin,
    size: definition.size,
    center: {
      x: origin.x + Math.floor((definition.size.x - 1) / 2),
      y: origin.y,
      z: origin.z + Math.floor((definition.size.z - 1) / 2),
    },
    bounds,
    reserved: expandBounds(bounds, LAYOUT.reservedPadding),
    integrityBlocks: definition.integrityBlocks,
    safeDock: {
      dimensionId: definition.dimensionId,
      x: origin.x + anchors.safeDock.x,
      y: origin.y + anchors.safeDock.y,
      z: origin.z + anchors.safeDock.z,
    },
    lootChest:
      anchors.lootChest === undefined
        ? undefined
        : {
            x: origin.x + anchors.lootChest.x,
            y: origin.y + anchors.lootChest.y,
            z: origin.z + anchors.lootChest.z,
          },
    encounterSpawn:
      anchors.encounterSpawn === undefined
        ? undefined
        : {
            dimensionId: definition.dimensionId,
            x: origin.x + anchors.encounterSpawn.x,
            y: origin.y + anchors.encounterSpawn.y,
            z: origin.z + anchors.encounterSpawn.z,
          },
  };
}

function tierRing(tier: number): { min: number; max: number } {
  if (tier < 1 || tier >= LAYOUT.tierRings.length) {
    throw new Error(`Tier ${tier} has no seeded placement ring.`);
  }

  return LAYOUT.tierRings[tier];
}

function seededOrigin(
  worldSeed: number,
  layoutVersion: number,
  definition: IslandDefinition,
  sectorIndex: number,
  sectorCount: number,
  accepted: readonly IslandPlacement[],
): BlockVector {
  const ring = tierRing(definition.tier);
  const baseY = LAYOUT.tierBaseY[definition.tier];

  for (let attempt = 0; attempt < LAYOUT.maxPlacementAttempts; attempt += 1) {
    const stream = createRandomStream([
      worldSeed >>> 0,
      layoutVersion,
      definition.id,
      "layout",
      attempt,
    ]);
    const radius = stream.nextInt(ring.min, ring.max + 1);
    const perimeter = radius * 8;
    const sectorSpan = Math.floor(perimeter / sectorCount);
    const guard = Math.floor(sectorSpan / LAYOUT.sectorGuardDivisor);
    const perimeterIndex =
      sectorIndex * sectorSpan +
      guard +
      stream.nextInt(0, sectorSpan - guard * 2);
    const center = ringPoint(radius, perimeterIndex);
    const y = baseY + stream.nextInt(0, LAYOUT.tierAltitudeJitter);
    const origin = originFromCenter(center, definition.size, y);
    const candidate = toPlacement(definition, origin);
    let blocked = false;

    for (const placed of accepted) {
      if (boundsOverlap(candidate.reserved, placed.reserved)) {
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      return origin;
    }
  }

  throw new Error(
    `Could not reserve non-overlapping bounds for ${definition.id} after ` +
      `${LAYOUT.maxPlacementAttempts} attempts.`,
  );
}

/**
 * Computes the whole realm layout for a world seed.
 *
 * Pinned islands are placed first at their shipped origins, then seeded islands
 * are placed in `(tier, id)` order. Each seeded island draws a Chebyshev ring
 * radius, an angular sector reserved for its sorted position within its tier,
 * and an altitude jitter; candidates whose reserved bounds collide are rejected
 * and redrawn with a deterministic attempt salt.
 */
export function planIslandLayout(
  worldSeed: number,
  layoutVersion: number = LAYOUT.layoutVersion,
): IslandLayout {
  const placements: IslandPlacement[] = [];

  for (const definition of ISLAND_DEFINITIONS) {
    if (definition.placement !== "pinned") {
      continue;
    }

    if (definition.pinnedOrigin === undefined) {
      throw new Error(`Pinned island ${definition.id} has no pinned origin.`);
    }

    placements.push(toPlacement(definition, definition.pinnedOrigin));
  }

  const seeded = ISLAND_DEFINITIONS.filter(
    (definition) => definition.placement === "seeded",
  ).sort((left, right) =>
    left.tier !== right.tier
      ? left.tier - right.tier
      : left.id < right.id
        ? -1
        : 1,
  );

  for (const definition of seeded) {
    const tierIds = islandIdsByTier(definition.tier);
    const origin = seededOrigin(
      worldSeed,
      layoutVersion,
      definition,
      tierIds.indexOf(definition.id),
      tierIds.length,
      placements,
    );
    placements.push(toPlacement(definition, origin));
  }

  placements.sort((left, right) => (left.id < right.id ? -1 : 1));

  return {
    worldSeed: worldSeed >>> 0,
    layoutVersion,
    placements,
    lanes: travelLanes(placements),
  };
}

export function islandPlacement(
  layout: IslandLayout,
  id: string,
): IslandPlacement {
  const placement = layout.placements.find((candidate) => candidate.id === id);

  if (placement === undefined) {
    throw new Error(`Layout has no placement for island ${id}.`);
  }

  return placement;
}

function dockColumn(placement: IslandPlacement): BlockVector {
  return {
    x: Math.round(placement.safeDock.x),
    y: Math.round(placement.safeDock.y),
    z: Math.round(placement.safeDock.z),
  };
}

/**
 * One lane per island above tier 0, departing from the previous tier's hub.
 * A lane climbs from the source dock to `laneCruiseY`, crosses at that
 * altitude, then descends to the destination dock, so the cruise leg never
 * passes through reserved island bounds.
 */
function travelLanes(
  placements: readonly IslandPlacement[],
): readonly TravelLane[] {
  const byId = new Map(
    placements.map((placement) => [placement.id, placement] as const),
  );
  const lanes: TravelLane[] = [];

  for (const placement of placements) {
    if (placement.tier <= 0) {
      continue;
    }

    const fromId = tierHubIslandId(placement.tier - 1);

    if (fromId === placement.id) {
      continue;
    }

    const from = byId.get(fromId);

    if (from === undefined) {
      continue;
    }

    const start = dockColumn(from);
    const end = dockColumn(placement);
    lanes.push({
      fromIslandId: fromId,
      toIslandId: placement.id,
      cruiseY: LAYOUT.laneCruiseY,
      points: [
        start,
        { x: start.x, y: LAYOUT.laneCruiseY, z: start.z },
        { x: end.x, y: LAYOUT.laneCruiseY, z: end.z },
        end,
      ],
    });
  }

  return lanes;
}

/** Every island pair whose reserved bounds intersect. Empty means valid. */
export function overlappingIslandPairs(
  layout: IslandLayout,
): readonly string[] {
  const failures: string[] = [];

  for (let left = 0; left < layout.placements.length; left += 1) {
    for (let right = left + 1; right < layout.placements.length; right += 1) {
      const a = layout.placements[left];
      const b = layout.placements[right];

      if (boundsOverlap(a.reserved, b.reserved)) {
        failures.push(`${a.id} overlaps ${b.id}`);
      }
    }
  }

  return failures;
}

/**
 * Every travel-lane segment that clips a reserved bound belonging to an island
 * that is not one of the lane's two endpoints. Empty means all lanes are clear.
 */
export function laneObstructions(layout: IslandLayout): readonly string[] {
  const laneCorridor: BlockVector = {
    x: LAYOUT.laneRadius,
    y: LAYOUT.laneRadius,
    z: LAYOUT.laneRadius,
  };
  const failures: string[] = [];

  for (const lane of layout.lanes) {
    for (let index = 0; index + 1 < lane.points.length; index += 1) {
      const from = lane.points[index];
      const to = lane.points[index + 1];

      for (const placement of layout.placements) {
        if (
          placement.id === lane.fromIslandId ||
          placement.id === lane.toIslandId
        ) {
          continue;
        }

        const corridor = expandBounds(placement.reserved, laneCorridor);

        if (segmentIntersectsBounds(from, to, corridor)) {
          failures.push(
            `${lane.fromIslandId}->${lane.toIslandId} segment ${index} ` +
              `clips ${placement.id}`,
          );
        }
      }
    }
  }

  return failures;
}
