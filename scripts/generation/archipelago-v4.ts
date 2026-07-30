import type { ArchipelagoFamily, ArchipelagoTier } from "./archipelago";
import {
  ARCHIPELAGO_CONFIG as ARCHIPELAGO_V2_CONFIG,
  archipelagoContinentAnchors,
  deriveArchipelagoIsland,
} from "./archipelago";
import {
  ARCHIPELAGO_V3_TEMPLATES,
  type ArchipelagoV3TemplateMetadata,
} from "./archipelago-v3";
import { CONTINENT_DEFAULT_SPAN } from "./continent-field";
import { fnv1a32 } from "../util/hash";

type SoloTier = Exclude<ArchipelagoTier, "continent">;

export interface ArchipelagoV4Island {
  id: string;
  index: number;
  clusterIndex: number;
  memberIndex: number;
  ringIndex: number;
  deck: number;
  clusterOffset: number;
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

export interface ArchipelagoV4Cluster {
  index: number;
  ringIndex: number;
  ringSlot: number;
  deck: number;
  family: ArchipelagoFamily;
  x: number;
  z: number;
  anchorTier: SoloTier;
  vigor: number;
  reservedByContinent: boolean;
}

interface ClusterCandidate {
  deck: number;
  localIndex: number;
  x: number;
  z: number;
  radius: number;
}

interface MemberSite {
  x: number;
  z: number;
  offset: number;
  preferredTier: SoloTier;
  present: boolean;
}

interface PlanCache {
  worldSeed: number;
  clusters: readonly ArchipelagoV4Cluster[];
  islands: readonly ArchipelagoV4Island[];
  byIndex: ReadonlyMap<number, ArchipelagoV4Island>;
  buckets: ReadonlyMap<string, readonly ArchipelagoV4Island[]>;
}

const FAMILIES: readonly ArchipelagoFamily[] = [
  "verdant",
  "desert",
  "tundra",
  "volcanic",
];
const ID_PATTERN = /^a4_([0-9a-z]+)$/u;
const GOLDEN_ANGLE_PHASE = 0x61c88647;
const FULL_TURN = 0x100000000;
const QUARTER_TURN = 0x40000000;
const CORDIC_SCALE = 2 ** 30;
const CORDIC_GAIN_INVERSE = 652032874;
const CORDIC_ANGLES = [
  536870912, 316933406, 167458907, 85004756, 42667331, 21354465, 10679838,
  5340245, 2670163, 1335087, 667544, 333772, 166886, 83443, 41722, 20861, 10430,
  5215, 2608, 1304, 652, 326, 163, 81, 41, 20, 10, 5, 3, 1, 1,
] as const;
const TIER_FALLBACKS: Readonly<Record<SoloTier, readonly SoloTier[]>> = {
  islet: ["islet"],
  standard: ["standard", "islet"],
  crag: ["crag", "standard", "islet"],
  landmark: ["landmark", "crag", "standard", "islet"],
};

/**
 * Fibonacci cohorts remain a readable radial progression, but cluster centres
 * are area-uniform within their decks instead of being forced onto narrow
 * circles. Narrow rings caused adjacent cohorts to merge into continuous
 * belts. The ten cohorts still contain exactly 374 cluster centres.
 */
export const ARCHIPELAGO_V4_FIBONACCI_RINGS = [
  2, 3, 5, 8, 13, 21, 34, 55, 89, 144,
] as const;

export const ARCHIPELAGO_V4_DECK_CENTER_Y = [80, 152, 224, 295] as const;

const CLUSTER_COUNT = ARCHIPELAGO_V4_FIBONACCI_RINGS.reduce(
  (total, count) => total + count,
  0,
);
const SITES_PER_CLUSTER = 5;
const INNER_CLUSTER_RADIUS = 720;
const OUTER_CLUSTER_RADIUS = 3438;
const MIN_CLUSTER_CENTER_GAP = 560;
const MAX_CLUSTER_REACH = 260;
const SATELLITE_PRESENCE = [900, 800, 650, 500] as const;
const VIGOR_MIN = 850;
const VIGOR_SPAN = 301;
const CONTINENT_MIN_CLAIM = 2;
const CONTINENT_MAX_CLAIM = 5;
const CONTINENT_TERRITORY_RADIUS = 900;

export const ARCHIPELAGO_V4_CONFIG = {
  idVersion: 4,
  protectedRadius: 460,
  innerClusterRadius: INNER_CLUSTER_RADIUS,
  outerClusterRadius: OUTER_CLUSTER_RADIUS,
  outerSiteRadius: OUTER_CLUSTER_RADIUS + MAX_CLUSTER_REACH,
  clusterCount: CLUSTER_COUNT,
  sitesPerCluster: SITES_PER_CLUSTER,
  deckCount: ARCHIPELAGO_V4_DECK_CENTER_Y.length,
  siteCount: CLUSTER_COUNT * SITES_PER_CLUSTER,
  minClusterCenterGap: MIN_CLUSTER_CENTER_GAP,
  maxClusterReach: MAX_CLUSTER_REACH,
  minEdgeGap: 12,
  minObserverClearanceBase: 24,
  maxQueryRadius: 768,
  maxGeneratedIslands: CLUSTER_COUNT * SITES_PER_CLUSTER,
  bucketSize: 256,
  absoluteMinY: 60,
  absoluteMaxTopY: 314,
} as const;

let planCache: PlanCache | undefined;

function hash(values: readonly (string | number)[]): number {
  return fnv1a32(values.map(String).join("\0")) >>> 0;
}

function siteHash(
  worldSeed: number,
  values: readonly (string | number)[],
): number {
  return hash([worldSeed >>> 0, ARCHIPELAGO_V4_CONFIG.idVersion, ...values]);
}

function idiv(numerator: number, denominator: number): number {
  return Math.floor(numerator / denominator);
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

function seedPhase(worldSeed: number, salt: string): number {
  const upper = siteHash(worldSeed, [salt, "upper"]);
  const lower = siteHash(worldSeed, [salt, "lower"]);
  return (upper * 0x10000 + (lower & 0xffff)) >>> 0;
}

function deckClusterCount(deck: number): number {
  const base = Math.floor(CLUSTER_COUNT / ARCHIPELAGO_V4_DECK_CENTER_Y.length);
  return (
    base + (deck < CLUSTER_COUNT % ARCHIPELAGO_V4_DECK_CENTER_Y.length ? 1 : 0)
  );
}

function clusterRadius(localIndex: number, count: number): number {
  const innerSquared = INNER_CLUSTER_RADIUS * INNER_CLUSTER_RADIUS;
  const radialSpanSquared =
    OUTER_CLUSTER_RADIUS * OUTER_CLUSTER_RADIUS - innerSquared;
  const numerator = (localIndex * 2 + 1) * radialSpanSquared;
  const denominator = count * 2;
  return integerSquareRoot(innerSquared + Math.floor(numerator / denominator));
}

function ringForClusterIndex(index: number): {
  ringIndex: number;
  ringSlot: number;
} {
  let boundary = 0;

  for (
    let cohort = 0;
    cohort < ARCHIPELAGO_V4_FIBONACCI_RINGS.length;
    cohort += 1
  ) {
    const count = ARCHIPELAGO_V4_FIBONACCI_RINGS[cohort];
    if (index < boundary + count) {
      return { ringIndex: cohort + 2, ringSlot: index - boundary };
    }
    boundary += count;
  }

  return {
    ringIndex: ARCHIPELAGO_V4_FIBONACCI_RINGS.length + 1,
    ringSlot:
      index -
      (CLUSTER_COUNT -
        ARCHIPELAGO_V4_FIBONACCI_RINGS[
          ARCHIPELAGO_V4_FIBONACCI_RINGS.length - 1
        ]),
  };
}

function anchorTierFor(worldSeed: number, clusterIndex: number): SoloTier {
  const roll = siteHash(worldSeed, [clusterIndex, "anchor_tier"]) % 1000;
  if (roll < 100) return "islet";
  if (roll < 650) return "standard";
  if (roll < 950) return "crag";
  return "landmark";
}

function satelliteTierFor(
  worldSeed: number,
  clusterIndex: number,
  memberIndex: number,
): Exclude<SoloTier, "landmark"> {
  const roll =
    siteHash(worldSeed, [clusterIndex, memberIndex, "satellite_tier"]) % 1000;
  if (roll < 300) return "islet";
  if (roll < 850) return "standard";
  return "crag";
}

function deriveClusterCandidates(worldSeed: number): ClusterCandidate[] {
  const candidates: ClusterCandidate[] = [];

  for (let deck = 0; deck < ARCHIPELAGO_V4_DECK_CENTER_Y.length; deck += 1) {
    const count = deckClusterCount(deck);
    const rotation = seedPhase(worldSeed, `deck_${deck}_rotation`);

    for (let localIndex = 0; localIndex < count; localIndex += 1) {
      const radius = clusterRadius(localIndex, count);
      const phase =
        (rotation + Math.imul(localIndex, GOLDEN_ANGLE_PHASE)) >>> 0;
      const direction = directionForPhase(phase);
      candidates.push({
        deck,
        localIndex,
        x: Math.round((radius * direction.x) / CORDIC_SCALE),
        z: Math.round((radius * direction.z) / CORDIC_SCALE),
        radius,
      });
    }
  }

  return candidates.sort(
    (left, right) =>
      left.radius - right.radius ||
      left.deck - right.deck ||
      left.localIndex - right.localIndex,
  );
}

function plannedContinents(worldSeed: number) {
  return archipelagoContinentAnchors(worldSeed, ARCHIPELAGO_V2_CONFIG.idVersion)
    .map((anchor) =>
      deriveArchipelagoIsland(
        worldSeed,
        ARCHIPELAGO_V2_CONFIG.idVersion,
        anchor.cellX,
        anchor.cellZ,
      ),
    )
    .filter((island) => island?.tier === "continent");
}

function applyContinentTerritory(
  worldSeed: number,
  clusters: ArchipelagoV4Cluster[],
): void {
  for (const continent of plannedContinents(worldSeed)) {
    if (continent === undefined) continue;
    const claimCount =
      CONTINENT_MIN_CLAIM +
      (siteHash(worldSeed, [continent.id, "continent_claim"]) %
        (CONTINENT_MAX_CLAIM - CONTINENT_MIN_CLAIM + 1));
    const ranked = clusters
      .map((cluster) => {
        const dx = cluster.x - continent.x;
        const dz = cluster.z - continent.z;
        return {
          cluster,
          distanceSquared: dx * dx + dz * dz,
        };
      })
      .sort(
        (left, right) =>
          left.distanceSquared - right.distanceSquared ||
          left.cluster.index - right.cluster.index,
      );
    const formulaContinentRadius = Math.floor(CONTINENT_DEFAULT_SPAN / 2);
    const geometricClearance =
      Math.max(continent.radius, formulaContinentRadius) +
      ARCHIPELAGO_V4_CONFIG.maxClusterReach +
      ARCHIPELAGO_V4_CONFIG.minEdgeGap;

    for (let rank = 0; rank < ranked.length; rank += 1) {
      const entry = ranked[rank];
      if (
        rank < claimCount ||
        (entry.distanceSquared <= CONTINENT_TERRITORY_RADIUS ** 2 &&
          entry.distanceSquared < geometricClearance * geometricClearance)
      ) {
        entry.cluster.reservedByContinent = true;
      }
    }
  }
}

function deriveClusters(worldSeed: number): ArchipelagoV4Cluster[] {
  const clusters = deriveClusterCandidates(worldSeed).map(
    (candidate, index): ArchipelagoV4Cluster => {
      const ring = ringForClusterIndex(index);
      return {
        index,
        ...ring,
        deck: candidate.deck,
        family:
          FAMILIES[
            siteHash(worldSeed, [index, "cluster_family"]) % FAMILIES.length
          ],
        x: candidate.x,
        z: candidate.z,
        anchorTier: anchorTierFor(worldSeed, index),
        vigor: VIGOR_MIN + (siteHash(worldSeed, [index, "vigor"]) % VIGOR_SPAN),
        reservedByContinent: false,
      };
    },
  );
  applyContinentTerritory(worldSeed, clusters);
  return clusters;
}

function templateFor(
  tier: SoloTier,
  family: ArchipelagoFamily,
): ArchipelagoV3TemplateMetadata {
  return ARCHIPELAGO_V3_TEMPLATES[`${tier}_${family}`];
}

function memberSite(
  worldSeed: number,
  cluster: ArchipelagoV4Cluster,
  memberIndex: number,
): MemberSite {
  if (memberIndex === 0) {
    return {
      x: cluster.x,
      z: cluster.z,
      offset: 0,
      preferredTier: cluster.anchorTier,
      present: true,
    };
  }

  const preferredTier = satelliteTierFor(worldSeed, cluster.index, memberIndex);
  const anchorRadius = templateFor(cluster.anchorTier, cluster.family).radius;
  const satelliteRadius = templateFor(preferredTier, cluster.family).radius;
  // Satellite distance is a FRACTION of the combined radii, not a sum plus a
  // gap. The additive form guaranteed a floor of both radii plus at least 24
  // blocks, so two islands in one cluster could never touch however the cluster
  // was tuned - and MAX_CLUSTER_REACH never entered this calculation at all,
  // which is why shrinking it did nothing.
  //
  // Alternating shells at 7/10 and 11/10 of the combined radii give a cluster
  // where some members genuinely intersect the anchor and some sit just clear
  // of it. Overlap is intended: terrain is written with an air-only fill filter,
  // so two intersecting islands merge into the union of their terrain instead of
  // one erasing the other, and the same filter is what keeps generation from
  // ever overwriting a player build or a placed continent.
  const shellNumerator = memberIndex % 2 === 0 ? 11 : 7;
  const distance =
    idiv((anchorRadius + satelliteRadius) * shellNumerator, 10) +
    (siteHash(worldSeed, [cluster.index, memberIndex, "member_distance"]) % 7);
  const phaseJitter =
    (siteHash(worldSeed, [cluster.index, memberIndex, "member_phase"]) %
      Math.floor(FULL_TURN / 48)) -
    Math.floor(FULL_TURN / 96);
  const phase =
    (seedPhase(worldSeed, `cluster_${cluster.index}_members`) +
      Math.imul(memberIndex - 1, QUARTER_TURN) +
      phaseJitter) >>>
    0;
  const direction = directionForPhase(phase);
  const x = Math.round((distance * direction.x) / CORDIC_SCALE);
  const z = Math.round((distance * direction.z) / CORDIC_SCALE);
  const threshold = Math.min(
    1000,
    Math.floor((SATELLITE_PRESENCE[memberIndex - 1] * cluster.vigor) / 1000),
  );

  return {
    x: cluster.x + x,
    z: cluster.z + z,
    offset: integerSquareRoot(x * x + z * z),
    preferredTier,
    present:
      siteHash(worldSeed, [cluster.index, memberIndex, "presence"]) % 1000 <
      threshold,
  };
}

function bottomYFor(tier: SoloTier, deck: number): number {
  const template = templateFor(tier, "verdant");
  const centerY = ARCHIPELAGO_V4_DECK_CENTER_Y[deck];
  return centerY - Math.floor(template.size.y / 2);
}

function bucketCoordinate(value: number): number {
  return Math.floor(value / ARCHIPELAGO_V4_CONFIG.bucketSize);
}

function bucketKey(bucketX: number, bucketZ: number): string {
  return `${bucketX},${bucketZ}`;
}

function nearbyIslands(
  buckets: ReadonlyMap<string, readonly ArchipelagoV4Island[]>,
  x: number,
  z: number,
): readonly ArchipelagoV4Island[] {
  const result: ArchipelagoV4Island[] = [];
  const bucketX = bucketCoordinate(x);
  const bucketZ = bucketCoordinate(z);

  for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
    for (let offsetZ = -1; offsetZ <= 1; offsetZ += 1) {
      result.push(
        ...(buckets.get(bucketKey(bucketX + offsetX, bucketZ + offsetZ)) ?? []),
      );
    }
  }

  return result;
}

function overlaps(
  candidate: Pick<
    ArchipelagoV4Island,
    "x" | "y" | "z" | "size" | "radius" | "heightRadius"
  >,
  other: ArchipelagoV4Island,
): boolean {
  const dx = candidate.x - other.x;
  const dz = candidate.z - other.z;
  // Islands may intersect. What is rejected is a near-coincident duplicate,
  // which adds overdraw rather than silhouette. Three tenths of the combined
  // radii keeps a genuine merge and drops a redundant site.
  const duplicateDistance = idiv((candidate.radius + other.radius) * 3, 10);

  if (dx * dx + dz * dz >= duplicateDistance * duplicateDistance) {
    return false;
  }

  const candidateCenterY = candidate.y + Math.floor(candidate.size.y / 2);
  const otherCenterY = other.y + Math.floor(other.size.y / 2);
  return (
    Math.abs(candidateCenterY - otherCenterY) <
    idiv((candidate.heightRadius + other.heightRadius) * 3, 10)
  );
}

function canonicalId(index: number): string {
  return `a4_${index.toString(36)}`;
}

function buildPlan(worldSeed: number): PlanCache {
  const normalizedSeed = worldSeed >>> 0;
  const clusters = deriveClusters(normalizedSeed);
  const islands: ArchipelagoV4Island[] = [];
  const byIndex = new Map<number, ArchipelagoV4Island>();
  const mutableBuckets = new Map<string, ArchipelagoV4Island[]>();

  for (const cluster of clusters) {
    if (cluster.reservedByContinent) continue;

    for (
      let memberIndex = 0;
      memberIndex < ARCHIPELAGO_V4_CONFIG.sitesPerCluster;
      memberIndex += 1
    ) {
      const index =
        cluster.index * ARCHIPELAGO_V4_CONFIG.sitesPerCluster + memberIndex;
      const site = memberSite(normalizedSeed, cluster, memberIndex);

      if (!site.present) continue;

      for (const tier of TIER_FALLBACKS[site.preferredTier]) {
        const template = templateFor(tier, cluster.family);
        const radialDistance = integerSquareRoot(
          site.x * site.x + site.z * site.z,
        );

        if (
          radialDistance - template.radius <
            ARCHIPELAGO_V4_CONFIG.protectedRadius ||
          radialDistance + template.radius >
            ARCHIPELAGO_V4_CONFIG.outerSiteRadius
        ) {
          continue;
        }

        const y = bottomYFor(tier, cluster.deck);
        const candidate: ArchipelagoV4Island = {
          id: canonicalId(index),
          index,
          clusterIndex: cluster.index,
          memberIndex,
          ringIndex: cluster.ringIndex,
          deck: cluster.deck,
          clusterOffset: site.offset,
          family: cluster.family,
          preferredTier: site.preferredTier,
          tier,
          templateKey: template.key,
          structureId: template.structureId,
          x: site.x,
          y,
          z: site.z,
          size: template.size,
          radius: template.radius,
          heightRadius: template.heightRadius,
          observerClearance: Math.max(
            template.observerClearance,
            template.radius + ARCHIPELAGO_V4_CONFIG.minObserverClearanceBase,
          ),
          template,
        };

        if (
          nearbyIslands(mutableBuckets, candidate.x, candidate.z).some(
            (other) => overlaps(candidate, other),
          )
        ) {
          continue;
        }

        islands.push(candidate);
        byIndex.set(index, candidate);
        const key = bucketKey(
          bucketCoordinate(candidate.x),
          bucketCoordinate(candidate.z),
        );
        const bucket = mutableBuckets.get(key) ?? [];
        bucket.push(candidate);
        mutableBuckets.set(key, bucket);
        break;
      }
    }
  }

  const buckets = new Map<string, readonly ArchipelagoV4Island[]>();
  for (const [key, bucket] of mutableBuckets) {
    buckets.set(key, Object.freeze([...bucket]));
  }

  return {
    worldSeed: normalizedSeed,
    clusters: Object.freeze(clusters.map((cluster) => ({ ...cluster }))),
    islands: Object.freeze(islands),
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

export function planArchipelagoV4(
  worldSeed: number,
): readonly ArchipelagoV4Island[] {
  return cachedPlan(worldSeed).islands;
}

export function parseArchipelagoV4IslandId(
  worldSeed: number,
  id: string,
): ArchipelagoV4Island | undefined {
  const match = ID_PATTERN.exec(id);
  if (match === null) return undefined;

  const index = Number.parseInt(match[1], 36);
  if (
    !Number.isSafeInteger(index) ||
    index < 0 ||
    index >= ARCHIPELAGO_V4_CONFIG.siteCount ||
    index.toString(36) !== match[1]
  ) {
    return undefined;
  }

  return cachedPlan(worldSeed).byIndex.get(index);
}

export function archipelagoV4IslandsWithinRadius(
  worldSeed: number,
  x: number,
  z: number,
  requestedRadius: number,
): readonly ArchipelagoV4Island[] {
  if (!Number.isFinite(requestedRadius) || requestedRadius < 0) return [];
  const radius = Math.min(
    Math.trunc(requestedRadius),
    ARCHIPELAGO_V4_CONFIG.maxQueryRadius,
  );
  const radiusSquared = radius * radius;
  const bucketRadius = Math.ceil(radius / ARCHIPELAGO_V4_CONFIG.bucketSize);
  const centerBucketX = bucketCoordinate(x);
  const centerBucketZ = bucketCoordinate(z);
  const result: ArchipelagoV4Island[] = [];
  const buckets = cachedPlan(worldSeed).buckets;

  for (let offsetX = -bucketRadius; offsetX <= bucketRadius; offsetX += 1) {
    for (let offsetZ = -bucketRadius; offsetZ <= bucketRadius; offsetZ += 1) {
      for (const island of buckets.get(
        bucketKey(centerBucketX + offsetX, centerBucketZ + offsetZ),
      ) ?? []) {
        const dx = island.x - x;
        const dz = island.z - z;
        if (dx * dx + dz * dz <= radiusSquared) {
          result.push(island);
        }
      }
    }
  }

  return result.sort((left, right) => left.index - right.index);
}

export function archipelagoV4Clusters(
  worldSeed: number,
): readonly ArchipelagoV4Cluster[] {
  return cachedPlan(worldSeed).clusters;
}

export function archipelagoV4CapCoversPlan(): boolean {
  return (
    ARCHIPELAGO_V4_CONFIG.maxGeneratedIslands >= ARCHIPELAGO_V4_CONFIG.siteCount
  );
}
