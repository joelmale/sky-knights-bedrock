import type {
  ArchipelagoFamily,
  ArchipelagoIntegrityBlock,
  ArchipelagoRotation,
  ArchipelagoTier,
} from "./archipelago";
import { fnv1a32 } from "../util/hash";

type SoloTier = Exclude<ArchipelagoTier, "continent">;

export interface ArchipelagoV3TemplatePart {
  structureId: string;
  relativeOrigin: { x: number; y: number; z: number };
  rotation: ArchipelagoRotation;
  row: number;
  size: { x: number; y: number; z: number };
  integrityBlock: ArchipelagoIntegrityBlock;
}

export interface ArchipelagoV3TemplateMetadata {
  key: string;
  structureId: string;
  size: { x: number; y: number; z: number };
  radius: number;
  heightRadius: number;
  observerClearance: number;
  safeDock: { x: number; y: number; z: number };
  usableTopCells: number;
  solidBlockCount: number;
  parts: readonly ArchipelagoV3TemplatePart[];
  integrityBlocks: readonly ArchipelagoIntegrityBlock[];
}

export interface ArchipelagoV3Island {
  id: string;
  index: number;
  ringIndex: number;
  family: ArchipelagoFamily;
  preferredTier: SoloTier;
  tier: SoloTier;
  templateKey: string;
  structureId: string;
  x: number;
  y: number;
  z: number;
  size: { x: number; y: number; z: number };
  radius: number;
  heightRadius: number;
  observerClearance: number;
  template: ArchipelagoV3TemplateMetadata;
}

export interface ArchipelagoV3Cluster {
  family: ArchipelagoFamily;
  x: number;
  z: number;
}

interface AltitudeBand {
  id: "deep" | "low" | "mid" | "high" | "crown";
  minY: number;
  maxY: number;
}

interface PlanCache {
  worldSeed: number;
  islands: readonly ArchipelagoV3Island[];
  byIndex: ReadonlyMap<number, ArchipelagoV3Island>;
  buckets: ReadonlyMap<string, readonly ArchipelagoV3Island[]>;
}

const FAMILIES: readonly ArchipelagoFamily[] = [
  "verdant",
  "desert",
  "tundra",
  "volcanic",
];
const SOLO_TIERS: readonly SoloTier[] = [
  "islet",
  "standard",
  "crag",
  "landmark",
];
const ID_PATTERN = /^a3_([0-9a-z]+)$/u;
const GOLDEN_ANGLE_PHASE = 0x61c88647;
const QUARTER_TURN = 0x40000000;
const CORDIC_SCALE = 2 ** 30;
const CORDIC_GAIN_INVERSE = 652032874;
const CORDIC_ANGLES = [
  536870912, 316933406, 167458907, 85004756, 42667331, 21354465, 10679838,
  5340245, 2670163, 1335087, 667544, 333772, 166886, 83443, 41722, 20861, 10430,
  5215, 2608, 1304, 652, 326, 163, 81, 41, 20, 10, 5, 3, 1, 1,
] as const;
const ALTITUDE_BANDS: Readonly<Record<AltitudeBand["id"], AltitudeBand>> = {
  deep: { id: "deep", minY: 60, maxY: 112 },
  low: { id: "low", minY: 100, maxY: 160 },
  mid: { id: "mid", minY: 150, maxY: 212 },
  high: { id: "high", minY: 205, maxY: 268 },
  crown: { id: "crown", minY: 250, maxY: 290 },
};
const BANDS_BY_TIER: Readonly<Record<SoloTier, readonly AltitudeBand["id"][]>> =
  {
    islet: ["deep", "low", "mid", "high", "crown"],
    standard: ["deep", "low", "mid", "high"],
    crag: ["low", "mid", "high", "crown"],
    landmark: ["mid", "high", "crown"],
  };
const TIER_FALLBACKS: Readonly<Record<SoloTier, readonly SoloTier[]>> = {
  islet: ["islet"],
  standard: ["standard", "islet"],
  crag: ["crag", "standard", "islet"],
  landmark: ["landmark", "crag", "standard", "islet"],
};
const TEMPLATE_SHAPES: Readonly<
  Record<
    SoloTier,
    Omit<
      ArchipelagoV3TemplateMetadata,
      "key" | "structureId" | "parts" | "integrityBlocks"
    >
  >
> = {
  islet: {
    size: { x: 25, y: 14, z: 25 },
    radius: 25,
    heightRadius: 14,
    observerClearance: 80,
    safeDock: { x: 12, y: 7, z: 12 },
    usableTopCells: 377,
    solidBlockCount: 1135,
  },
  standard: {
    size: { x: 39, y: 20, z: 39 },
    radius: 34,
    heightRadius: 17,
    observerClearance: 82,
    safeDock: { x: 19, y: 11, z: 19 },
    usableTopCells: 1009,
    solidBlockCount: 4395,
  },
  crag: {
    size: { x: 64, y: 34, z: 64 },
    radius: 53,
    heightRadius: 24,
    observerClearance: 101,
    safeDock: { x: 31, y: 19, z: 31 },
    usableTopCells: 2828,
    solidBlockCount: 19880,
  },
  landmark: {
    size: { x: 120, y: 40, z: 120 },
    radius: 92,
    heightRadius: 27,
    observerClearance: 140,
    safeDock: { x: 59, y: 20, z: 59 },
    usableTopCells: 9176,
    solidBlockCount: 64500,
  },
};

type PartRole =
  | "whole"
  | "quadrant"
  | "outer_corner"
  | "outer_left"
  | "outer_right"
  | "inner";

interface PartPlacement {
  role: PartRole;
  column: number;
  row: number;
  rotation: ArchipelagoRotation;
}

const CRAG_PARTS: readonly PartPlacement[] = [
  { role: "quadrant", column: 0, row: 0, rotation: "None" },
  { role: "quadrant", column: 1, row: 0, rotation: "Rotate90" },
  { role: "quadrant", column: 1, row: 1, rotation: "Rotate180" },
  { role: "quadrant", column: 0, row: 1, rotation: "Rotate270" },
];
const LANDMARK_PARTS: readonly PartPlacement[] = [
  { role: "outer_corner", column: 0, row: 0, rotation: "None" },
  { role: "outer_left", column: 1, row: 0, rotation: "None" },
  { role: "outer_right", column: 2, row: 0, rotation: "None" },
  { role: "outer_corner", column: 3, row: 0, rotation: "Rotate90" },
  { role: "outer_right", column: 0, row: 1, rotation: "Rotate270" },
  { role: "inner", column: 1, row: 1, rotation: "None" },
  { role: "inner", column: 2, row: 1, rotation: "Rotate90" },
  { role: "outer_left", column: 3, row: 1, rotation: "Rotate90" },
  { role: "outer_left", column: 0, row: 2, rotation: "Rotate270" },
  { role: "inner", column: 1, row: 2, rotation: "Rotate270" },
  { role: "inner", column: 2, row: 2, rotation: "Rotate180" },
  { role: "outer_right", column: 3, row: 2, rotation: "Rotate90" },
  { role: "outer_corner", column: 0, row: 3, rotation: "Rotate270" },
  { role: "outer_right", column: 1, row: 3, rotation: "Rotate180" },
  { role: "outer_left", column: 2, row: 3, rotation: "Rotate180" },
  { role: "outer_corner", column: 3, row: 3, rotation: "Rotate180" },
];

const CORE_BLOCKS: Readonly<Record<ArchipelagoFamily, string>> = {
  verdant: "minecraft:stone",
  desert: "minecraft:sandstone",
  tundra: "minecraft:stone",
  volcanic: "minecraft:blackstone",
};
const SUBSURFACE_BLOCKS: Readonly<Record<ArchipelagoFamily, string>> = {
  verdant: "minecraft:dirt",
  desert: "minecraft:red_sandstone",
  tundra: "minecraft:packed_ice",
  volcanic: "minecraft:basalt",
};
const CORNER_SURFACE_BLOCKS: Readonly<Record<ArchipelagoFamily, string>> = {
  verdant: "minecraft:moss_block",
  desert: "minecraft:smooth_sandstone",
  tundra: "minecraft:snow_block",
  volcanic: "minecraft:netherrack",
};

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

function sourceProbe(
  tier: SoloTier,
  family: ArchipelagoFamily,
  role: PartRole,
): ArchipelagoIntegrityBlock {
  if (tier === "islet") {
    return { offset: { x: 12, y: 0, z: 12 }, typeId: CORE_BLOCKS[family] };
  }
  if (tier === "standard") {
    return { offset: { x: 19, y: 0, z: 19 }, typeId: CORE_BLOCKS[family] };
  }
  if (tier === "crag") {
    return { offset: { x: 15, y: 14, z: 15 }, typeId: CORE_BLOCKS[family] };
  }
  if (role === "inner") {
    return { offset: { x: 14, y: 8, z: 14 }, typeId: CORE_BLOCKS[family] };
  }
  if (role === "outer_corner") {
    return {
      offset: { x: 18, y: 19, z: 25 },
      typeId: CORNER_SURFACE_BLOCKS[family],
    };
  }
  return {
    offset: {
      x: 14,
      y: 17,
      z: role === "outer_left" ? 15 : 14,
    },
    typeId: SUBSURFACE_BLOCKS[family],
  };
}

function partPlacements(tier: SoloTier): readonly PartPlacement[] {
  if (tier === "crag") return CRAG_PARTS;
  if (tier === "landmark") return LANDMARK_PARTS;
  return [{ role: "whole", column: 0, row: 0, rotation: "None" }];
}

function templateParts(
  tier: SoloTier,
  family: ArchipelagoFamily,
): readonly ArchipelagoV3TemplatePart[] {
  const partSize =
    tier === "crag"
      ? { x: 32, y: 34, z: 32 }
      : tier === "landmark"
        ? { x: 30, y: 40, z: 30 }
        : TEMPLATE_SHAPES[tier].size;

  return partPlacements(tier).map((placement) => {
    const integrityBlock = rotatedIntegrityBlock(
      sourceProbe(tier, family, placement.role),
      partSize,
      placement.rotation,
    );
    return {
      structureId: `skyknights:a3_${tier}_${family}_${placement.role}`,
      relativeOrigin: {
        x: placement.column * partSize.x,
        y: 0,
        z: placement.row * partSize.z,
      },
      rotation: placement.rotation,
      row: placement.row,
      size: partSize,
      integrityBlock,
    };
  });
}

export const ARCHIPELAGO_V3_FIBONACCI_RINGS = [
  13, 21, 34, 55, 89, 144, 233, 377, 610, 987,
] as const;

export const ARCHIPELAGO_V3_CONFIG = {
  idVersion: 3,
  protectedRadius: 460,
  innerSiteRadius: 600,
  outerSiteRadius: 3200,
  siteCount: 2563,
  minEdgeGap: 12,
  minObserverClearanceBase: 24,
  maxQueryRadius: 768,
  /**
   * Lifetime solo-island cap.
   *
   * 224 was inherited from the a2 contract on the stated grounds that a larger
   * count "exceeds the current 30 KB dynamic-property contract". Measurement
   * disproves that: one island costs exactly 20 bytes, so 224 spends 4,235 of
   * the 30,000-byte budget — 14%. It also froze a world after roughly 9% of
   * the plan, filling a disc of about 929 blocks and then leaving empty sky.
   *
   * 1,500 is the measured worst case against the same budget. The remaining
   * headroom is thin, which is why `docs/design/CONTINENT_TERRAIN.md`-style
   * compact storage is the next step: a bitset over the 2,563-site index space
   * is 448 bytes flat and would retire this cap entirely.
   */
  maxGeneratedIslands: 1500,
  bucketSize: 256,
  absoluteMinY: 60,
  absoluteMaxTopY: 314,
} as const;

const templateEntries: Record<string, ArchipelagoV3TemplateMetadata> = {};

for (const tier of SOLO_TIERS) {
  for (const family of FAMILIES) {
    const key = `${tier}_${family}`;
    const parts = templateParts(tier, family);
    templateEntries[key] = {
      key,
      structureId: parts[0].structureId,
      parts,
      integrityBlocks: parts.map((part) => ({
        offset: {
          x: part.relativeOrigin.x + part.integrityBlock.offset.x,
          y: part.relativeOrigin.y + part.integrityBlock.offset.y,
          z: part.relativeOrigin.z + part.integrityBlock.offset.z,
        },
        typeId: part.integrityBlock.typeId,
      })),
      ...TEMPLATE_SHAPES[tier],
    };
  }
}

export const ARCHIPELAGO_V3_TEMPLATES: Readonly<
  Record<string, ArchipelagoV3TemplateMetadata>
> = Object.freeze(templateEntries);

const structureIds = new Set<string>();

for (const key of Object.keys(ARCHIPELAGO_V3_TEMPLATES)) {
  for (const part of ARCHIPELAGO_V3_TEMPLATES[key].parts) {
    structureIds.add(part.structureId);
  }
}

export const ARCHIPELAGO_V3_STRUCTURE_IDS: readonly string[] = [
  ...structureIds,
].sort();

let planCache: PlanCache | undefined;

function hash(values: readonly (string | number)[]): number {
  return fnv1a32(values.map(String).join("\0")) >>> 0;
}

function integerSquareRoot(value: number): number {
  if (value <= 0) return 0;
  let estimate = value;
  let next = Math.floor((estimate + 1) / 2);

  while (next < estimate) {
    estimate = next;
    next = Math.floor((estimate + Math.floor(value / estimate)) / 2);
  }

  return estimate;
}

function directionForPhase(phase: number): { x: number; z: number } {
  const quadrant = phase >>> 30;
  let x = CORDIC_GAIN_INVERSE;
  let z = 0;
  let remaining = phase & (QUARTER_TURN - 1);

  for (let index = 0; index < CORDIC_ANGLES.length; index += 1) {
    const direction = remaining >= 0 ? 1 : -1;
    const divisor = 2 ** index;
    const nextX = x - direction * Math.trunc(z / divisor);
    const nextZ = z + direction * Math.trunc(x / divisor);
    remaining -= direction * CORDIC_ANGLES[index];
    x = nextX;
    z = nextZ;
  }

  if (quadrant === 1) return { x: -z, z: x };
  if (quadrant === 2) return { x: -x, z: -z };
  if (quadrant === 3) return { x: z, z: -x };
  return { x, z };
}

function siteRadius(index: number): number {
  const innerSquared =
    ARCHIPELAGO_V3_CONFIG.innerSiteRadius *
    ARCHIPELAGO_V3_CONFIG.innerSiteRadius;
  const radialSpanSquared =
    ARCHIPELAGO_V3_CONFIG.outerSiteRadius ** 2 -
    ARCHIPELAGO_V3_CONFIG.innerSiteRadius ** 2;
  const numerator = (index * 2 + 1) * radialSpanSquared;
  const denominator = ARCHIPELAGO_V3_CONFIG.siteCount * 2;
  return integerSquareRoot(innerSquared + Math.floor(numerator / denominator));
}

function seedPhase(worldSeed: number, salt: string): number {
  const upper = hash([worldSeed >>> 0, ARCHIPELAGO_V3_CONFIG.idVersion, salt]);
  const lower = hash([
    worldSeed >>> 0,
    ARCHIPELAGO_V3_CONFIG.idVersion,
    salt,
    "low",
  ]);
  return (upper * 0x10000 + (lower & 0xffff)) >>> 0;
}

function siteLocation(
  worldSeed: number,
  index: number,
): { x: number; z: number } {
  const phase =
    (seedPhase(worldSeed, "site_rotation") +
      Math.imul(index, GOLDEN_ANGLE_PHASE)) >>>
    0;
  const direction = directionForPhase(phase);
  const radius = siteRadius(index);
  return {
    x: Math.round((radius * direction.x) / CORDIC_SCALE),
    z: Math.round((radius * direction.z) / CORDIC_SCALE),
  };
}

function ringIndexForSite(index: number): number {
  let boundary = 0;

  for (
    let ringIndex = 0;
    ringIndex < ARCHIPELAGO_V3_FIBONACCI_RINGS.length;
    ringIndex += 1
  ) {
    boundary += ARCHIPELAGO_V3_FIBONACCI_RINGS[ringIndex];
    if (index < boundary) return ringIndex;
  }

  return ARCHIPELAGO_V3_FIBONACCI_RINGS.length - 1;
}

function preferredTierFor(worldSeed: number, index: number): SoloTier {
  const roll =
    hash([worldSeed >>> 0, ARCHIPELAGO_V3_CONFIG.idVersion, index, "tier"]) %
    1000;
  if (roll < 150) return "islet";
  if (roll < 700) return "standard";
  if (roll < 950) return "crag";
  return "landmark";
}

function familyClusters(worldSeed: number): readonly ArchipelagoV3Cluster[] {
  const rotation = seedPhase(worldSeed, "family_clusters");
  const clusters: ArchipelagoV3Cluster[] = [];

  for (let index = 0; index < 8; index += 1) {
    const phase = (rotation + index * 0x20000000) >>> 0;
    const direction = directionForPhase(phase);
    const radius = index < 4 ? 1350 : 2250;
    clusters.push({
      family: FAMILIES[index % FAMILIES.length],
      x: Math.round((radius * direction.x) / CORDIC_SCALE),
      z: Math.round((radius * direction.z) / CORDIC_SCALE),
    });
  }

  return clusters;
}

function familyFor(
  clusters: readonly ArchipelagoV3Cluster[],
  x: number,
  z: number,
): ArchipelagoFamily {
  let selected = clusters[0];
  let selectedDistance = Number.POSITIVE_INFINITY;

  for (const cluster of clusters) {
    const dx = x - cluster.x;
    const dz = z - cluster.z;
    const distance = dx * dx + dz * dz;

    if (distance < selectedDistance) {
      selected = cluster;
      selectedDistance = distance;
    }
  }

  return selected.family;
}

function templateFor(
  tier: SoloTier,
  family: ArchipelagoFamily,
): ArchipelagoV3TemplateMetadata {
  return ARCHIPELAGO_V3_TEMPLATES[`${tier}_${family}`];
}

function altitudeCandidates(
  worldSeed: number,
  index: number,
  tier: SoloTier,
  sizeY: number,
): readonly number[] {
  const bands = BANDS_BY_TIER[tier];
  const rotation =
    hash([
      worldSeed >>> 0,
      ARCHIPELAGO_V3_CONFIG.idVersion,
      index,
      tier,
      "band_order",
    ]) % bands.length;
  const candidates: number[] = [];

  for (let offset = 0; offset < bands.length; offset += 1) {
    const band = ALTITUDE_BANDS[bands[(rotation + offset) % bands.length]];
    const floor = Math.max(band.minY, ARCHIPELAGO_V3_CONFIG.absoluteMinY);
    const ceiling = Math.min(
      band.maxY,
      ARCHIPELAGO_V3_CONFIG.absoluteMaxTopY - sizeY + 1,
    );
    const span = ceiling - floor + 1;

    if (span <= 0) continue;
    candidates.push(
      floor +
        (hash([
          worldSeed >>> 0,
          ARCHIPELAGO_V3_CONFIG.idVersion,
          index,
          tier,
          band.id,
          "altitude",
        ]) %
          span),
    );
  }

  return candidates;
}

function bucketCoordinate(value: number): number {
  return Math.floor(value / ARCHIPELAGO_V3_CONFIG.bucketSize);
}

function bucketKey(bucketX: number, bucketZ: number): string {
  return `${bucketX},${bucketZ}`;
}

function nearbyIslands(
  buckets: ReadonlyMap<string, readonly ArchipelagoV3Island[]>,
  x: number,
  z: number,
  radius: number,
): readonly ArchipelagoV3Island[] {
  const minBucketX = bucketCoordinate(x - radius);
  const maxBucketX = bucketCoordinate(x + radius);
  const minBucketZ = bucketCoordinate(z - radius);
  const maxBucketZ = bucketCoordinate(z + radius);
  const result: ArchipelagoV3Island[] = [];

  for (let bucketX = minBucketX; bucketX <= maxBucketX; bucketX += 1) {
    for (let bucketZ = minBucketZ; bucketZ <= maxBucketZ; bucketZ += 1) {
      const entries = buckets.get(bucketKey(bucketX, bucketZ));
      if (entries !== undefined) result.push(...entries);
    }
  }

  return result;
}

function overlaps(
  x: number,
  y: number,
  z: number,
  template: ArchipelagoV3TemplateMetadata,
  other: ArchipelagoV3Island,
): boolean {
  const dx = x - other.x;
  const dz = z - other.z;
  const horizontalRequired =
    template.radius + other.radius + ARCHIPELAGO_V3_CONFIG.minEdgeGap;
  const horizontalClear =
    dx * dx + dz * dz >= horizontalRequired * horizontalRequired;
  const centerY = y + Math.floor(template.size.y / 2);
  const otherCenterY = other.y + Math.floor(other.size.y / 2);
  const verticalClear =
    Math.abs(centerY - otherCenterY) >=
    template.heightRadius +
      other.heightRadius +
      ARCHIPELAGO_V3_CONFIG.minEdgeGap;
  return !horizontalClear && !verticalClear;
}

function canonicalId(index: number): string {
  return `a3_${index.toString(36)}`;
}

function buildPlan(worldSeed: number): PlanCache {
  const normalizedSeed = worldSeed >>> 0;
  const clusters = familyClusters(normalizedSeed);
  const accepted: ArchipelagoV3Island[] = [];
  const buckets = new Map<string, ArchipelagoV3Island[]>();
  const byIndex = new Map<number, ArchipelagoV3Island>();
  const maximumConflictRadius =
    TEMPLATE_SHAPES.landmark.radius * 2 + ARCHIPELAGO_V3_CONFIG.minEdgeGap;

  for (let index = 0; index < ARCHIPELAGO_V3_CONFIG.siteCount; index += 1) {
    const { x, z } = siteLocation(normalizedSeed, index);
    const preferredTier = preferredTierFor(normalizedSeed, index);
    const family = familyFor(clusters, x, z);
    const neighbors = nearbyIslands(buckets, x, z, maximumConflictRadius);
    let island: ArchipelagoV3Island | undefined;

    for (const tier of TIER_FALLBACKS[preferredTier]) {
      const template = templateFor(tier, family);
      const radialDistanceSquared = x * x + z * z;
      const protectedClearance =
        ARCHIPELAGO_V3_CONFIG.protectedRadius + template.radius;

      if (radialDistanceSquared < protectedClearance * protectedClearance) {
        continue;
      }

      for (const y of altitudeCandidates(
        normalizedSeed,
        index,
        tier,
        template.size.y,
      )) {
        if (neighbors.some((other) => overlaps(x, y, z, template, other))) {
          continue;
        }

        island = {
          id: canonicalId(index),
          index,
          ringIndex: ringIndexForSite(index),
          family,
          preferredTier,
          tier,
          templateKey: template.key,
          structureId: template.structureId,
          x,
          y,
          z,
          size: template.size,
          radius: template.radius,
          heightRadius: template.heightRadius,
          observerClearance: template.observerClearance,
          template,
        };
        break;
      }

      if (island !== undefined) break;
    }

    if (island === undefined) continue;
    accepted.push(island);
    byIndex.set(index, island);
    const key = bucketKey(bucketCoordinate(x), bucketCoordinate(z));
    const bucket = buckets.get(key);
    if (bucket === undefined) {
      buckets.set(key, [island]);
    } else {
      bucket.push(island);
    }
  }

  return {
    worldSeed: normalizedSeed,
    islands: accepted,
    byIndex,
    buckets,
  };
}

function cachedPlan(worldSeed: number): PlanCache {
  const normalizedSeed = worldSeed >>> 0;

  if (planCache?.worldSeed !== normalizedSeed) {
    planCache = buildPlan(normalizedSeed);
  }

  return planCache;
}

export function planArchipelagoV3(
  worldSeed: number,
): readonly ArchipelagoV3Island[] {
  return cachedPlan(worldSeed).islands;
}

export function parseArchipelagoV3IslandId(
  worldSeed: number,
  id: string,
): ArchipelagoV3Island | undefined {
  const match = ID_PATTERN.exec(id);
  if (match === null) return undefined;
  const index = Number.parseInt(match[1], 36);

  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= ARCHIPELAGO_V3_CONFIG.siteCount ||
    canonicalId(index) !== id
  ) {
    return undefined;
  }

  return cachedPlan(worldSeed).byIndex.get(index);
}

export function archipelagoV3IslandsWithinRadius(
  worldSeed: number,
  x: number,
  z: number,
  requestedRadius: number,
): readonly ArchipelagoV3Island[] {
  if (!Number.isFinite(requestedRadius) || requestedRadius < 0) return [];
  const radius = Math.min(
    Math.trunc(requestedRadius),
    ARCHIPELAGO_V3_CONFIG.maxQueryRadius,
  );
  const result = nearbyIslands(cachedPlan(worldSeed).buckets, x, z, radius)
    .filter((island) => {
      const dx = island.x - x;
      const dz = island.z - z;
      return dx * dx + dz * dz <= radius * radius;
    })
    .sort((left, right) => left.index - right.index);
  return result;
}

export function archipelagoV3Clusters(
  worldSeed: number,
): readonly ArchipelagoV3Cluster[] {
  return familyClusters(worldSeed >>> 0);
}
