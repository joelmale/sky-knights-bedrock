// World profile registry (roadmap 9 "world properties", phase 3 seed/profile
// selection).
//
// A profile answers the two questions a world must settle before the layout
// registry plans anything: which seed the realm is built on, and which islands
// the realm ships. It is persisted on the world document as a plain string id,
// so adding a profile never requires a schema bump — an unknown id resolves to
// the default profile on read instead of throwing or wiping the save.
//
// Determinism: `deriveWorldSeed` is a pure hash of the base seed and the
// profile salt. No `Math.random`, no `Date.now`, no unsorted iteration.

import { fnv1a32 } from "../util/hash";
import { LAYOUT } from "./islands";

export type WorldProfileId = "standard";

/** `"all"` selects every registered island; an array is an explicit allow-list. */
export type WorldProfileIslands = "all" | readonly string[];

export interface WorldProfile {
  id: WorldProfileId;
  displayName: string;
  description: string;
  /** Layout planner version this profile plans at. */
  layoutVersion: number;
  dimensionId: string;
  /**
   * Mixed into the derived world seed so two profiles started from the same
   * base seed never produce the same realm.
   */
  seedSalt: string;
  islands: WorldProfileIslands;
  /** Whether the authored objective chain drives player onboarding. */
  tutorial: boolean;
}

export const DEFAULT_WORLD_PROFILE_ID: WorldProfileId = "standard";

/**
 * Salt for the world-seed derivation. Changing it relocates every seeded island
 * in every existing world, so it is versioned with the world schema.
 */
export const WORLD_SEED_DERIVATION_SALT = "skyknights:world-seed:v5";

export const WORLD_PROFILES: Readonly<Record<WorldProfileId, WorldProfile>> = {
  standard: {
    id: "standard",
    displayName: "Standard Realm",
    description:
      "The shipped Sky Knights realm: the pinned starter tier plus every seeded island.",
    layoutVersion: LAYOUT.layoutVersion,
    dimensionId: LAYOUT.dimensionId,
    seedSalt: "standard",
    islands: "all",
    tutorial: true,
  },
};

/** Sorted. Iteration order is part of the determinism contract. */
export const WORLD_PROFILE_IDS: readonly WorldProfileId[] = ["standard"];

export function isWorldProfileId(value: unknown): value is WorldProfileId {
  return (
    typeof value === "string" &&
    (WORLD_PROFILE_IDS as readonly string[]).includes(value)
  );
}

/**
 * Unknown, missing, or retired ids resolve to the default profile. Persistence
 * reads must never throw on an id an older or newer build wrote.
 */
export function resolveWorldProfileId(value: unknown): WorldProfileId {
  return isWorldProfileId(value) ? value : DEFAULT_WORLD_PROFILE_ID;
}

export function worldProfile(id: unknown): WorldProfile {
  return WORLD_PROFILES[resolveWorldProfileId(id)];
}

export function profileIncludesIsland(
  profile: WorldProfile,
  islandId: string,
): boolean {
  return profile.islands === "all" || profile.islands.includes(islandId);
}

/**
 * The layout seed for a world. Derived rather than stored raw so that a world
 * upgrading from an older schema gets a stable realm from the seed it already
 * had, and so a fresh world created with the same base seed and profile lands
 * on exactly the same layout.
 */
export function deriveWorldSeed(baseSeed: number, profileId: unknown): number {
  const profile = worldProfile(profileId);

  return (
    fnv1a32(
      `${WORLD_SEED_DERIVATION_SALT}:${profile.seedSalt}:${baseSeed >>> 0}`,
    ) >>> 0
  );
}
