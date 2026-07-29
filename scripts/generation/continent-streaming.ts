/**
 * Host-side streaming contract for formula continents.
 *
 * `c1_<siteIndex>` is deliberately a new namespace. It never reads or
 * reinterprets a2/a3/a4 state: callers explicitly identify legacy a2 continent
 * sites that already exist, and those sites are suppressed from this formula
 * stream. The six possible formula centres are otherwise exactly the legacy
 * a2 continent anchors.
 *
 * Progress is a fixed bitset over the conservative chunk bounds of one
 * continent. A set bit means the whole chunk task has completed, including an
 * empty chunk task. This permits a runtime to resume safely without asking the
 * field to rediscover partial column work.
 */

import { ARCHIPELAGO_CONFIG, archipelagoContinentAnchors } from "./archipelago";
import {
  CONTINENT_MAX_SPAN,
  CONTINENT_MAX_WORLD_COORDINATE,
  CONTINENT_MIN_SPAN,
  createContinentField,
  type ContinentField,
} from "./continent-field";
import {
  chunkBlockCeiling,
  continentChunkBounds,
  planContinentChunk,
  type ContinentChunkPlan,
  type ContinentFillVolume,
} from "./continent-chunk-plan";

export const CONTINENT_STREAMING_NAMESPACE = "c1";
export const CONTINENT_STREAMING_SITE_COUNT =
  ARCHIPELAGO_CONFIG.continentSiteCount;
export const CONTINENT_FILL_BLOCK_CAP = 32_768;

const CONTINENT_STREAMING_ID = /^c1_([0-9]+)$/u;
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export interface ContinentStreamingObserver {
  readonly x: number;
  readonly z: number;
}

export interface ContinentStreamingOptions {
  /** The a2 layout version that owns the six persisted legacy anchor sites. */
  readonly legacyLayoutVersion: number;
  /**
   * a2 continent site indexes already present in this world. Formula terrain
   * for these sites is intentionally omitted rather than replacing it.
   */
  readonly existingLegacySiteIndices?: readonly number[];
  /** Passed through to the terrain field; its documented range is 600-1800. */
  readonly span?: number;
}

export interface ContinentStreamingChunkBounds {
  readonly minChunkX: number;
  readonly minChunkZ: number;
  readonly maxChunkX: number;
  readonly maxChunkZ: number;
  readonly width: number;
  readonly height: number;
  readonly count: number;
}

export interface ContinentStreamingSite {
  readonly id: string;
  readonly siteIndex: number;
  readonly field: ContinentField;
  readonly chunkBounds: ContinentStreamingChunkBounds;
  /** Exact, fixed byte length required by this site's progress encoding. */
  readonly chunkBitsetBytes: number;
}

export interface ContinentStreamingChunkTask {
  readonly continentId: string;
  readonly siteIndex: number;
  readonly chunkIndex: number;
  readonly chunkX: number;
  readonly chunkZ: number;
  /** The exact per-chunk geometry to apply with fillBlocks calls. */
  readonly plan: ContinentChunkPlan;
  readonly volumes: readonly ContinentFillVolume[];
}

function requireSafeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
  return value;
}

function requireWorldCoordinate(value: number, label: string): number {
  const integer = requireSafeInteger(value, label);
  if (
    integer < -CONTINENT_MAX_WORLD_COORDINATE ||
    integer > CONTINENT_MAX_WORLD_COORDINATE
  ) {
    throw new RangeError(`${label} must be a safe Minecraft world coordinate`);
  }
  return integer;
}

function requireFiniteWorldCoordinate(value: number, label: string): number {
  if (
    !Number.isFinite(value) ||
    value < -CONTINENT_MAX_WORLD_COORDINATE ||
    value > CONTINENT_MAX_WORLD_COORDINATE
  ) {
    throw new RangeError(
      `${label} must be a finite Minecraft world coordinate`,
    );
  }
  return value;
}

function requireSiteIndex(siteIndex: number): number {
  const index = requireSafeInteger(siteIndex, "siteIndex");
  if (index < 0 || index >= CONTINENT_STREAMING_SITE_COUNT) {
    throw new RangeError("siteIndex is outside the six legacy continent sites");
  }
  return index;
}

function requireSeed(worldSeed: number): number {
  const seed = requireSafeInteger(worldSeed, "worldSeed");
  if (seed < 0 || seed > 0xffff_ffff) {
    throw new RangeError("worldSeed must be an unsigned 32-bit integer");
  }
  return seed;
}

function requireLayoutVersion(layoutVersion: number): number {
  const version = requireSafeInteger(layoutVersion, "legacyLayoutVersion");
  if (version < 0)
    throw new RangeError("legacyLayoutVersion must not be negative");
  return version;
}

function requireSpan(span: number | undefined): number | undefined {
  if (span === undefined) return undefined;
  const value = requireSafeInteger(span, "span");
  if (
    value < CONTINENT_MIN_SPAN ||
    value > CONTINENT_MAX_SPAN ||
    (value & 1) !== 0
  ) {
    throw new RangeError(
      `span must be an even integer from ${CONTINENT_MIN_SPAN} to ${CONTINENT_MAX_SPAN}`,
    );
  }
  return value;
}

function requireBitset(site: ContinentStreamingSite, bitset: Uint8Array): void {
  if (
    !(bitset instanceof Uint8Array) ||
    bitset.length !== site.chunkBitsetBytes
  ) {
    throw new RangeError("chunk bitset does not match the site's fixed bounds");
  }

  const remainder = site.chunkBounds.count & 7;
  if (remainder !== 0 && bitset.length > 0) {
    const unusedMask = (0xff << remainder) & 0xff;
    if ((bitset[bitset.length - 1] & unusedMask) !== 0) {
      throw new RangeError(
        "chunk bitset has set bits outside the fixed bounds",
      );
    }
  }
}

function requireChunkIndex(
  site: ContinentStreamingSite,
  chunkIndex: number,
): number {
  const index = requireSafeInteger(chunkIndex, "chunkIndex");
  if (index < 0 || index >= site.chunkBounds.count) {
    throw new RangeError("chunkIndex is outside the continent's fixed bounds");
  }
  return index;
}

function bitIsSet(bitset: Uint8Array, index: number): boolean {
  return (bitset[index >> 3] & (1 << (index & 7))) !== 0;
}

function chunkCoordinates(
  site: ContinentStreamingSite,
  chunkIndex: number,
): { chunkX: number; chunkZ: number } {
  const row = Math.floor(chunkIndex / site.chunkBounds.width);
  return {
    chunkX: site.chunkBounds.minChunkX + (chunkIndex % site.chunkBounds.width),
    chunkZ: site.chunkBounds.minChunkZ + row,
  };
}

function base64Value(character: string): number {
  return BASE64_ALPHABET.indexOf(character);
}

/** Canonical namespace ID for a formula continent site. */
export function continentStreamingId(siteIndex: number): string {
  return `${CONTINENT_STREAMING_NAMESPACE}_${requireSiteIndex(siteIndex)}`;
}

/** Parses only canonical c1 IDs; a2/a3/a4 identifiers always fail closed. */
export function parseContinentStreamingId(id: string): number | undefined {
  const match = CONTINENT_STREAMING_ID.exec(id);
  if (match === null) return undefined;
  const siteIndex = Number.parseInt(match[1], 10);
  if (
    !Number.isSafeInteger(siteIndex) ||
    siteIndex < 0 ||
    siteIndex >= CONTINENT_STREAMING_SITE_COUNT ||
    `${CONTINENT_STREAMING_NAMESPACE}_${siteIndex}` !== id
  ) {
    return undefined;
  }
  return siteIndex;
}

/**
 * Derives the formula sites from the existing six a2 anchors only. Existing a2
 * continent sites are suppressed by index and are not represented here.
 */
export function deriveContinentStreamingSites(
  worldSeed: number,
  options: ContinentStreamingOptions,
): readonly ContinentStreamingSite[] {
  const normalizedSeed = requireSeed(worldSeed);
  const layoutVersion = requireLayoutVersion(options.legacyLayoutVersion);
  const span = requireSpan(options.span);
  const existing = new Set<number>();

  for (const siteIndex of options.existingLegacySiteIndices ?? []) {
    existing.add(requireSiteIndex(siteIndex));
  }

  const sites: ContinentStreamingSite[] = [];
  for (const anchor of archipelagoContinentAnchors(
    normalizedSeed,
    layoutVersion,
  )) {
    const siteIndex = requireSiteIndex(anchor.siteIndex);
    if (existing.has(siteIndex)) continue;

    const centerX = requireWorldCoordinate(
      anchor.cellX * ARCHIPELAGO_CONFIG.cellSize,
      "legacy continent centerX",
    );
    const centerZ = requireWorldCoordinate(
      anchor.cellZ * ARCHIPELAGO_CONFIG.cellSize,
      "legacy continent centerZ",
    );
    const field = createContinentField(normalizedSeed, siteIndex, {
      span,
      center: { x: centerX, z: centerZ },
    });
    const rawBounds = continentChunkBounds(field);
    const width = rawBounds.maxChunkX - rawBounds.minChunkX + 1;
    const height = rawBounds.maxChunkZ - rawBounds.minChunkZ + 1;
    const count = width * height;

    if (
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      count <= 0
    ) {
      throw new RangeError(
        "continent chunk bounds must be finite and non-empty",
      );
    }
    if (chunkBlockCeiling(field) > CONTINENT_FILL_BLOCK_CAP) {
      throw new RangeError(
        "continent chunk geometry exceeds the fillBlocks cap",
      );
    }

    sites.push({
      id: continentStreamingId(siteIndex),
      siteIndex,
      field,
      chunkBounds: {
        ...rawBounds,
        width,
        height,
        count,
      },
      chunkBitsetBytes: Math.ceil(count / 8),
    });
  }

  return sites;
}

/** A zeroed, fixed-length completion bitset for one formula continent. */
export function createContinentChunkBitset(
  site: ContinentStreamingSite,
): Uint8Array {
  return new Uint8Array(site.chunkBitsetBytes);
}

/** Fixed-length bitset encoding, least-significant bit first within each byte. */
export function encodeContinentChunkBitset(
  site: ContinentStreamingSite,
  bitset: Uint8Array,
): string {
  requireBitset(site, bitset);
  let encoded = "";

  for (let index = 0; index < bitset.length; index += 3) {
    const first = bitset[index];
    const second = bitset[index + 1];
    const third = bitset[index + 2];
    encoded += BASE64_ALPHABET[first >> 2];
    encoded += BASE64_ALPHABET[((first & 0x03) << 4) | ((second ?? 0) >> 4)];
    encoded +=
      second === undefined
        ? "="
        : BASE64_ALPHABET[((second & 0x0f) << 2) | ((third ?? 0) >> 6)];
    encoded += third === undefined ? "=" : BASE64_ALPHABET[third & 0x3f];
  }

  return encoded;
}

/**
 * Decodes only canonical, exact-length bitsets. Corrupt input is rejected as
 * `undefined`; callers can therefore fail closed by scheduling no work until
 * persistence recovery supplies a valid value.
 */
export function decodeContinentChunkBitset(
  site: ContinentStreamingSite,
  encoded: string,
): Uint8Array | undefined {
  const expectedLength = Math.ceil(site.chunkBitsetBytes / 3) * 4;
  if (
    encoded.length !== expectedLength ||
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(encoded)
  ) {
    return undefined;
  }
  if (encoded.includes("=") && !/={1,2}$/u.test(encoded)) return undefined;

  const bytes = new Uint8Array(site.chunkBitsetBytes);
  let byteIndex = 0;
  for (let index = 0; index < encoded.length; index += 4) {
    const a = base64Value(encoded[index]);
    const b = base64Value(encoded[index + 1]);
    const c = encoded[index + 2] === "=" ? 0 : base64Value(encoded[index + 2]);
    const d = encoded[index + 3] === "=" ? 0 : base64Value(encoded[index + 3]);
    if (a < 0 || b < 0 || c < 0 || d < 0) return undefined;

    if (byteIndex < bytes.length) bytes[byteIndex] = (a << 2) | (b >> 4);
    byteIndex += 1;
    if (encoded[index + 2] !== "=") {
      if (byteIndex < bytes.length) {
        bytes[byteIndex] = ((b & 0x0f) << 4) | (c >> 2);
      }
      byteIndex += 1;
    }
    if (encoded[index + 3] !== "=") {
      if (byteIndex < bytes.length) {
        bytes[byteIndex] = ((c & 0x03) << 6) | d;
      }
      byteIndex += 1;
    }
  }

  if (encodeContinentChunkBitset(site, bytes) !== encoded) return undefined;
  try {
    requireBitset(site, bytes);
  } catch {
    return undefined;
  }
  return bytes;
}

/** Returns a copied bitset with exactly one completed chunk bit set. */
export function completeContinentChunk(
  site: ContinentStreamingSite,
  bitset: Uint8Array,
  chunkIndex: number,
): Uint8Array {
  requireBitset(site, bitset);
  const index = requireChunkIndex(site, chunkIndex);
  const updated = new Uint8Array(bitset);
  updated[index >> 3] |= 1 << (index & 7);
  return updated;
}

/** True only when every chunk in the fixed bounds is marked complete. */
export function isContinentStreamingComplete(
  site: ContinentStreamingSite,
  bitset: Uint8Array,
): boolean {
  requireBitset(site, bitset);
  for (let index = 0; index < site.chunkBounds.count; index += 1) {
    if (!bitIsSet(bitset, index)) return false;
  }
  return true;
}

/**
 * Returns the stable task for one fixed chunk index, independent of completion
 * state. Persistence uses this to resume an in-flight fill after a crash.
 */
export function continentStreamingChunkAt(
  site: ContinentStreamingSite,
  chunkIndex: number,
): ContinentStreamingChunkTask {
  const index = requireChunkIndex(site, chunkIndex);
  const { chunkX, chunkZ } = chunkCoordinates(site, index);
  const plan = planContinentChunk(site.field, chunkX, chunkZ);
  if (
    plan.blocks > CONTINENT_FILL_BLOCK_CAP ||
    plan.volumes.some((volume) => volume.blocks > CONTINENT_FILL_BLOCK_CAP)
  ) {
    throw new RangeError("continent chunk plan exceeds the fillBlocks cap");
  }

  return {
    continentId: site.id,
    siteIndex: site.siteIndex,
    chunkIndex: index,
    chunkX,
    chunkZ,
    plan,
    volumes: plan.volumes,
  };
}

/**
 * Deterministically selects the nearest incomplete chunk to an observer. Ties
 * use row-major chunk index order, never map or iteration insertion order.
 */
export function nextContinentStreamingChunk(
  site: ContinentStreamingSite,
  bitset: Uint8Array,
  observer: ContinentStreamingObserver,
): ContinentStreamingChunkTask | undefined {
  requireBitset(site, bitset);
  const observerX = requireFiniteWorldCoordinate(observer.x, "observer.x");
  const observerZ = requireFiniteWorldCoordinate(observer.z, "observer.z");
  let selectedIndex = -1;
  let selectedDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < site.chunkBounds.count; index += 1) {
    if (bitIsSet(bitset, index)) continue;
    const { chunkX, chunkZ } = chunkCoordinates(site, index);
    const centerX = chunkX * 16 + 8;
    const centerZ = chunkZ * 16 + 8;
    const dx = centerX - observerX;
    const dz = centerZ - observerZ;
    const distance = dx * dx + dz * dz;
    if (distance < selectedDistance) {
      selectedIndex = index;
      selectedDistance = distance;
    }
  }

  if (selectedIndex < 0) return undefined;
  return continentStreamingChunkAt(site, selectedIndex);
}
