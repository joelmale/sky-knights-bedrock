/**
 * Ambient island tier geometry — the single source of truth.
 *
 * The a4 planner and the terrain field must agree on how big an island is. They
 * did not: the planner sized islands from the retiring a3 template metadata
 * (radii 25 / 34 / 53 / 92) while the field derived its own radius from the tier
 * span (17 / 27 / 45 / 84). Every island was planned one size and built another,
 * so observer clearance, continent reservation and cluster packing were all
 * computed against a footprint that no longer existed.
 *
 * This module owns the spans. It deliberately has no imports, so both the
 * planner and the field can depend on it without a cycle.
 */

/**
 * Tier footprints, in blocks.
 *
 * Grown 40% over the retiring authored tiers. The field yields roughly 70% land
 * with relief where the authored disc was 100% flat, so like-for-like spans lost
 * about half the usable area — a standard island fell from 1,009 walkable cells
 * to 499. The playtest verdict was that usable area was already too small, so
 * the spans grow rather than the land fraction.
 *
 * These are no longer bound by Bedrock's 64-block structure limit, because
 * terrain is filled from the field rather than placed from an `.mcstructure`.
 * That is what lets the landmark reach 168.
 */
export const ISLAND_TIER_SPAN = {
  islet: 34,
  standard: 54,
  crag: 90,
  landmark: 168,
} as const;

export type IslandTier = keyof typeof ISLAND_TIER_SPAN;

export const ISLAND_TIERS: readonly IslandTier[] = [
  "islet",
  "standard",
  "crag",
  "landmark",
];

/** Even span, matching the field's own `span & ~1` normalisation. */
export function islandTierSpan(tier: IslandTier): number {
  return ISLAND_TIER_SPAN[tier] & ~1;
}

/** Horizontal radius. The field's hard bound: no land exists beyond it. */
export function islandTierRadius(tier: IslandTier): number {
  return Math.floor(islandTierSpan(tier) / 2);
}

/**
 * Elevation the island profile chooses for a tier.
 *
 * Mirrors the island branch of `createContinentField`. Kept here so the planner
 * can size vertical clearance without constructing a field, and asserted against
 * the field itself by a test so the mirror cannot drift.
 */
export function islandTierAmplitude(tier: IslandTier): number {
  return Math.max(4, Math.floor(islandTierRadius(tier) / 2));
}

/** Vertical half-extent, for the planner's clearance arithmetic. */
export function islandTierHeightRadius(tier: IslandTier): number {
  return Math.max(1, Math.floor(islandTierAmplitude(tier) / 2));
}
