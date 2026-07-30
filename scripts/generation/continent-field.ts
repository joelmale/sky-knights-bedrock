/**
 * Continent terrain field.
 *
 * Implements the height field specified in `docs/design/CONTINENT_TERRAIN.md`:
 *
 *   surfaceY(x, z) = baseY
 *                  + amplitude * falloff(warpedDistance(x, z))
 *                  + ridge(x, z)
 *
 * This module is host-side and pure. It performs no Minecraft calls, holds no
 * module state, and is fully exercisable under vitest. The chunk generator that
 * eventually calls `Dimension.fillBlocks` is a separate, gated concern; the
 * per-chunk geometry it needs is produced by `continent-chunk-plan.ts`.
 *
 * Determinism contract
 * --------------------
 * Every value handled here is an integer. Fractions are carried in fixed point
 * against `CONTINENT_UNIT` (1024). The only division is `idiv`, which is
 * `Math.floor(a / b)`; IEEE-754 division and `Math.floor` are both exactly
 * specified, and every intermediate stays far below `Number.MAX_SAFE_INTEGER`,
 * so no rounding can differ between engines or accumulate into drift. There is
 * no `Math.random`, no `Date.now`, and no transcendental call: direction vectors
 * come from the same integer CORDIC rotation `archipelago-v3.ts` already uses.
 */

import { fnv1a32 } from "../util/hash";

/** Fixed-point unit. All fractional quantities are scaled by this. */
export const CONTINENT_UNIT = 1024;

/** Bumped whenever a change would move terrain for an existing seed. */
export const CONTINENT_FIELD_VERSION = 1;

/** Footprint span bounds from the design doc, in blocks. */
export const CONTINENT_MIN_SPAN = 600;
export const CONTINENT_MAX_SPAN = 1800;
export const CONTINENT_DEFAULT_SPAN = 600;

/** Minecraft's usable horizontal coordinate range, rounded outward. */
export const CONTINENT_MAX_WORLD_COORDINATE = 30_000_000;

/** Keeps fallback CORDIC products within Number's exact integer range. */
export const CONTINENT_MAX_TOOLING_RING_RADIUS = 8_000_000;

const GOLDEN_ANGLE_PHASE = 0x61c88647;
const QUARTER_TURN = 0x40000000;
const CORDIC_SCALE = 2 ** 30;
const CORDIC_GAIN_INVERSE = 652032874;
const CORDIC_ANGLES = [
  536870912, 316933406, 167458907, 85004756, 42667331, 21354465, 10679838,
  5340245, 2670163, 1335087, 667544, 333772, 166886, 83443, 41722, 20861, 10430,
  5215, 2608, 1304, 652, 326, 163, 81, 41, 20, 10, 5, 3, 1, 1,
] as const;

/** Default ring the continent centres are spread around, in blocks. */
export const CONTINENT_RING_RADIUS = 6000;

/**
 * Falloff below which a column is open sky rather than land. The zero crossing
 * is the coastline; this threshold pulls it in slightly so the shore has a
 * definite thickness instead of tapering to a one-block sliver.
 */
const SHORE_THRESHOLD = 80;

/**
 * Interior plateau. Falloff is saturated once the raw radial term passes this,
 * which flattens the middle of the continent into buildable ground and steepens
 * the coast.
 */
const PLATEAU_UNIT = 720;

/** Lattice cell exponents. Cell size is `1 << shift` blocks. */
const RIDGE_SHIFT = 6;
const RIDGE_OCTAVES = 3;
const WARP_OCTAVES = 2;
const LAKE_SHIFT = 6;
const LAKE_OCTAVES = 2;
const LAKE_ANCHOR_SHIFT = 7;

/**
 * Bound on how far `smoothSurfaceY` can move between orthogonally adjacent
 * columns. The lake seal is derived from this bound, and
 * `tests/continent-field.test.ts` asserts the field never exceeds it.
 */
export const CONTINENT_MAX_SMOOTH_STEP = 2;

/** How far a lake's water sits below its basin anchor. */
const LAKE_SINK = 3;

/** Lakes only form where the smooth surface sits inside this band of the anchor. */
const LAKE_GATE_BELOW = LAKE_SINK - CONTINENT_MAX_SMOOTH_STEP;
const LAKE_GATE_ABOVE = 8;

/** Keep lake basins clear of the anchor grid, where the water level steps. */
const LAKE_ANCHOR_MARGIN = 5;

/** Lakes stay this far inland, in falloff units. */
const LAKE_MIN_FALLOFF = 300;

/** Lake mask threshold and depth envelope. */
const LAKE_THRESHOLD = 280;
const LAKE_MIN_DEPTH = 2;
const LAKE_DEPTH_RANGE = 6;

export type ContinentBand = "air" | "core" | "subsurface" | "surface" | "water";

/**
 * Which constant set the field uses.
 *
 * `continent` is the original tuning and is never altered: its span floor, edge
 * margin, elevation curve and base altitude are exactly what shipped and what
 * the continent tests pin.
 *
 * `island` reuses the same mathematics at ambient-island scale. Three of the
 * continent constants are absolute rather than proportional and collapse when
 * the radius shrinks: a fixed 8-block edge margin leaves a 24-block islet only
 * 17% land, and the `40 + (radius - 300) * 16 / 600` elevation curve makes that
 * same islet 33 blocks tall — taller than it is wide. The island profile makes
 * all three scale with the radius.
 */
export type ContinentFieldProfile = "continent" | "island";

/**
 * Span floor for the island profile. Below roughly this size the domain warp
 * rounds to zero and the coastline degenerates back to a circle.
 */
export const ISLAND_MIN_SPAN = 24;

export interface ContinentFieldOptions {
  /** Footprint span in blocks, clamped to 600-1800 (24-1800 for islands). */
  readonly span?: number;
  /**
   * Centre selected by the owning planner. Runtime callers must supply this
   * persisted location; the deterministic ring is only a host-tooling fallback.
   */
  readonly center?: { readonly x: number; readonly z: number };
  /** Host-tooling fallback radius when no planner-owned centre is supplied. */
  readonly ringRadius?: number;
  /** Constant set. Omitted means `continent`, i.e. unchanged behaviour. */
  readonly profile?: ContinentFieldProfile;
  /**
   * Base altitude override. Ambient islands take their altitude from the a4
   * planner's deck assignment rather than the continent deck spread.
   */
  readonly baseY?: number;
}

export interface ContinentField {
  readonly worldSeed: number;
  readonly continentIndex: number;
  readonly version: number;
  readonly centerX: number;
  readonly centerZ: number;
  /** Footprint span in blocks. */
  readonly span: number;
  /** Hard bound: no land exists at or beyond this distance from the centre. */
  readonly radius: number;
  /** Radius at which the radial falloff reaches zero, before domain warping. */
  readonly falloffRadius: number;
  /** Largest displacement the domain warp can apply, in blocks. */
  readonly warpAmplitude: number;
  readonly warpShift: number;
  /** Bottom of the landmass. Every land column is solid from here upward. */
  readonly baseY: number;
  /** Elevation above `baseY` at full falloff, before ridge detail. */
  readonly amplitude: number;
  readonly ridgeAmplitude: number;
  readonly surfaceDepth: number;
  readonly subsurfaceDepth: number;
  readonly shoreThreshold: number;
  readonly seeds: {
    readonly warpX: number;
    readonly warpZ: number;
    readonly ridge: number;
    readonly lake: number;
  };
}

export interface ContinentColumn {
  readonly x: number;
  readonly z: number;
  /** False for open sky: every Y in this column is air. */
  readonly land: boolean;
  /** Radial falloff in fixed point, 0..CONTINENT_UNIT. */
  readonly falloff: number;
  /** Ridge-free dome height. The lake seal is reasoned against this. */
  readonly smoothY: number;
  /** The design doc's height field. `baseY - 1` when the column is open sky. */
  readonly surfaceY: number;
  /** Bottom of the solid stack. */
  readonly bottomY: number;
  /** Top solid block: `surfaceY`, or the lake bed where a lake is carved. */
  readonly solidTopY: number;
  readonly lake: boolean;
  /** Top water block. Equal to `solidTopY` when the column holds no water. */
  readonly waterTopY: number;
}

// ---------------------------------------------------------------------------
// Integer primitives
// ---------------------------------------------------------------------------

/** Floor division. The only division in this module. */
function idiv(numerator: number, denominator: number): number {
  return Math.floor(numerator / denominator);
}

function clamp(value: number, low: number, high: number): number {
  if (value < low) return low;
  if (value > high) return high;
  return value;
}

function coordinate(value: number, label: string): number {
  const integer = Math.trunc(value);
  if (
    !Number.isSafeInteger(integer) ||
    integer < -CONTINENT_MAX_WORLD_COORDINATE ||
    integer > CONTINENT_MAX_WORLD_COORDINATE
  ) {
    throw new RangeError(`${label} must be a safe Minecraft world coordinate`);
  }
  return integer;
}

function toolingRingRadius(value: number): number {
  const integer = Math.trunc(value);
  if (
    !Number.isSafeInteger(integer) ||
    integer < 0 ||
    integer > CONTINENT_MAX_TOOLING_RING_RADIUS
  ) {
    throw new RangeError("ringRadius must be a safe tooling fallback radius");
  }
  return integer;
}

function floorLog2(value: number): number {
  let remaining = value;
  let result = 0;

  while (remaining > 1) {
    remaining >>= 1;
    result += 1;
  }

  return result;
}

/** Newton's method on integers, matching `archipelago-v3.ts`. */
export function integerSquareRoot(value: number): number {
  if (value <= 0) return 0;
  let estimate = value;
  let next = idiv(estimate + 1, 2);

  while (next < estimate) {
    estimate = next;
    next = idiv(estimate + idiv(value, estimate), 2);
  }

  return estimate;
}

function mix32(value: number): number {
  let hash = value | 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** Deterministic lattice sample in `[-CONTINENT_UNIT, CONTINENT_UNIT)`. */
function latticeValue(seed: number, cellX: number, cellZ: number): number {
  const mixed = mix32(
    (seed ^ Math.imul(cellX, 0x27d4eb2d) ^ Math.imul(cellZ, 0x165667b1)) | 0,
  );
  return (mixed >>> 21) - CONTINENT_UNIT;
}

/** Smoothstep on `[0, CONTINENT_UNIT]`, in fixed point. */
function smoothStepUnit(t: number): number {
  const clamped = clamp(t, 0, CONTINENT_UNIT);
  return idiv(
    clamped * clamped * (3 * CONTINENT_UNIT - 2 * clamped),
    CONTINENT_UNIT * CONTINENT_UNIT,
  );
}

/** Bilinear value noise over a power-of-two lattice. */
function valueNoise(seed: number, x: number, z: number, shift: number): number {
  const cellX = x >> shift;
  const cellZ = z >> shift;
  const size = 1 << shift;
  const fractionX = x - (cellX << shift);
  const fractionZ = z - (cellZ << shift);
  const tx = smoothStepUnit(idiv(fractionX * CONTINENT_UNIT, size));
  const tz = smoothStepUnit(idiv(fractionZ * CONTINENT_UNIT, size));

  const v00 = latticeValue(seed, cellX, cellZ);
  const v10 = latticeValue(seed, cellX + 1, cellZ);
  const v01 = latticeValue(seed, cellX, cellZ + 1);
  const v11 = latticeValue(seed, cellX + 1, cellZ + 1);

  const low = v00 + idiv((v10 - v00) * tx, CONTINENT_UNIT);
  const high = v01 + idiv((v11 - v01) * tx, CONTINENT_UNIT);
  return low + idiv((high - low) * tz, CONTINENT_UNIT);
}

/**
 * Octave sum, renormalised back to `[-CONTINENT_UNIT, CONTINENT_UNIT)`. Each
 * octave halves the cell size and halves the weight.
 */
function fractalNoise(
  seed: number,
  x: number,
  z: number,
  shift: number,
  octaves: number,
): number {
  let total = 0;
  let weight = 0;
  let amplitude = CONTINENT_UNIT;

  for (let octave = 0; octave < octaves; octave += 1) {
    const octaveSeed = (seed ^ Math.imul(octave + 1, 0x9e3779b1)) | 0;
    const octaveShift = Math.max(1, shift - octave);
    total += idiv(
      valueNoise(octaveSeed, x, z, octaveShift) * amplitude,
      CONTINENT_UNIT,
    );
    weight += amplitude;
    amplitude = idiv(amplitude, 2);
  }

  if (weight === 0) return 0;
  return idiv(total * CONTINENT_UNIT, weight);
}

function directionForPhase(phase: number): { x: number; z: number } {
  const quadrant = phase >>> 30;
  let x = CORDIC_GAIN_INVERSE;
  let z = 0;
  let remaining = phase & (QUARTER_TURN - 1);

  for (let index = 0; index < CORDIC_ANGLES.length; index += 1) {
    const direction = remaining >= 0 ? 1 : -1;
    const divisor = 1 << index;
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

function seedOf(
  worldSeed: number,
  continentIndex: number,
  salt: string,
): number {
  return (
    fnv1a32(
      `${worldSeed >>> 0}\0${continentIndex}\0${CONTINENT_FIELD_VERSION}\0${salt}`,
    ) >>> 0
  );
}

// ---------------------------------------------------------------------------
// Field descriptor
// ---------------------------------------------------------------------------

/**
 * Build the descriptor for one continent. Runtime callers pass the centre from
 * their owning planner; without it, this host-side tool falls back to a
 * deterministic ring solely for inspection and test fixtures.
 */
export function createContinentField(
  worldSeed: number,
  continentIndex: number,
  options: ContinentFieldOptions = {},
): ContinentField {
  const island = (options.profile ?? "continent") === "island";
  const span =
    clamp(
      Math.trunc(options.span ?? CONTINENT_DEFAULT_SPAN),
      island ? ISLAND_MIN_SPAN : CONTINENT_MIN_SPAN,
      CONTINENT_MAX_SPAN,
    ) & ~1;
  const radius = idiv(span, 2);

  // Total warp displacement is 3/16 of the radius: enough to cut deep bays and
  // throw out peninsulas, while leaving the coastline provably inside `radius`.
  const warpAmplitude = idiv(3 * radius, 16);

  // The margin between the falloff zero and the hard radius bound. Eight blocks
  // is negligible against a 300-block continent radius and fatal against a
  // 12-block islet, where it would leave 17% of the footprint as land. The
  // island profile scales it, holding land at roughly 70-75% of radius at every
  // tier.
  const edgeMargin = island ? Math.max(1, idiv(radius, 8)) : 8;
  const falloffRadius = radius - warpAmplitude - edgeMargin;
  const warpShift = floorLog2(Math.max(2, idiv(radius, 2)));

  // Continent: 40 blocks tall at the 600 span, rising to 56 at 1800 — the
  // design doc's "40+ blocks tall against 52-block deck spacing".
  //
  // Island: proportional, so an island is never taller than it is wide. Half
  // the radius reproduces the retiring a3 tier heights closely (islet 6,
  // standard 9, crag 16) while giving the landmark real vertical presence.
  const amplitude = island
    ? Math.max(4, idiv(radius, 2))
    : 40 + idiv((radius - 300) * 16, 600);
  const ridgeAmplitude = idiv(amplitude * 3, 10);

  const centerSeed = seedOf(worldSeed, 0, "continent_ring");
  const ringRadius = toolingRingRadius(
    options.ringRadius ?? CONTINENT_RING_RADIUS,
  );
  const phase =
    (centerSeed + Math.imul(continentIndex, GOLDEN_ANGLE_PHASE)) >>> 0;
  const direction = directionForPhase(phase);
  const center = options.center ?? {
    x: idiv(ringRadius * direction.x, CORDIC_SCALE),
    z: idiv(ringRadius * direction.z, CORDIC_SCALE),
  };

  // Deck-aligned base elevation, spread across the usable altitude range.
  // Ambient islands override this with the deck altitude their planner assigned,
  // so island altitude stays owned by the a4 deck model rather than duplicated
  // here.
  const baseY =
    options.baseY === undefined
      ? 96 + ((seedOf(worldSeed, continentIndex, "base_y") >>> 8) % 25) * 4
      : coordinate(Math.trunc(options.baseY), "baseY");

  return {
    worldSeed: worldSeed >>> 0,
    continentIndex,
    version: CONTINENT_FIELD_VERSION,
    centerX: coordinate(center.x, "center.x"),
    centerZ: coordinate(center.z, "center.z"),
    span,
    radius,
    falloffRadius,
    warpAmplitude,
    warpShift,
    baseY,
    amplitude,
    ridgeAmplitude,
    surfaceDepth: 1,
    subsurfaceDepth: 4,
    shoreThreshold: SHORE_THRESHOLD,
    seeds: {
      warpX: seedOf(worldSeed, continentIndex, "warp_x"),
      warpZ: seedOf(worldSeed, continentIndex, "warp_z"),
      ridge: seedOf(worldSeed, continentIndex, "ridge"),
      lake: seedOf(worldSeed, continentIndex, "lake"),
    },
  };
}

// ---------------------------------------------------------------------------
// The field
// ---------------------------------------------------------------------------

/**
 * Distance from the centre after domain warping. The warp is what turns a disc
 * into a coastline with bays, inlets and peninsulas.
 */
export function warpedDistance(
  field: ContinentField,
  x: number,
  z: number,
): number {
  const warpX = idiv(
    field.warpAmplitude *
      fractalNoise(field.seeds.warpX, x, z, field.warpShift, WARP_OCTAVES),
    CONTINENT_UNIT,
  );
  const warpZ = idiv(
    field.warpAmplitude *
      fractalNoise(field.seeds.warpZ, x, z, field.warpShift, WARP_OCTAVES),
    CONTINENT_UNIT,
  );

  const dx = x + warpX - field.centerX;
  const dz = z + warpZ - field.centerZ;
  return integerSquareRoot(dx * dx + dz * dz);
}

/**
 * 1 at the centre, 0 at and past `falloffRadius`. The zero crossing is the
 * coastline; there is no bounding box anywhere in this design.
 */
export function falloffAt(field: ContinentField, distance: number): number {
  if (distance >= field.falloffRadius) return 0;
  const raw =
    CONTINENT_UNIT - idiv(distance * CONTINENT_UNIT, field.falloffRadius);
  const plateaued = Math.min(
    CONTINENT_UNIT,
    idiv(raw * CONTINENT_UNIT, PLATEAU_UNIT),
  );
  return smoothStepUnit(plateaued);
}

/** Falloff for a column, including the hard closure clamp at `radius`. */
export function falloffFor(
  field: ContinentField,
  x: number,
  z: number,
): number {
  const dx = x - field.centerX;
  const dz = z - field.centerZ;
  if (dx * dx + dz * dz >= field.radius * field.radius) return 0;
  return falloffAt(field, warpedDistance(field, x, z));
}

/** Ridge-free dome height. Slope-bounded, which is what seals lakes. */
export function smoothSurfaceY(
  field: ContinentField,
  x: number,
  z: number,
): number {
  return (
    field.baseY +
    idiv(field.amplitude * falloffFor(field, x, z), CONTINENT_UNIT)
  );
}

/**
 * Higher-frequency relief. Inverted absolute noise gives ridge lines rather
 * than blobs, and the falloff attenuation drops relief to nothing at the shore.
 */
export function ridgeAt(
  field: ContinentField,
  x: number,
  z: number,
  falloff: number,
): number {
  if (falloff <= 0) return 0;
  const noise = fractalNoise(
    field.seeds.ridge,
    x,
    z,
    RIDGE_SHIFT,
    RIDGE_OCTAVES,
  );
  const ridged = CONTINENT_UNIT - Math.abs(noise);
  const scaled = idiv(field.ridgeAmplitude * ridged, CONTINENT_UNIT);
  return idiv(scaled * falloff, CONTINENT_UNIT);
}

/**
 * The public height field. Everything downstream — strata fill, decoration
 * anchoring, dock placement, the safe-arrival check — reads this.
 *
 * Returns `field.baseY - 1` for open sky, so a column's solid height is always
 * `surfaceY - baseY + 1` and open sky is naturally zero blocks.
 */
export function surfaceY(field: ContinentField, x: number, z: number): number {
  const falloff = falloffFor(field, x, z);
  if (falloff < field.shoreThreshold) return field.baseY - 1;
  return (
    field.baseY +
    idiv(field.amplitude * falloff, CONTINENT_UNIT) +
    ridgeAt(field, x, z, falloff)
  );
}

/** True where `surfaceY` describes land rather than open sky. */
export function isLand(field: ContinentField, x: number, z: number): boolean {
  return falloffFor(field, x, z) >= field.shoreThreshold;
}

// ---------------------------------------------------------------------------
// Lakes
// ---------------------------------------------------------------------------

function anchorKey(cellX: number, cellZ: number): number {
  return cellX * 100000 + cellZ;
}

/**
 * A lake's water level is the smooth surface sampled at the centre of its
 * anchor cell, so it is exactly constant across the whole cell. Lakes are kept
 * `LAKE_ANCHOR_MARGIN` blocks clear of the cell grid, which is the only place
 * two different water levels could ever meet.
 */
function anchorHeight(
  field: ContinentField,
  cellX: number,
  cellZ: number,
  cache?: Map<number, number>,
): number {
  const key = anchorKey(cellX, cellZ);
  const cached = cache?.get(key);
  if (cached !== undefined) return cached;

  const half = 1 << (LAKE_ANCHOR_SHIFT - 1);
  const height = smoothSurfaceY(
    field,
    (cellX << LAKE_ANCHOR_SHIFT) + half,
    (cellZ << LAKE_ANCHOR_SHIFT) + half,
  );
  cache?.set(key, height);
  return height;
}

function distanceToAnchorEdge(value: number): number {
  const size = 1 << LAKE_ANCHOR_SHIFT;
  const local = value - ((value >> LAKE_ANCHOR_SHIFT) << LAKE_ANCHOR_SHIFT);
  return Math.min(local, size - 1 - local);
}

interface LakeResult {
  readonly lake: boolean;
  readonly waterTopY: number;
  readonly bedY: number;
}

const NO_LAKE: LakeResult = { lake: false, waterTopY: 0, bedY: 0 };

function lakeAt(
  field: ContinentField,
  x: number,
  z: number,
  falloff: number,
  smoothY: number,
  cache?: Map<number, number>,
): LakeResult {
  if (falloff < LAKE_MIN_FALLOFF) return NO_LAKE;
  if (
    distanceToAnchorEdge(x) < LAKE_ANCHOR_MARGIN ||
    distanceToAnchorEdge(z) < LAKE_ANCHOR_MARGIN
  ) {
    return NO_LAKE;
  }

  const noise = fractalNoise(field.seeds.lake, x, z, LAKE_SHIFT, LAKE_OCTAVES);
  if (noise < LAKE_THRESHOLD) return NO_LAKE;

  const anchorY = anchorHeight(
    field,
    x >> LAKE_ANCHOR_SHIFT,
    z >> LAKE_ANCHOR_SHIFT,
    cache,
  );

  // The terrain must sit inside a narrow band of the anchor: high enough that
  // the surrounding ground holds the water in, low enough that the basin is a
  // lake rather than a pit gouged into a hillside.
  if (smoothY < anchorY - LAKE_GATE_BELOW) return NO_LAKE;
  if (smoothY > anchorY + LAKE_GATE_ABOVE) return NO_LAKE;

  const waterTopY = anchorY - 1 - LAKE_SINK;
  const excess = noise - LAKE_THRESHOLD;
  const depth =
    LAKE_MIN_DEPTH +
    idiv(LAKE_DEPTH_RANGE * excess, CONTINENT_UNIT - LAKE_THRESHOLD);
  const bedY = waterTopY - depth;

  // Never carve into or below the landmass floor.
  if (bedY <= field.baseY) return NO_LAKE;

  return { lake: true, waterTopY, bedY };
}

// ---------------------------------------------------------------------------
// Columns and strata
// ---------------------------------------------------------------------------

export function buildColumn(
  field: ContinentField,
  x: number,
  z: number,
  cache?: Map<number, number>,
): ContinentColumn {
  const falloff = falloffFor(field, x, z);
  const smoothY = field.baseY + idiv(field.amplitude * falloff, CONTINENT_UNIT);

  if (falloff < field.shoreThreshold) {
    const empty = field.baseY - 1;
    return {
      x,
      z,
      land: false,
      falloff,
      smoothY,
      surfaceY: empty,
      bottomY: field.baseY,
      solidTopY: empty,
      lake: false,
      waterTopY: empty,
    };
  }

  const terrainY = smoothY + ridgeAt(field, x, z, falloff);
  const lake = lakeAt(field, x, z, falloff, smoothY, cache);

  return {
    x,
    z,
    land: true,
    falloff,
    smoothY,
    surfaceY: terrainY,
    bottomY: field.baseY,
    solidTopY: lake.lake ? lake.bedY : terrainY,
    lake: lake.lake,
    waterTopY: lake.lake ? lake.waterTopY : terrainY,
  };
}

/** Pure column read. */
export function columnAt(
  field: ContinentField,
  x: number,
  z: number,
): ContinentColumn {
  return buildColumn(field, x, z);
}

/**
 * Strata resolution in the design doc's terms: given the height field and a Y,
 * which band applies. This is the plain terrain case, with no lake carve.
 */
export function strataForSurface(
  field: ContinentField,
  columnSurfaceY: number,
  y: number,
): ContinentBand {
  if (columnSurfaceY < field.baseY) return "air";
  if (y > columnSurfaceY || y < field.baseY) return "air";
  if (y > columnSurfaceY - field.surfaceDepth) return "surface";
  if (y > columnSurfaceY - field.surfaceDepth - field.subsurfaceDepth) {
    return "subsurface";
  }
  return "core";
}

/**
 * Full strata resolution for a column, including lake water and lake bed. A
 * lake bed is subsurface material all the way up: no grass under water.
 */
export function strataAt(
  field: ContinentField,
  column: ContinentColumn,
  y: number,
): ContinentBand {
  if (!column.land) return "air";
  if (y < column.bottomY) return "air";

  if (column.lake) {
    if (y > column.waterTopY) return "air";
    if (y > column.solidTopY) return "water";
    if (y > column.solidTopY - field.subsurfaceDepth) return "subsurface";
    return "core";
  }

  return strataForSurface(field, column.surfaceY, y);
}

// ---------------------------------------------------------------------------
// Bounds helpers
// ---------------------------------------------------------------------------

/** Conservative rejection test for an axis-aligned block box. */
export function boxIntersectsContinent(
  field: ContinentField,
  minX: number,
  minZ: number,
  maxX: number,
  maxZ: number,
): boolean {
  const dx = Math.max(minX - field.centerX, 0, field.centerX - maxX);
  const dz = Math.max(minZ - field.centerZ, 0, field.centerZ - maxZ);
  return dx * dx + dz * dz < field.radius * field.radius;
}

/** Tallest solid stack any column of this field can produce. */
export function maxColumnHeight(field: ContinentField): number {
  return field.amplitude + field.ridgeAmplitude + 1;
}
