import { fnv1a32 } from "../util/hash";

export type ArchipelagoFamily = "verdant" | "desert" | "tundra" | "volcanic";
export type ArchipelagoTier =
  "islet" | "standard" | "crag" | "landmark" | "continent";
export type ArchipelagoVariant = "ember" | "pyre" | "mesa";
export type ArchipelagoRotation =
  "None" | "Rotate90" | "Rotate180" | "Rotate270";

export interface ArchipelagoIntegrityBlock {
  offset: { x: number; y: number; z: number };
  typeId: string;
}

export interface ArchipelagoTemplate {
  structureId: string;
  size: { x: number; y: number; z: number };
  radius: number;
  heightRadius: number;
  /** Local feet position with two verified clear blocks above it. */
  safeDock: { x: number; y: number; z: number };
  integrityBlocks: readonly ArchipelagoIntegrityBlock[];
}

export interface ArchipelagoPart {
  structureId: string;
  origin: { x: number; y: number; z: number };
  rotation: ArchipelagoRotation;
  row: number;
  /** Probe offset after the part rotation is applied at `origin`. */
  integrityBlock: ArchipelagoIntegrityBlock;
  /** The exact unrotated probe exported by the component structure module. */
  sourceIntegrityBlock: ArchipelagoIntegrityBlock;
}

export interface ArchipelagoIsland {
  id: string;
  /** Continents deliberately use the family-neutral "continent" palette. */
  family: ArchipelagoFamily | "continent";
  tier: ArchipelagoTier;
  variant?: ArchipelagoVariant;
  cellX: number;
  cellZ: number;
  /** Horizontal center of the resolved placement footprint. */
  x: number;
  /** Bottom of the resolved structure or continent component grid. */
  y: number;
  /** Horizontal center of the resolved placement footprint. */
  z: number;
  size: { x: number; y: number; z: number };
  radius: number;
  heightRadius: number;
  observerClearance: number;
  /** The exact template consumed by single-placement runtime jobs. */
  template: ArchipelagoTemplate;
  /** Present only for the 21-part continent placement contract. */
  parts?: readonly ArchipelagoPart[];
}

export interface ArchipelagoCluster {
  family: ArchipelagoFamily;
  cellX: number;
  cellZ: number;
}

interface AltitudeBand {
  id: "deep" | "low" | "mid" | "high" | "crown";
  minY: number;
  maxY: number;
}

interface TierBandWeight {
  band: AltitudeBand["id"];
  max: number;
}

const FAMILIES: readonly ArchipelagoFamily[] = [
  "verdant",
  "desert",
  "tundra",
  "volcanic",
];

const ID_PATTERN = /^a2_([np]\d+)_([np]\d+)$/u;
const COMPONENT_SIZE = { x: 30, y: 40, z: 30 } as const;
const CONTINENT_SIZE = { x: 150, y: 40, z: 150 } as const;
const COMPONENT_SAFE_DOCKS = {
  comp_coast: { x: 14, y: 21, z: 14 },
  comp_plain: { x: 14, y: 21, z: 15 },
  comp_lake: { x: 15, y: 21, z: 19 },
  comp_ridge: { x: 15, y: 21, z: 22 },
  comp_chasm: { x: 18, y: 21, z: 12 },
  comp_bridge: { x: 18, y: 21, z: 14 },
  duo_mesa: { x: 15, y: 21, z: 23 },
} as const;
const CONTINENT_RING = [
  { cellX: 24, cellZ: 0 },
  { cellX: 12, cellZ: 21 },
  { cellX: -12, cellZ: 21 },
  { cellX: -24, cellZ: 0 },
  { cellX: -12, cellZ: -21 },
  { cellX: 12, cellZ: -21 },
] as const;
const OMITTED_CONTINENT_CORNERS = new Set(["0,0", "0,4", "4,0", "4,4"]);
const LAKE_SLOTS = [
  { column: 1, row: 1 },
  { column: 1, row: 2 },
  { column: 1, row: 3 },
  { column: 2, row: 1 },
  { column: 2, row: 3 },
  { column: 3, row: 1 },
  { column: 3, row: 2 },
  { column: 3, row: 3 },
] as const;

export const ARCHIPELAGO_CONFIG = {
  /** a1 terrain stays on disk; a2 is a new, independently-derived plan. */
  idVersion: 2,
  maxCellRadius: 28,
  protectedRadius: 460,
  cellSize: 96,
  minEdgeGap: 12,
  maxQueryRadius: 512,
  minObserverClearanceBase: 24,
  maxGeneratedIslands: 224,
  maxGeneratedContinents: 2,
  generationDensity: 3,
  absoluteMinY: 60,
  absoluteMaxTopY: 314,
  continentRingCellRadius: 24,
  continentSiteCount: 6,
  continentJitterCells: 2,
  continentSuppressionCells: 2,
  continentGrid: 5,
  continentComponentSize: COMPONENT_SIZE,
  continentOmittedCorners: true,
} as const;

export const ALTITUDE_BANDS: readonly AltitudeBand[] = [
  { id: "deep", minY: 60, maxY: 112 },
  { id: "low", minY: 100, maxY: 160 },
  { id: "mid", minY: 150, maxY: 212 },
  { id: "high", minY: 205, maxY: 268 },
  { id: "crown", minY: 250, maxY: 290 },
];

export const TIER_ROLL_BUCKETS: readonly {
  tier: Exclude<ArchipelagoTier, "continent">;
  max: number;
}[] = [
  { tier: "islet", max: 349 },
  { tier: "standard", max: 799 },
  { tier: "crag", max: 959 },
  { tier: "landmark", max: 999 },
];

export const TIER_BAND_WEIGHTS: Readonly<
  Record<Exclude<ArchipelagoTier, "continent">, readonly TierBandWeight[]>
> = {
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

function probes(
  coordinates: readonly (readonly [number, number, number])[],
  typeIds: readonly string[],
): readonly ArchipelagoIntegrityBlock[] {
  return coordinates.map(([x, y, z], index) => ({
    offset: { x, y, z },
    typeId: typeIds[index],
  }));
}

function template(
  structureId: string,
  size: { x: number; y: number; z: number },
  radius: number,
  heightRadius: number,
  safeDock: { x: number; y: number; z: number },
  integrityBlocks: readonly ArchipelagoIntegrityBlock[],
): ArchipelagoTemplate {
  return {
    structureId,
    size,
    radius,
    heightRadius,
    safeDock,
    integrityBlocks,
  };
}

const ISLET_PROBES = [
  [5, 0, 4],
  [2, 3, 4],
  [8, 3, 4],
  [5, 3, 2],
  [5, 3, 6],
] as const;
const STANDARD_PROBES = [
  [7, 0, 6],
  [1, 5, 6],
  [13, 5, 6],
  [7, 5, 1],
  [7, 5, 11],
] as const;
const CRAG_PROBES = [
  [11, 0, 10],
  [3, 9, 10],
  [19, 9, 10],
  [11, 9, 4],
  [11, 9, 16],
] as const;
const LANDMARK_PROBES = [
  [19, 0, 17],
  [6, 14, 17],
  [32, 14, 17],
  [19, 14, 5],
  [19, 14, 29],
] as const;
const COMPONENT_PROBES = [
  [4, 13, 4],
  [25, 13, 4],
  [4, 13, 25],
  [25, 13, 25],
  [14, 13, 14],
] as const;
const CHASM_COMPONENT_PROBES = [
  [4, 13, 4],
  [25, 13, 4],
  [4, 13, 25],
  [25, 13, 25],
  [5, 13, 14],
] as const;
const COAST_COMPONENT_PROBES = [
  [4, 13, 14],
  [25, 13, 14],
  [14, 13, 25],
  [9, 13, 20],
  [20, 13, 20],
] as const;

const CORE_BY_FAMILY: Readonly<Record<ArchipelagoFamily, string>> = {
  verdant: "minecraft:stone",
  desert: "minecraft:sandstone",
  tundra: "minecraft:stone",
  volcanic: "minecraft:blackstone",
};
const ISLET_SURFACE_BY_FAMILY: Readonly<Record<ArchipelagoFamily, string>> = {
  verdant: "minecraft:grass_block",
  desert: "minecraft:sand",
  tundra: "minecraft:snow_block",
  volcanic: "minecraft:netherrack",
};
const STANDARD_SURFACE_BY_FAMILY: Readonly<Record<ArchipelagoFamily, string>> =
  {
    verdant: "minecraft:grass_block",
    desert: "minecraft:red_sand",
    tundra: "minecraft:snow_block",
    volcanic: "minecraft:netherrack",
  };

const all = (value: string): readonly string[] => [
  value,
  value,
  value,
  value,
  value,
];
const templateEntries: Record<string, ArchipelagoTemplate> = {};

for (const family of FAMILIES) {
  templateEntries[`islet_${family}`] = template(
    `skyknights:islet_${family}`,
    { x: 11, y: 8, z: 9 },
    14,
    8,
    { x: 5, y: 4, z: 4 },
    probes(ISLET_PROBES, [
      CORE_BY_FAMILY[family],
      ...all(ISLET_SURFACE_BY_FAMILY[family]).slice(1),
    ]),
  );
  templateEntries[`standard_${family}`] = template(
    `skyknights:ambient_${family}`,
    { x: 15, y: 10, z: 13 },
    16,
    9,
    { x: 7, y: 6, z: 5 },
    probes(STANDARD_PROBES, [
      CORE_BY_FAMILY[family],
      ...all(STANDARD_SURFACE_BY_FAMILY[family]).slice(1),
    ]),
  );
  templateEntries[`crag_${family}`] = template(
    `skyknights:crag_${family}`,
    { x: 23, y: 18, z: 21 },
    22,
    13,
    { x: 10, y: 10, z: 4 },
    probes(CRAG_PROBES, [
      CORE_BY_FAMILY[family],
      ...all(ISLET_SURFACE_BY_FAMILY[family]).slice(1),
    ]),
  );
  templateEntries[`landmark_${family}`] = template(
    `skyknights:landmark_${family}`,
    { x: 39, y: 30, z: 35 },
    33,
    19,
    { x: 6, y: 15, z: 15 },
    probes(LANDMARK_PROBES, [
      CORE_BY_FAMILY[family],
      ...all(ISLET_SURFACE_BY_FAMILY[family]).slice(1),
    ]),
  );
}

templateEntries.crag_verdant = template(
  "skyknights:crag_verdant",
  { x: 23, y: 18, z: 21 },
  22,
  13,
  { x: 10, y: 10, z: 4 },
  probes(CRAG_PROBES, [
    "minecraft:stone",
    "minecraft:moss_block",
    "minecraft:grass_block",
    "minecraft:grass_block",
    "minecraft:grass_block",
  ]),
);
templateEntries.landmark_desert = template(
  "skyknights:landmark_desert",
  { x: 39, y: 30, z: 35 },
  33,
  19,
  { x: 6, y: 15, z: 15 },
  probes(
    [
      [19, 0, 17],
      [6, 13, 25],
      [32, 13, 17],
      [19, 13, 5],
      [19, 13, 26],
    ],
    all("minecraft:sandstone"),
  ),
);
templateEntries.landmark_tundra = template(
  "skyknights:landmark_tundra",
  { x: 39, y: 30, z: 35 },
  33,
  19,
  { x: 6, y: 15, z: 15 },
  probes(LANDMARK_PROBES, [
    "minecraft:stone",
    "minecraft:snow_block",
    "minecraft:cobblestone",
    "minecraft:snow_block",
    "minecraft:snow_block",
  ]),
);
templateEntries.crag_volcanic_ember = template(
  "skyknights:crag_volcanic_ember",
  { x: 23, y: 18, z: 21 },
  22,
  13,
  { x: 10, y: 10, z: 4 },
  probes(CRAG_PROBES, [
    "minecraft:blackstone",
    "minecraft:basalt",
    "minecraft:basalt",
    "minecraft:basalt",
    "minecraft:basalt",
  ]),
);
templateEntries.landmark_volcanic_ember = template(
  "skyknights:landmark_volcanic_ember",
  { x: 39, y: 30, z: 35 },
  33,
  19,
  { x: 6, y: 15, z: 15 },
  probes(
    [
      [19, 0, 17],
      [19, 13, 17],
      [26, 13, 10],
      [12, 13, 29],
      [19, 13, 31],
    ],
    [
      "minecraft:blackstone",
      "minecraft:basalt",
      "minecraft:basalt",
      "minecraft:basalt",
      "minecraft:basalt",
    ],
  ),
);
templateEntries.landmark_volcanic_pyre = template(
  "skyknights:landmark_volcanic_pyre",
  { x: 39, y: 30, z: 35 },
  33,
  19,
  { x: 6, y: 15, z: 15 },
  probes(
    [
      [19, 0, 17],
      [19, 8, 17],
      [10, 10, 17],
      [28, 10, 17],
      [19, 10, 26],
    ],
    all("minecraft:blackstone"),
  ),
);
templateEntries.duo_mesa = template(
  "skyknights:duo_mesa",
  COMPONENT_SIZE,
  28,
  24,
  COMPONENT_SAFE_DOCKS.duo_mesa,
  probes(COMPONENT_PROBES, all("minecraft:stone")),
);
templateEntries.comp_coast = template(
  "skyknights:comp_coast",
  COMPONENT_SIZE,
  113,
  26,
  COMPONENT_SAFE_DOCKS.comp_coast,
  probes(COAST_COMPONENT_PROBES, all("minecraft:stone")),
);
for (const key of ["comp_plain", "comp_lake", "comp_ridge"] as const) {
  templateEntries[key] = template(
    `skyknights:${key}`,
    COMPONENT_SIZE,
    113,
    26,
    COMPONENT_SAFE_DOCKS[key],
    probes(COMPONENT_PROBES, all("minecraft:stone")),
  );
}
templateEntries.comp_chasm = template(
  "skyknights:comp_chasm",
  COMPONENT_SIZE,
  113,
  26,
  COMPONENT_SAFE_DOCKS.comp_chasm,
  probes(CHASM_COMPONENT_PROBES, all("minecraft:stone")),
);
templateEntries.comp_bridge = template(
  "skyknights:comp_bridge",
  COMPONENT_SIZE,
  113,
  26,
  COMPONENT_SAFE_DOCKS.comp_bridge,
  probes(CHASM_COMPONENT_PROBES, all("minecraft:stone")),
);
templateEntries.continent = template(
  "skyknights:comp_coast",
  CONTINENT_SIZE,
  113,
  26,
  { x: 75, y: 21, z: 82 },
  templateEntries.comp_coast.integrityBlocks,
);

/**
 * Compatibility aliases keep a1-era callers compiling until they move to the
 * resolved island template. They deliberately point only at frozen standards.
 */
for (const family of FAMILIES) {
  templateEntries[family] = templateEntries[`standard_${family}`];
}

export const ARCHIPELAGO_TEMPLATES: Readonly<
  Record<string, ArchipelagoTemplate>
> = Object.freeze(templateEntries);

export const ARCHIPELAGO_STRUCTURE_IDS: readonly string[] = [
  "skyknights:islet_verdant",
  "skyknights:islet_desert",
  "skyknights:islet_tundra",
  "skyknights:islet_volcanic",
  "skyknights:ambient_verdant",
  "skyknights:ambient_desert",
  "skyknights:ambient_tundra",
  "skyknights:ambient_volcanic",
  "skyknights:crag_verdant",
  "skyknights:crag_desert",
  "skyknights:crag_tundra",
  "skyknights:crag_volcanic",
  "skyknights:crag_volcanic_ember",
  "skyknights:landmark_verdant",
  "skyknights:landmark_desert",
  "skyknights:landmark_tundra",
  "skyknights:landmark_volcanic",
  "skyknights:landmark_volcanic_ember",
  "skyknights:landmark_volcanic_pyre",
  "skyknights:comp_coast",
  "skyknights:comp_plain",
  "skyknights:comp_lake",
  "skyknights:comp_ridge",
  "skyknights:comp_chasm",
  "skyknights:comp_bridge",
  "skyknights:duo_mesa",
];

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
  return `a2_${encodeCoordinate(cellX)}_${encodeCoordinate(cellZ)}`;
}

function compareId(left: ArchipelagoIsland, right: ArchipelagoIsland): number {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function withinPlanBounds(cellX: number, cellZ: number): boolean {
  return (
    Math.max(Math.abs(cellX), Math.abs(cellZ)) <=
    ARCHIPELAGO_CONFIG.maxCellRadius
  );
}

function outsideProtectedSpace(cellX: number, cellZ: number): boolean {
  const x = cellX * ARCHIPELAGO_CONFIG.cellSize;
  const z = cellZ * ARCHIPELAGO_CONFIG.cellSize;
  return x * x + z * z >= ARCHIPELAGO_CONFIG.protectedRadius ** 2;
}

export function archipelagoContinentAnchors(
  worldSeed: number,
  layoutVersion: number,
): readonly { siteIndex: number; cellX: number; cellZ: number }[] {
  return CONTINENT_RING.map((base, siteIndex) => {
    const random = hash([
      worldSeed >>> 0,
      layoutVersion,
      siteIndex,
      "continent",
    ]);
    return {
      siteIndex,
      cellX:
        base.cellX + (random % 5) - ARCHIPELAGO_CONFIG.continentJitterCells,
      cellZ:
        base.cellZ +
        (Math.floor(random / 5) % 5) -
        ARCHIPELAGO_CONFIG.continentJitterCells,
    };
  });
}

function continentAnchorAt(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
) {
  return archipelagoContinentAnchors(worldSeed, layoutVersion).find(
    (anchor) => anchor.cellX === cellX && anchor.cellZ === cellZ,
  );
}

function suppressedByContinent(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
): boolean {
  return archipelagoContinentAnchors(worldSeed, layoutVersion).some(
    (anchor) =>
      Math.max(
        Math.abs(cellX - anchor.cellX),
        Math.abs(cellZ - anchor.cellZ),
      ) <= ARCHIPELAGO_CONFIG.continentSuppressionCells,
  );
}

export function tierFor(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
): Exclude<ArchipelagoTier, "continent"> {
  const roll =
    hash([worldSeed >>> 0, layoutVersion, cellX, cellZ, "tier"]) % 1000;
  return (
    TIER_ROLL_BUCKETS.find((bucket) => roll <= bucket.max)?.tier ?? "landmark"
  );
}

export function bandFor(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
  tier: Exclude<ArchipelagoTier, "continent">,
): AltitudeBand {
  const roll =
    hash([worldSeed >>> 0, layoutVersion, cellX, cellZ, "band"]) % 100;
  const selected = TIER_BAND_WEIGHTS[tier].find((weight) => roll <= weight.max);
  const bandId = selected?.band ?? "crown";
  return (
    ALTITUDE_BANDS.find((band) => band.id === bandId) ??
    ALTITUDE_BANDS[ALTITUDE_BANDS.length - 1]
  );
}

/** Integer-only altitude selection with a locally coherent ridge drift. */
export function archipelagoAltitude(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
  tier: Exclude<ArchipelagoTier, "continent">,
  sizeY: number,
): number {
  const band = bandFor(worldSeed, layoutVersion, cellX, cellZ, tier);
  const span = band.maxY - band.minY + 1;
  const coarse =
    hash([worldSeed >>> 0, layoutVersion, cellX, cellZ, "altitude"]) % span;
  const ridge = ((((cellX * 7 + cellZ * 13) % 9) + 9) % 9) - 4;
  const ceiling = Math.min(
    band.maxY,
    ARCHIPELAGO_CONFIG.absoluteMaxTopY - sizeY + 1,
  );
  const floor = Math.max(band.minY, ARCHIPELAGO_CONFIG.absoluteMinY);
  return Math.min(ceiling, Math.max(floor, band.minY + coarse + ridge));
}

function resolvedTemplateKey(
  tier: Exclude<ArchipelagoTier, "continent">,
  family: ArchipelagoFamily,
  variant?: ArchipelagoVariant,
): string {
  if (variant === "ember") {
    return `${tier}_volcanic_ember`;
  }
  if (variant === "pyre") {
    return "landmark_volcanic_pyre";
  }
  if (variant === "mesa") {
    return "duo_mesa";
  }
  return `${tier}_${family}`;
}

function variantFor(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
  tier: Exclude<ArchipelagoTier, "continent">,
  family: ArchipelagoFamily,
): ArchipelagoVariant | undefined {
  if (
    tier === "landmark" &&
    hash([worldSeed >>> 0, layoutVersion, cellX, cellZ, "variant"]) % 5 === 0
  ) {
    return "mesa";
  }
  if (family !== "volcanic" || (tier !== "crag" && tier !== "landmark")) {
    return undefined;
  }
  if (
    hash([worldSeed >>> 0, layoutVersion, cellX, cellZ, "burn_eternal"]) % 8 ===
    0
  ) {
    return "ember";
  }
  if (
    tier === "landmark" &&
    hash([worldSeed >>> 0, layoutVersion, cellX, cellZ, "burn_reactive"]) %
      16 ===
      0
  ) {
    return "pyre";
  }
  return undefined;
}

export function archipelagoTemplateForIsland(
  island: ArchipelagoIsland,
): ArchipelagoTemplate {
  return island.template;
}

function continentRotation(column: number, row: number): ArchipelagoRotation {
  if (row === 0) return "Rotate180";
  if (row === 4) return "None";
  if (column === 0) return "Rotate90";
  return "Rotate270";
}

function rotatedIntegrityBlock(
  integrityBlock: ArchipelagoIntegrityBlock,
  size: { x: number; y: number; z: number },
  rotation: ArchipelagoRotation,
): ArchipelagoIntegrityBlock {
  const { x, y, z } = integrityBlock.offset;

  if (rotation === "Rotate90") {
    return {
      offset: { x: size.z - 1 - z, y, z: x },
      typeId: integrityBlock.typeId,
    };
  }
  if (rotation === "Rotate180") {
    return {
      offset: { x: size.x - 1 - x, y, z: size.z - 1 - z },
      typeId: integrityBlock.typeId,
    };
  }
  if (rotation === "Rotate270") {
    return {
      offset: { x: z, y, z: size.x - 1 - x },
      typeId: integrityBlock.typeId,
    };
  }
  return integrityBlock;
}

function takeDistinct<T>(
  values: readonly T[],
  key: readonly (string | number)[],
): [T, readonly T[]] {
  const index = hash(key) % values.length;
  return [
    values[index],
    [...values.slice(0, index), ...values.slice(index + 1)],
  ];
}

function continentParts(
  worldSeed: number,
  layoutVersion: number,
  siteIndex: number,
  x: number,
  y: number,
  z: number,
): readonly ArchipelagoPart[] {
  const [lakeA] = takeDistinct(LAKE_SLOTS, [
    worldSeed >>> 0,
    layoutVersion,
    siteIndex,
    "lakeA",
  ]);
  const lakeAIndex = LAKE_SLOTS.findIndex((slot) => slot === lakeA);
  const lakeBIndex =
    ((hash([worldSeed >>> 0, layoutVersion, siteIndex, "lakeB"]) % 7) +
      lakeAIndex +
      1) %
    8;
  const lakeB = LAKE_SLOTS[lakeBIndex];
  const lakeKeys = new Set([
    `${lakeA.column},${lakeA.row}`,
    `${lakeB.column},${lakeB.row}`,
  ]);
  const remaining = LAKE_SLOTS.filter(
    (slot) => !lakeKeys.has(`${slot.column},${slot.row}`),
  );
  const [chasm, afterChasm] = takeDistinct(remaining, [
    worldSeed >>> 0,
    layoutVersion,
    siteIndex,
    "chasm",
  ]);
  const [bridge] = takeDistinct(afterChasm, [
    worldSeed >>> 0,
    layoutVersion,
    siteIndex,
    "bridge",
  ]);
  const forced = new Map<string, string>([
    ["2,2", "comp_ridge"],
    [`${lakeA.column},${lakeA.row}`, "comp_lake"],
    [`${lakeB.column},${lakeB.row}`, "comp_lake"],
    [`${chasm.column},${chasm.row}`, "comp_chasm"],
    [`${bridge.column},${bridge.row}`, "comp_bridge"],
  ]);
  const fillKit = [
    "comp_plain",
    "comp_plain",
    "comp_ridge",
    "duo_mesa",
  ] as const;
  const parts: ArchipelagoPart[] = [];

  for (let row = 0; row < ARCHIPELAGO_CONFIG.continentGrid; row += 1) {
    for (
      let column = 0;
      column < ARCHIPELAGO_CONFIG.continentGrid;
      column += 1
    ) {
      if (OMITTED_CONTINENT_CORNERS.has(`${column},${row}`)) continue;
      const edge = Math.max(Math.abs(column - 2), Math.abs(row - 2)) === 2;
      const key = edge
        ? "comp_coast"
        : (forced.get(`${column},${row}`) ??
          fillKit[
            hash([
              worldSeed >>> 0,
              layoutVersion,
              siteIndex,
              column,
              row,
              "fill",
            ]) % fillKit.length
          ]);
      const component = ARCHIPELAGO_TEMPLATES[key];
      const rotation = edge ? continentRotation(column, row) : "None";
      const sourceIntegrityBlock = component.integrityBlocks[0];
      parts.push({
        structureId: component.structureId,
        origin: {
          x: x - 75 + column * COMPONENT_SIZE.x,
          y,
          z: z - 75 + row * COMPONENT_SIZE.z,
        },
        rotation,
        row,
        integrityBlock: rotatedIntegrityBlock(
          sourceIntegrityBlock,
          component.size,
          rotation,
        ),
        sourceIntegrityBlock,
      });
    }
  }

  return parts;
}

function continentIsland(
  worldSeed: number,
  layoutVersion: number,
  siteIndex: number,
  cellX: number,
  cellZ: number,
): ArchipelagoIsland {
  const x = cellX * ARCHIPELAGO_CONFIG.cellSize;
  const z = cellZ * ARCHIPELAGO_CONFIG.cellSize;
  const y =
    96 + (hash([worldSeed >>> 0, layoutVersion, siteIndex, "altitude"]) % 33);
  const parts = continentParts(worldSeed, layoutVersion, siteIndex, x, y, z);
  return {
    id: idFor(cellX, cellZ),
    family: "continent",
    tier: "continent",
    cellX,
    cellZ,
    x,
    y,
    z,
    size: CONTINENT_SIZE,
    radius: 113,
    heightRadius: 26,
    observerClearance: 137,
    template: ARCHIPELAGO_TEMPLATES.continent,
    parts,
  };
}

export function deriveArchipelagoIsland(
  worldSeed: number,
  layoutVersion: number,
  cellX: number,
  cellZ: number,
): ArchipelagoIsland | undefined {
  if (!withinPlanBounds(cellX, cellZ) || (cellX === 0 && cellZ === 0))
    return undefined;
  const anchor = continentAnchorAt(worldSeed, layoutVersion, cellX, cellZ);
  if (anchor !== undefined)
    return continentIsland(
      worldSeed,
      layoutVersion,
      anchor.siteIndex,
      cellX,
      cellZ,
    );
  if (
    !outsideProtectedSpace(cellX, cellZ) ||
    suppressedByContinent(worldSeed, layoutVersion, cellX, cellZ)
  )
    return undefined;
  if (
    hash([worldSeed >>> 0, layoutVersion, cellX, cellZ, "present"]) %
      ARCHIPELAGO_CONFIG.generationDensity !==
    0
  )
    return undefined;

  const family = familyFor(worldSeed, layoutVersion, cellX, cellZ);
  const tier = tierFor(worldSeed, layoutVersion, cellX, cellZ);
  const variant = variantFor(
    worldSeed,
    layoutVersion,
    cellX,
    cellZ,
    tier,
    family,
  );
  const resolvedTemplate =
    ARCHIPELAGO_TEMPLATES[resolvedTemplateKey(tier, family, variant)];
  const x = cellX * ARCHIPELAGO_CONFIG.cellSize;
  const z = cellZ * ARCHIPELAGO_CONFIG.cellSize;

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
      resolvedTemplate.size.y,
    ),
    z,
    size: resolvedTemplate.size,
    radius: resolvedTemplate.radius,
    heightRadius: resolvedTemplate.heightRadius,
    observerClearance: Math.max(
      48,
      resolvedTemplate.radius + ARCHIPELAGO_CONFIG.minObserverClearanceBase,
    ),
    template: resolvedTemplate,
  };
}

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
      if (island !== undefined) result.push(island);
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
  if (match === null) return undefined;
  const cellX = decodeCoordinate(match[1]);
  const cellZ = decodeCoordinate(match[2]);
  if (cellX === undefined || cellZ === undefined) return undefined;
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
  if (!Number.isFinite(requestedRadius) || requestedRadius < 0) return [];
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
      if (island === undefined) continue;
      const dx = island.x - x;
      const dz = island.z - z;
      if (dx * dx + dz * dz <= radius * radius) result.push(island);
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
