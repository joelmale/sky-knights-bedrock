import { fnv1a32 } from "../util/hash";

export type ArchipelagoFamily = "verdant" | "desert" | "tundra" | "volcanic";

/**
 * Size classes. `continent` is not part of the per-cell tier roll: continents
 * live on their own coarse hex ring (see `archipelagoContinentSites`).
 */
export type ArchipelagoTier =
  | "islet"
  | "standard"
  | "crag"
  | "landmark"
  | "continent";

/** Rare deterministic swaps that replace the plain family structure. */
export type ArchipelagoVariant = "ember" | "pyre" | "mesa";

export type ArchipelagoRotation =
  | "None"
  | "Rotate90"
  | "Rotate180"
  | "Rotate270";

export type ArchipelagoBandId =
  | "deep"
  | "low"
  | "mid"
  | "high"
  | "crown"
  | "continent";

export interface ArchipelagoIntegrityBlock {
  offset: { x: number; y: number; z: number };
  typeId: string;
}

/** One `structureManager.place` call inside a composed (continent) island. */
export interface ArchipelagoPart {
  structureId: string;
  /** Absolute world origin for this component. */
  origin: { x: number; y: number; z: number };
  rotation: ArchipelagoRotation;
  /** Grid row; every part in a row shares one generation ticking area. */
  row: number;
  size: { x: number; y: number; z: number };
  /** Probe offset relative to this part's own origin. */
  integrityBlock: ArchipelagoIntegrityBlock;
}

export interface ArchipelagoIsland {
  id: string;
  family: ArchipelagoFamily;
  tier: ArchipelagoTier;
  variant?: ArchipelagoVariant;
  cellX: number;
  cellZ: number;
  /** Horizontal center of the island structure. */
  x: number;
  /** Bottom of the island structure. */
  y: number;
  /** Horizontal center of the island structure. */
  z: number;
  /** Full footprint of the island, composed parts included. */
  size: { x: number; y: number; z: number };
  /** Horizontal clearance radius reserved around `x`/`z`. */
  radius: number;
  /** Vertical clearance half-height reserved around the island's mid plane. */
  heightRadius: number;
  /** Altitude band the island was rolled into. */
  band: ArchipelagoBandId;
  /** Local Y of the walkable surface, used by safe-dock recovery. */
  dockY: number;
  /** Part 0's structure for single-structure islands, or the composed root. */
  structureId: string;
  /** Present only for composed islands; `undefined` means one place() call. */
  parts?: readonly ArchipelagoPart[];
}

export interface ArchipelagoCluster {
  family: ArchipelagoFamily;
  cellX: number;
  cellZ: number;
}

export interface ArchipelagoTemplate {
  structureId: string;
  size: { x: number; y: number; z: number };
  radius: number;
  heightRadius: number;
  dockY: number;
  integrityBlocks: readonly ArchipelagoIntegrityBlock[];
}

export interface ArchipelagoAltitudeBand {
  id: ArchipelagoBandId;
  minY: number;
  maxY: number;
}

export interface ArchipelagoContinentSite {
  index: number;
  cellX: number;
  cellZ: number;
}

export const ARCHIPELAGO_CONFIG = {
  /**
   * Bumping this changes the id prefix, so the planner stops recognising every
   * island a previous version placed. Those islands stay on disk as inert
   * terrain and their ids stay in `generatedIslandIds` forever; that is the
   * cheapest correct migration and it is safe because the four `ambient_*`
   * structures are frozen and still ship in the pack.
   */
  idVersion: 2,
  /** Finite planning envelope: 57 x 57 possible cells. */
  maxCellRadius: 28,
  /** Protects every authored progression island and its travel lanes. */
  protectedRadius: 460,
  cellSize: 96,
  /**
   * Minimum gap between two islands' clearance cylinders. Replaces the old flat
   * `minSpacing`, which was meaningless once radii range from 14 to 113.
   */
  minEdgeGap: 12,
  maxQueryRadius: 512,
  /**
   * Never stamp a new island near an active player. The effective distance is
   * `max(minObserverDistanceFloor, island.radius + minObserverClearanceBase)`.
   */
  minObserverDistanceFloor: 48,
  minObserverClearanceBase: 24,
  /**
   * Persistence/performance gate; the plan contains more possible islands.
   * Halved from 384 because the average island is now ~666 solid blocks
   * instead of ~285 (0.35*105 + 0.45*285 + 0.16*1500 + 0.04*6100), so the
   * lifetime placed-block ceiling stays roughly constant.
   */
  maxGeneratedIslands: 224,
  /** Continents are counted and capped separately from ambient islands. */
  maxGeneratedContinents: 2,
  /** One in every three eligible cells contains an island. */
  generationDensity: 3,
  /**
   * Absolute vertical clamps.
   *
   * `absoluteMinY` is 68 and NOT the 60 the design sketch used, because
   * `VOID_RESCUE_Y` in scripts/config/constants.ts is 64: a player standing on
   * an island whose base sits below that trips void rescue. Lower both together
   * or neither.
   */
  absoluteMinY: 68,
  /**
   * Overworld build ceiling is 319. Clamping the ORIGIN so that
   * `origin.y + size.y - 1 <= 314` keeps five blocks of headroom for a future
   * taller tier.
   */
  absoluteMaxTopY: 314,
  /** Continents sit on a hex ring at this cell radius (2304 blocks). */
  continentRingCellRadius: 24,
  continentSiteCount: 6,
  continentJitterCells: 2,
  /** Chebyshev radius of ambient cells suppressed around a continent anchor. */
  continentSuppressionCells: 2,
  continentGrid: 5,
  continentComponentSize: { x: 30, y: 40, z: 30 },
  /** The four grid corners are omitted so the landmass reads as rounded. */
  continentOmittedCorners: true,
  /**
   * Cells inside this Chebyshev radius are pinned to the `mid` band so the
   * first islands a new player sees from the starter island stay at roughly
   * the altitude the onboarding sightline assumes.
   */
  onboardingCellRadius: 6,
} as const;

/**
 * Deliberately overlapping so the world reads as continuous strata rather than
 * five discrete shelves.
 */
export const ALTITUDE_BANDS: readonly ArchipelagoAltitudeBand[] = [
  { id: "deep", minY: 68, maxY: 112 },
  { id: "low", minY: 100, maxY: 160 },
  { id: "mid", minY: 150, maxY: 212 },
  { id: "high", minY: 205, maxY: 268 },
  { id: "crown", minY: 250, maxY: 290 },
];

/** Fixed band for continents: they are the floor the world flies over. */
export const CONTINENT_BAND: ArchipelagoAltitudeBand = {
  id: "continent",
  minY: 96,
  maxY: 128,
};

type RollableTier = Exclude<ArchipelagoTier, "continent">;

interface BandWeight {
  band: ArchipelagoBandId;
  max: number;
}

/** Cumulative `bandRoll % 100` tables, walked in fixed array order. */
const TIER_BAND_WEIGHTS: Readonly<Record<RollableTier, readonly BandWeight[]>> =
  {
    islet: [
      { band: "deep", max: 24 },
      { band: "low", max: 49 },
      { band: "mid", max: 69 },
      { band: "high", max: 89 },
      { band: "crown", max: 99 },
    ],
    standard: [
      { band: "deep", max: 9 },
      { band: "low", max: 39 },
      { band: "mid", max: 74 },
      { band: "high", max: 99 },
    ],
    crag: [
      { band: "low", max: 19 },
      { band: "mid", max: 54 },
      { band: "high", max: 89 },
      { band: "crown", max: 99 },
    ],
    landmark: [
      { band: "mid", max: 29 },
      { band: "high", max: 69 },
      { band: "crown", max: 99 },
    ],
  };

/** `tierRoll % 1000`, walked in order. Shares: 35 / 45 / 16 / 4 percent. */
export const TIER_ROLL_BUCKETS: readonly {
  tier: RollableTier;
  max: number;
}[] = [
  { tier: "islet", max: 349 },
  { tier: "standard", max: 799 },
  { tier: "crag", max: 959 },
  { tier: "landmark", max: 999 },
];

const FAMILY_PALETTES: Readonly<
  Record<ArchipelagoFamily, { core: string; surface: string }>
> = {
  verdant: {
    core: "minecraft:stone",
    surface: "minecraft:grass_block",
  },
  desert: {
    core: "minecraft:sandstone",
    surface: "minecraft:red_sand",
  },
  tundra: {
    core: "minecraft:stone",
    surface: "minecraft:snow_block",
  },
  volcanic: {
    core: "minecraft:blackstone",
    surface: "minecraft:netherrack",
  },
};

/**
 * Body geometry each solo tier's generator must honour. `radiusX`/`radiusZ` are
 * `taperedEllipsoidBody.radiusAt(topY)`, so the four surface probes land exactly
 * on the rim of the top layer — the cells least likely to be carved by a cave,
 * lake, or peak.
 */
interface TierGeometry {
  size: { x: number; y: number; z: number };
  centerX: number;
  centerZ: number;
  topY: number;
  radiusX: number;
  radiusZ: number;
  radius: number;
  heightRadius: number;
  dockY: number;
}

const TIER_GEOMETRY: Readonly<Record<RollableTier, TierGeometry>> = {
  // canonicalIslandBody([11, 8, 9])
  islet: {
    size: { x: 11, y: 8, z: 9 },
    centerX: 5,
    centerZ: 4,
    topY: 3,
    radiusX: 4,
    radiusZ: 3,
    radius: 14,
    heightRadius: 8,
    dockY: 4,
  },
  // canonicalIslandBody([15, 10, 13]) - the four frozen ambient_* modules.
  standard: {
    size: { x: 15, y: 10, z: 13 },
    centerX: 7,
    centerZ: 6,
    topY: 5,
    radiusX: 6,
    radiusZ: 5,
    radius: 16,
    heightRadius: 9,
    dockY: 6,
  },
  // taperedEllipsoidBody topY 9 (NOT canonical, whose 13 leaves no headroom).
  crag: {
    size: { x: 23, y: 18, z: 21 },
    centerX: 11,
    centerZ: 10,
    topY: 9,
    radiusX: 11,
    radiusZ: 9,
    radius: 22,
    heightRadius: 13,
    dockY: 10,
  },
  // taperedEllipsoidBody topY 14, growth 15/14.
  landmark: {
    size: { x: 39, y: 30, z: 35 },
    centerX: 19,
    centerZ: 17,
    topY: 14,
    radiusX: 18,
    radiusZ: 16,
    radius: 33,
    heightRadius: 19,
    dockY: 15,
  },
};

/** Continent components are family-neutral: one shared temperate palette. */
const CONTINENT_PALETTE = {
  core: "minecraft:stone",
  surface: "minecraft:grass_block",
} as const;

/** Local Y of the continent core slab's bottom layer. */
const CONTINENT_CORE_Y = 12;
/** Local Y of the continent surface datum. */
const CONTINENT_SURFACE_Y = 20;
/**
 * Rotation-safe probe cell. Its whole 4-fold orbit — (5,5), (24,5), (5,24) and
 * (24,24) — must be solid core in EVERY continent component, so the probe holds
 * whichever handedness the engine's Rotate90 uses.
 */
const CONTINENT_PROBE = { x: 5, y: CONTINENT_CORE_Y, z: 5 } as const;

const CONTINENT_COMPONENT_IDS = [
  "skyknights:comp_coast",
  "skyknights:comp_plain",
  "skyknights:comp_lake",
  "skyknights:comp_ridge",
  "skyknights:comp_chasm",
  "skyknights:comp_bridge",
  "skyknights:duo_mesa",
] as const;

const FAMILIES: readonly ArchipelagoFamily[] = [
  "verdant",
  "desert",
  "tundra",
  "volcanic",
];

const ID_PREFIX = `a${ARCHIPELAGO_CONFIG.idVersion}`;
const ID_PATTERN = /^a2_([np]\d+)_([np]\d+)$/u;

function soloTemplate(
  tier: RollableTier,
  structureId: string,
  palette: { core: string; surface: string },
): ArchipelagoTemplate {
  const geometry = TIER_GEOMETRY[tier];

  return {
    structureId,
    size: geometry.size,
    radius: geometry.radius,
    heightRadius: geometry.heightRadius,
    dockY: geometry.dockY,
    integrityBlocks: [
      {
        offset: { x: geometry.centerX, y: 0, z: geometry.centerZ },
        typeId: palette.core,
      },
      {
        offset: {
          x: geometry.centerX - geometry.radiusX,
          y: geometry.topY,
          z: geometry.centerZ,
        },
        typeId: palette.surface,
      },
      {
        offset: {
          x: geometry.centerX + geometry.radiusX,
          y: geometry.topY,
          z: geometry.centerZ,
        },
        typeId: palette.surface,
      },
      {
        offset: {
          x: geometry.centerX,
          y: geometry.topY,
          z: geometry.centerZ - geometry.radiusZ,
        },
        typeId: palette.surface,
      },
      {
        offset: {
          x: geometry.centerX,
          y: geometry.topY,
          z: geometry.centerZ + geometry.radiusZ,
        },
        typeId: palette.surface,
      },
    ],
  };
}

/**
 * Burning islands probe deep core only. A probe on fire, oak, or lava would be
 * flaky (fire ticks) or destroyed by the burn, and a failed post-burn integrity
 * check would make the service re-place the structure and resurrect the grove
 * forever.
 */
function burnTemplate(
  tier: "crag" | "landmark",
  structureId: string,
): ArchipelagoTemplate {
  const geometry = TIER_GEOMETRY[tier];
  const core = FAMILY_PALETTES.volcanic.core;
  const dz = tier === "crag" ? 1 : 2;

  return {
    structureId,
    size: geometry.size,
    radius: geometry.radius,
    heightRadius: geometry.heightRadius,
    dockY: geometry.dockY,
    integrityBlocks: [
      { offset: { x: geometry.centerX, y: 0, z: geometry.centerZ }, typeId: core },
      {
        offset: { x: geometry.centerX - 2, y: 1, z: geometry.centerZ },
        typeId: core,
      },
      {
        offset: { x: geometry.centerX + 2, y: 1, z: geometry.centerZ },
        typeId: core,
      },
      {
        offset: { x: geometry.centerX, y: 1, z: geometry.centerZ - dz },
        typeId: core,
      },
      {
        offset: { x: geometry.centerX, y: 1, z: geometry.centerZ + dz },
        typeId: core,
      },
    ],
  };
}

/** `duo_mesa` placed alone: a landmark-scale slab with clean cliff walls. */
const MESA_TEMPLATE: ArchipelagoTemplate = {
  structureId: "skyknights:duo_mesa",
  size: ARCHIPELAGO_CONFIG.continentComponentSize,
  radius: 28,
  heightRadius: 24,
  dockY: CONTINENT_SURFACE_Y + 1,
  integrityBlocks: [
    { offset: { x: 5, y: CONTINENT_CORE_Y, z: 5 }, typeId: CONTINENT_PALETTE.core },
    {
      offset: { x: 24, y: CONTINENT_CORE_Y, z: 5 },
      typeId: CONTINENT_PALETTE.core,
    },
    {
      offset: { x: 5, y: CONTINENT_CORE_Y, z: 24 },
      typeId: CONTINENT_PALETTE.core,
    },
    {
      offset: { x: 24, y: CONTINENT_CORE_Y, z: 24 },
      typeId: CONTINENT_PALETTE.core,
    },
    {
      offset: { x: 15, y: CONTINENT_SURFACE_Y, z: 5 },
      typeId: CONTINENT_PALETTE.surface,
    },
  ],
};

const CONTINENT_FOOTPRINT = {
  x: ARCHIPELAGO_CONFIG.continentGrid * ARCHIPELAGO_CONFIG.continentComponentSize.x,
  y: ARCHIPELAGO_CONFIG.continentComponentSize.y,
  z: ARCHIPELAGO_CONFIG.continentGrid * ARCHIPELAGO_CONFIG.continentComponentSize.z,
} as const;

/**
 * The composed-island template. `integrityBlocks` is filled per island from the
 * 21 resolved parts; this entry only carries the footprint and the anchors.
 */
const CONTINENT_TEMPLATE: ArchipelagoTemplate = {
  structureId: "skyknights:comp_ridge",
  size: CONTINENT_FOOTPRINT,
  radius: 113,
  heightRadius: 26,
  dockY: CONTINENT_SURFACE_Y + 1,
  integrityBlocks: [],
};

function templateEntries(): Record<string, ArchipelagoTemplate> {
  const templates: Record<string, ArchipelagoTemplate> = {};

  for (const family of FAMILIES) {
    const palette = FAMILY_PALETTES[family];

    templates[`islet_${family}`] = soloTemplate(
      "islet",
      `skyknights:islet_${family}`,
      palette,
    );
    // The four existing modules are frozen; their structure ids never change.
    templates[`standard_${family}`] = soloTemplate(
      "standard",
      `skyknights:ambient_${family}`,
      palette,
    );
    templates[`crag_${family}`] = soloTemplate(
      "crag",
      `skyknights:crag_${family}`,
      palette,
    );
    templates[`landmark_${family}`] = soloTemplate(
      "landmark",
      `skyknights:landmark_${family}`,
      palette,
    );
  }

  templates.crag_volcanic_ember = burnTemplate(
    "crag",
    "skyknights:crag_volcanic_ember",
  );
  templates.landmark_volcanic_ember = burnTemplate(
    "landmark",
    "skyknights:landmark_volcanic_ember",
  );
  templates.landmark_volcanic_pyre = burnTemplate(
    "landmark",
    "skyknights:landmark_volcanic_pyre",
  );
  templates.landmark_mesa = MESA_TEMPLATE;
  templates.continent = CONTINENT_TEMPLATE;

  return templates;
}

export const ARCHIPELAGO_TEMPLATES: Readonly<
  Record<string, ArchipelagoTemplate>
> = templateEntries();

export function archipelagoTemplateKey(
  tier: ArchipelagoTier,
  family: ArchipelagoFamily,
  variant?: ArchipelagoVariant,
): string {
  if (tier === "continent") {
    return "continent";
  }

  if (variant === "mesa") {
    return "landmark_mesa";
  }

  if (variant === "ember") {
    return `${tier}_volcanic_ember`;
  }

  if (variant === "pyre") {
    return "landmark_volcanic_pyre";
  }

  return `${tier}_${family}`;
}

function structureIdCatalogue(): readonly string[] {
  const ids = new Set<string>(CONTINENT_COMPONENT_IDS);

  for (const key of Object.keys(ARCHIPELAGO_TEMPLATES)) {
    ids.add(ARCHIPELAGO_TEMPLATES[key].structureId);
  }

  return Array.from(ids).sort();
}

export const ARCHIPELAGO_STRUCTURE_IDS: readonly string[] =
  structureIdCatalogue();

function hash(values: readonly (string | number)[]): number {
  return fnv1a32(values.map(String).join("\0")) >>> 0;
}

function clusterPlan(
  worldSeed: number,
  layoutVersion: number,
): readonly ArchipelagoCluster[] {
  const radius = Math.floor(ARCHIPELAGO_CONFIG.maxCellRadius * 0.62);
  const bases = [
    { cellX: -radius, cellZ: -radius },
    { cellX: radius, cellZ: -radius },
    { cellX: -radius, cellZ: radius },
    { cellX: radius, cellZ: radius },
  ] as const;

  return FAMILIES.map((family, index) => {
    const random = hash([worldSeed >>> 0, layoutVersion, family, "cluster"]);

    return {
      family,
      cellX: bases[index].cellX + (random % 5) - 2,
      cellZ: bases[index].cellZ + (Math.floor(random / 5) % 5) - 2,
    };
  });
}

function familyFor(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
): ArchipelagoFamily {
  const clusters = clusterPlan(worldSeed, layoutVersion);
  let selected = clusters[0];
  let selectedDistance = Number.POSITIVE_INFINITY;

  for (const cluster of clusters) {
    const distance =
      Math.abs(cellX - cluster.cellX) + Math.abs(cellZ - cluster.cellZ);

    if (distance < selectedDistance) {
      selected = cluster;
      selectedDistance = distance;
    }
  }

  return selected.family;
}

/** Deterministic size class for a cell. Shares: 35 / 45 / 16 / 4 percent. */
export function archipelagoTierFor(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
): RollableTier {
  const roll =
    hash([worldSeed >>> 0, layoutVersion, cellX, cellZ, "tier"]) % 1000;

  for (const bucket of TIER_ROLL_BUCKETS) {
    if (roll <= bucket.max) {
      return bucket.tier;
    }
  }

  return "standard";
}

function bandById(id: ArchipelagoBandId): ArchipelagoAltitudeBand {
  return (
    ALTITUDE_BANDS.find((band) => band.id === id) ??
    ALTITUDE_BANDS[2] /* mid */
  );
}

/**
 * Which stratum a cell's island sits in. Cells inside `onboardingCellRadius`
 * are pinned to `mid` so the first islands visible from spawn stay at roughly
 * the altitude the onboarding sightline assumes.
 */
export function archipelagoBandFor(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
  tier: RollableTier,
): ArchipelagoAltitudeBand {
  if (
    Math.max(Math.abs(cellX), Math.abs(cellZ)) <=
    ARCHIPELAGO_CONFIG.onboardingCellRadius
  ) {
    return bandById("mid");
  }

  const roll =
    hash([worldSeed >>> 0, layoutVersion, cellX, cellZ, "band"]) % 100;

  for (const weight of TIER_BAND_WEIGHTS[tier]) {
    if (roll <= weight.max) {
      return bandById(weight.band);
    }
  }

  return bandById("mid");
}

/**
 * Structure-origin Y for a cell. Integer arithmetic only: `+ - * %`,
 * `Math.floor/min/max`. No `Math.random`, no `Date.now`, no trigonometry.
 */
export function archipelagoAltitude(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
  tier: RollableTier,
  sizeY: number,
): number {
  const band = archipelagoBandFor(worldSeed, layoutVersion, cellX, cellZ, tier);
  const span = band.maxY - band.minY + 1;
  const coarse =
    hash([worldSeed >>> 0, layoutVersion, cellX, cellZ, "altitude"]) % span;
  // Ridge term: neighbouring cells drift together, so a band reads as a sloping
  // shelf instead of per-cell noise. The double modulo keeps the result in
  // -4..4 for negative cell coordinates too.
  const ridge = ((((cellX * 7 + cellZ * 13) % 9) + 9) % 9) - 4;
  const ceiling = Math.min(
    band.maxY,
    ARCHIPELAGO_CONFIG.absoluteMaxTopY - sizeY + 1,
  );
  const floor = Math.max(band.minY, ARCHIPELAGO_CONFIG.absoluteMinY);

  return Math.max(
    ARCHIPELAGO_CONFIG.absoluteMinY,
    Math.min(ceiling, Math.max(floor, band.minY + coarse + ridge)),
  );
}

/**
 * Deterministic rare swaps. Evaluated in a fixed order so two gates can never
 * coincide:
 *
 *   1. `mesa`  - 1 in 5 landmarks of any family become `duo_mesa`.
 *   2. `ember` - 1 in 8 remaining volcanic crags/landmarks burn forever.
 *   3. `pyre`  - 1 in 16 of what is left (landmarks only) burns down once.
 */
function variantFor(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
  tier: RollableTier,
  family: ArchipelagoFamily,
): ArchipelagoVariant | undefined {
  const key = [worldSeed >>> 0, layoutVersion, cellX, cellZ] as const;

  if (tier === "landmark" && hash([...key, "variant"]) % 5 === 0) {
    return "mesa";
  }

  if (family !== "volcanic" || (tier !== "crag" && tier !== "landmark")) {
    return undefined;
  }

  if (hash([...key, "burn_eternal"]) % 8 === 0) {
    return "ember";
  }

  if (tier === "landmark" && hash([...key, "burn_reactive"]) % 16 === 0) {
    return "pyre";
  }

  return undefined;
}

function encodeCoordinate(value: number): string {
  return `${value < 0 ? "n" : "p"}${Math.abs(value)}`;
}

function decodeCoordinate(value: string): number | undefined {
  const magnitude = Number(value.slice(1));

  if (!Number.isSafeInteger(magnitude)) {
    return undefined;
  }

  return value.startsWith("n") ? -magnitude : magnitude;
}

function idFor(cellX: number, cellZ: number): string {
  return `${ID_PREFIX}_${encodeCoordinate(cellX)}_${encodeCoordinate(cellZ)}`;
}

function compareId(left: ArchipelagoIsland, right: ArchipelagoIsland): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function cellInBounds(cellX: number, cellZ: number): boolean {
  const cellRadius = Math.max(Math.abs(cellX), Math.abs(cellZ));

  return cellRadius !== 0 && cellRadius <= ARCHIPELAGO_CONFIG.maxCellRadius;
}

/**
 * The authored realm keeps its full `protectedRadius`; an island's own
 * clearance radius is added so a 33-block landmark cannot lean into the
 * corridor the way a flat 19-block assumption used to allow.
 */
function clearsProtectedRealm(x: number, z: number, radius: number): boolean {
  const keepOut = ARCHIPELAGO_CONFIG.protectedRadius + radius;

  return x * x + z * z >= keepOut * keepOut;
}

/** Fixed hexagonal ring; six sites per world, never zero, never seven. */
const CONTINENT_RING: readonly { cellX: number; cellZ: number }[] = [
  { cellX: 24, cellZ: 0 },
  { cellX: 12, cellZ: 21 },
  { cellX: -12, cellZ: 21 },
  { cellX: -24, cellZ: 0 },
  { cellX: -12, cellZ: -21 },
  { cellX: 12, cellZ: -21 },
];

export function archipelagoContinentSites(
  worldSeed: number,
  layoutVersion: number,
): readonly ArchipelagoContinentSite[] {
  return CONTINENT_RING.map((base, index) => {
    const random = hash([worldSeed >>> 0, layoutVersion, index, "continent"]);
    const jitter = ARCHIPELAGO_CONFIG.continentJitterCells;
    const span = jitter * 2 + 1;

    return {
      index,
      cellX: base.cellX + (random % span) - jitter,
      cellZ: base.cellZ + (Math.floor(random / span) % span) - jitter,
    };
  });
}

function continentSiteAt(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
): { site: ArchipelagoContinentSite; chebyshev: number } | undefined {
  let nearest: { site: ArchipelagoContinentSite; chebyshev: number } | undefined;

  for (const site of archipelagoContinentSites(worldSeed, layoutVersion)) {
    const chebyshev = Math.max(
      Math.abs(cellX - site.cellX),
      Math.abs(cellZ - site.cellZ),
    );

    if (
      chebyshev <= ARCHIPELAGO_CONFIG.continentSuppressionCells &&
      (nearest === undefined || chebyshev < nearest.chebyshev)
    ) {
      nearest = { site, chebyshev };
    }
  }

  return nearest;
}

const INTERIOR_LAKE_SLOTS: readonly { i: number; j: number }[] = [
  { i: 1, j: 1 },
  { i: 1, j: 2 },
  { i: 1, j: 3 },
  { i: 2, j: 1 },
  { i: 2, j: 3 },
  { i: 3, j: 1 },
  { i: 3, j: 2 },
  { i: 3, j: 3 },
];

const FILL_KIT: readonly string[] = [
  "skyknights:comp_plain",
  "skyknights:comp_plain",
  "skyknights:comp_ridge",
  "skyknights:duo_mesa",
];

/**
 * Picks two distinct indices out of `count` deterministically: the second draw
 * is taken modulo `count - 1` and then stepped past the first, so it can never
 * collide and never needs a retry loop.
 */
function distinctPair(
  first: number,
  second: number,
  count: number,
): [number, number] {
  const a = first % count;
  const b = ((second % (count - 1)) + a + 1) % count;

  return [a, b];
}

function coastRotation(i: number, j: number): ArchipelagoRotation {
  const di = i - 2;
  const dj = j - 2;

  // Grid corners are omitted, so |di| === |dj| can never happen on an edge.
  if (Math.abs(di) > Math.abs(dj)) {
    return i === 0 ? "Rotate90" : "Rotate270";
  }

  return j === 0 ? "Rotate180" : "None";
}

function rotatedProbeOffset(rotation: ArchipelagoRotation): {
  x: number;
  y: number;
  z: number;
} {
  const last = ARCHIPELAGO_CONFIG.continentComponentSize.x - 1;
  const { x, y, z } = CONTINENT_PROBE;

  if (rotation === "Rotate90") {
    return { x: last - z, y, z: x };
  }

  if (rotation === "Rotate180") {
    return { x: last - x, y, z: last - z };
  }

  if (rotation === "Rotate270") {
    return { x: z, y, z: last - x };
  }

  return { x, y, z };
}

/**
 * The 21-part layout for one continent site.
 *
 * Guarantees, by construction: exactly one central massif, at least two lakes,
 * at least one chasm, at least one land bridge, twelve coast edges, and one to
 * three mesas. Free permutation of the interior is safe because the seam
 * contract makes any interior component abut any other.
 */
function continentParts(
  worldSeed: number,
  layoutVersion: number,
  site: ArchipelagoContinentSite,
  origin: { x: number; y: number; z: number },
): readonly ArchipelagoPart[] {
  const key = [worldSeed >>> 0, layoutVersion, site.index] as const;
  const size = ARCHIPELAGO_CONFIG.continentComponentSize;
  const grid = ARCHIPELAGO_CONFIG.continentGrid;
  const interior = new Map<string, string>();

  interior.set("2,2", "skyknights:comp_ridge");

  const [lakeA, lakeB] = distinctPair(
    hash([...key, "lakeA"]),
    hash([...key, "lakeB"]),
    INTERIOR_LAKE_SLOTS.length,
  );

  interior.set(
    `${INTERIOR_LAKE_SLOTS[lakeA].i},${INTERIOR_LAKE_SLOTS[lakeA].j}`,
    "skyknights:comp_lake",
  );
  interior.set(
    `${INTERIOR_LAKE_SLOTS[lakeB].i},${INTERIOR_LAKE_SLOTS[lakeB].j}`,
    "skyknights:comp_lake",
  );

  const remaining: { i: number; j: number }[] = [];

  for (let index = 0; index < INTERIOR_LAKE_SLOTS.length; index += 1) {
    if (index !== lakeA && index !== lakeB) {
      remaining.push(INTERIOR_LAKE_SLOTS[index]);
    }
  }

  const [chasm, bridge] = distinctPair(
    hash([...key, "chasm"]),
    hash([...key, "bridge"]),
    remaining.length,
  );

  interior.set(
    `${remaining[chasm].i},${remaining[chasm].j}`,
    "skyknights:comp_chasm",
  );
  interior.set(
    `${remaining[bridge].i},${remaining[bridge].j}`,
    "skyknights:comp_bridge",
  );

  for (const slot of remaining) {
    const slotKey = `${slot.i},${slot.j}`;

    if (interior.has(slotKey)) {
      continue;
    }

    interior.set(
      slotKey,
      FILL_KIT[hash([...key, slot.i, slot.j, "fill"]) % FILL_KIT.length],
    );
  }

  const parts: ArchipelagoPart[] = [];

  // Row-major by j so every part in a grid row is contiguous; the placement
  // loop opens one ticking area per row.
  for (let j = 0; j < grid; j += 1) {
    for (let i = 0; i < grid; i += 1) {
      const corner =
        (i === 0 || i === grid - 1) && (j === 0 || j === grid - 1);

      if (ARCHIPELAGO_CONFIG.continentOmittedCorners && corner) {
        continue;
      }

      const edge = i === 0 || i === grid - 1 || j === 0 || j === grid - 1;
      const rotation: ArchipelagoRotation = edge
        ? coastRotation(i, j)
        : "None";
      const structureId = edge
        ? "skyknights:comp_coast"
        : (interior.get(`${i},${j}`) ?? "skyknights:comp_plain");

      parts.push({
        structureId,
        origin: {
          x: origin.x + i * size.x,
          y: origin.y,
          z: origin.z + j * size.z,
        },
        rotation,
        row: j,
        size: { x: size.x, y: size.y, z: size.z },
        integrityBlock: {
          offset: rotatedProbeOffset(rotation),
          typeId: CONTINENT_PALETTE.core,
        },
      });
    }
  }

  return parts;
}

function continentIsland(
  worldSeed: number,
  layoutVersion: number,
  site: ArchipelagoContinentSite,
): ArchipelagoIsland {
  const template = ARCHIPELAGO_TEMPLATES.continent;
  const x = site.cellX * ARCHIPELAGO_CONFIG.cellSize;
  const z = site.cellZ * ARCHIPELAGO_CONFIG.cellSize;
  const span = CONTINENT_BAND.maxY - CONTINENT_BAND.minY + 1;
  const y =
    CONTINENT_BAND.minY +
    (hash([worldSeed >>> 0, layoutVersion, site.index, "altitude"]) % span);
  const origin = {
    x: x - Math.floor(template.size.x / 2),
    y,
    z: z - Math.floor(template.size.z / 2),
  };

  const parts = continentParts(worldSeed, layoutVersion, site, origin);

  return {
    id: idFor(site.cellX, site.cellZ),
    // Continents are family-neutral; `verdant` is only the nominal label so the
    // shared IslandDefinition shape keeps a valid family id.
    family: "verdant",
    tier: "continent",
    cellX: site.cellX,
    cellZ: site.cellZ,
    x,
    y,
    z,
    size: template.size,
    radius: template.radius,
    heightRadius: template.heightRadius,
    band: "continent",
    dockY: template.dockY,
    structureId: parts[0].structureId,
    parts,
  };
}

export function deriveArchipelagoIsland(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
): ArchipelagoIsland | undefined {
  if (!cellInBounds(cellX, cellZ)) {
    return undefined;
  }

  const continent = continentSiteAt(worldSeed, layoutVersion, cellX, cellZ);

  if (continent !== undefined) {
    // The anchor cell carries the continent; every cell in its 5x5 suppression
    // zone is cleared so a 113-block clearance radius always has room.
    return continent.chebyshev === 0
      ? continentIsland(worldSeed, layoutVersion, continent.site)
      : undefined;
  }

  const roll = hash([worldSeed >>> 0, layoutVersion, cellX, cellZ, "present"]);

  if (roll % ARCHIPELAGO_CONFIG.generationDensity !== 0) {
    return undefined;
  }

  const tier = archipelagoTierFor(worldSeed, layoutVersion, cellX, cellZ);
  const family = familyFor(worldSeed, layoutVersion, cellX, cellZ);
  const variant = variantFor(
    worldSeed,
    layoutVersion,
    cellX,
    cellZ,
    tier,
    family,
  );
  const template =
    ARCHIPELAGO_TEMPLATES[archipelagoTemplateKey(tier, family, variant)];
  const x = cellX * ARCHIPELAGO_CONFIG.cellSize;
  const z = cellZ * ARCHIPELAGO_CONFIG.cellSize;

  if (!clearsProtectedRealm(x, z, template.radius)) {
    return undefined;
  }

  return {
    id: idFor(cellX, cellZ),
    family,
    tier,
    variant,
    cellX,
    cellZ,
    x,
    y: archipelagoAltitude(
      worldSeed,
      layoutVersion,
      cellX,
      cellZ,
      tier,
      template.size.y,
    ),
    z,
    size: template.size,
    radius: template.radius,
    heightRadius: template.heightRadius,
    band: archipelagoBandFor(worldSeed, layoutVersion, cellX, cellZ, tier).id,
    dockY: template.dockY,
    structureId: template.structureId,
  };
}

/** Structure-origin corner for an island, composed or not. */
export function archipelagoIslandOrigin(island: ArchipelagoIsland): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: island.x - Math.floor(island.size.x / 2),
    y: island.y,
    z: island.z - Math.floor(island.size.z / 2),
  };
}

/**
 * Every probe an island must satisfy, expressed relative to the island origin.
 * For a composed island this is the concatenation of its parts' probes.
 */
export function archipelagoIntegrityBlocks(
  island: ArchipelagoIsland,
): readonly ArchipelagoIntegrityBlock[] {
  if (island.parts === undefined) {
    return ARCHIPELAGO_TEMPLATES[
      archipelagoTemplateKey(island.tier, island.family, island.variant)
    ].integrityBlocks;
  }

  const origin = archipelagoIslandOrigin(island);

  return island.parts.map((part) => ({
    offset: {
      x: part.origin.x - origin.x + part.integrityBlock.offset.x,
      y: part.origin.y - origin.y + part.integrityBlock.offset.y,
      z: part.origin.z - origin.z + part.integrityBlock.offset.z,
    },
    typeId: part.integrityBlock.typeId,
  }));
}

/** How far a player must be before this island may be stamped in. */
export function archipelagoMinObserverDistance(
  island: ArchipelagoIsland,
): number {
  return Math.max(
    ARCHIPELAGO_CONFIG.minObserverDistanceFloor,
    island.radius + ARCHIPELAGO_CONFIG.minObserverClearanceBase,
  );
}

/**
 * The planner's non-intersection invariant. Two islands are safely apart when
 * their clearance cylinders miss horizontally OR their vertical extents miss.
 * Both halves scale with the ACTUAL footprint of both islands, which is what
 * lets a 33-block landmark and a 14-block islet share a neighbourhood.
 */
export function archipelagoIslandsAreClear(
  left: ArchipelagoIsland,
  right: ArchipelagoIsland,
): boolean {
  const dx = left.x - right.x;
  const dz = left.z - right.z;
  const horizontal = left.radius + right.radius + ARCHIPELAGO_CONFIG.minEdgeGap;

  if (dx * dx + dz * dz >= horizontal * horizontal) {
    return true;
  }

  const leftCenter = left.y + Math.floor(left.size.y / 2);
  const rightCenter = right.y + Math.floor(right.size.y / 2);

  return (
    Math.abs(leftCenter - rightCenter) >=
    left.heightRadius + right.heightRadius + ARCHIPELAGO_CONFIG.minEdgeGap
  );
}

/**
 * Materializes the bounded planning envelope for tooling/tests. Runtime code
 * should query nearby cells instead of iterating this complete array.
 */
export function planArchipelago(
  worldSeed: number,
  layoutVersion: number,
): readonly ArchipelagoIsland[] {
  const result: ArchipelagoIsland[] = [];

  for (
    let cellX = -ARCHIPELAGO_CONFIG.maxCellRadius;
    cellX <= ARCHIPELAGO_CONFIG.maxCellRadius;
    cellX += 1
  ) {
    for (
      let cellZ = -ARCHIPELAGO_CONFIG.maxCellRadius;
      cellZ <= ARCHIPELAGO_CONFIG.maxCellRadius;
      cellZ += 1
    ) {
      const island = deriveArchipelagoIsland(
        worldSeed,
        layoutVersion,
        cellX,
        cellZ,
      );

      if (island !== undefined) {
        result.push(island);
      }
    }
  }

  return result.sort(compareId);
}

export function parseArchipelagoIslandId(
  worldSeed: number,
  layoutVersion: number,
  id: string,
): ArchipelagoIsland | undefined {
  const match = ID_PATTERN.exec(id);

  if (match === null) {
    return undefined;
  }

  const cellX = decodeCoordinate(match[1]);
  const cellZ = decodeCoordinate(match[2]);

  if (cellX === undefined || cellZ === undefined) {
    return undefined;
  }

  const island = deriveArchipelagoIsland(
    worldSeed,
    layoutVersion,
    cellX,
    cellZ,
  );

  return island?.id === id ? island : undefined;
}

export function archipelagoIslandsWithinRadius(
  worldSeed: number,
  layoutVersion: number,
  x: number,
  z: number,
  requestedRadius: number,
): readonly ArchipelagoIsland[] {
  if (!Number.isFinite(requestedRadius) || requestedRadius < 0) {
    return [];
  }

  const radius = Math.min(
    Math.trunc(requestedRadius),
    ARCHIPELAGO_CONFIG.maxQueryRadius,
  );
  const cellRadius = Math.ceil(radius / ARCHIPELAGO_CONFIG.cellSize) + 1;
  const centerX = Math.round(x / ARCHIPELAGO_CONFIG.cellSize);
  const centerZ = Math.round(z / ARCHIPELAGO_CONFIG.cellSize);
  const result: ArchipelagoIsland[] = [];

  for (
    let cellX = centerX - cellRadius;
    cellX <= centerX + cellRadius;
    cellX += 1
  ) {
    for (
      let cellZ = centerZ - cellRadius;
      cellZ <= centerZ + cellRadius;
      cellZ += 1
    ) {
      const island = deriveArchipelagoIsland(
        worldSeed,
        layoutVersion,
        cellX,
        cellZ,
      );

      if (island === undefined) {
        continue;
      }

      const dx = island.x - x;
      const dz = island.z - z;

      if (dx * dx + dz * dz <= radius * radius) {
        result.push(island);
      }
    }
  }

  return result.sort(compareId);
}

export function archipelagoClusters(
  worldSeed: number,
  layoutVersion: number,
): readonly ArchipelagoCluster[] {
  return clusterPlan(worldSeed, layoutVersion);
}
