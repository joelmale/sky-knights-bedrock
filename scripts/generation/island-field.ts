/**
 * Procedural terrain for ambient islands.
 *
 * Ambient islands were authored as 28 `.mcstructure` files, one per tier and
 * family. Two defects followed directly from that:
 *
 * - **Every island had a mathematically flat top.** The generator wrote a
 *   surface block only where `y === body.topY`, so an island's surface height
 *   was a single constant and no mound, dip or ridge was expressible.
 * - **Every island was the same inverted cone.** The body radius grew linearly
 *   with height and each cross-section was a circle, so all four tiers were one
 *   solid of revolution at four scales.
 *
 * A third followed from the catalogue size: 16 tier-and-family combinations
 * served over a thousand planned islands, so with only four rotations available
 * roughly nineteen islands shared byte-identical terrain.
 *
 * This module replaces authored island terrain with the same deterministic
 * field that generates continents, at island scale. Terrain becomes a formula
 * and the authored library is reduced to what it is good at: discrete features
 * such as caves, steps, land bridges, waterfalls and ruins, anchored to the
 * field's own surface height.
 *
 * Nothing here is continent-specific and nothing here changes continent
 * behaviour. The island tuning lives entirely in the `island` profile of
 * `createContinentField`.
 */

import {
  ContinentField,
  createContinentField,
  isLand,
  surfaceY,
} from "./continent-field";
import { ARCHIPELAGO_V4_DECK_CENTER_Y } from "./archipelago-v4";

/** Tier footprints, in blocks. */
export const ISLAND_TIER_SPAN = {
  islet: 24,
  standard: 38,
  crag: 64,
  landmark: 120,
} as const;

export type IslandTier = keyof typeof ISLAND_TIER_SPAN;

/**
 * Field version for ambient island terrain, independent of the continent field
 * version so island terrain can be retuned without invalidating continents.
 */
export const ISLAND_FIELD_VERSION = 1;

/**
 * The minimum an island's terrain descriptor needs. Deliberately a subset of
 * `ArchipelagoV4Island` so this module does not depend on the planner's whole
 * shape and stays testable without building a plan.
 */
export interface IslandFieldSource {
  readonly index: number;
  readonly tier: IslandTier;
  readonly deck: number;
  readonly x: number;
  readonly z: number;
}

/**
 * Builds the terrain field for one ambient island.
 *
 * The island's own planner-assigned centre and deck altitude are passed in
 * rather than re-derived, so terrain can never disagree with the layout the
 * planner persisted and the separation checks were run against.
 *
 * `index` is used as the field's continent index, which is what seeds the warp,
 * ridge and lake noise. Because every island has a distinct index, **every
 * island gets distinct terrain** — the byte-identical-copies problem disappears
 * rather than being mitigated with more variants.
 */
export function createIslandField(
  worldSeed: number,
  island: IslandFieldSource,
): ContinentField {
  const deck = ARCHIPELAGO_V4_DECK_CENTER_Y[island.deck];

  if (deck === undefined) {
    throw new RangeError(
      `island deck ${island.deck} is outside the planner's deck table`,
    );
  }

  const span = ISLAND_TIER_SPAN[island.tier];

  if (span === undefined) {
    throw new RangeError(`island tier ${island.tier} has no span`);
  }

  return createContinentField(worldSeed, island.index, {
    profile: "island",
    span,
    center: { x: island.x, z: island.z },
    // The deck is the island's mid altitude; the field grows upward from its
    // base, so drop the base by half the elevation to keep the island centred
    // on its deck and preserve the vertical clearance the planner reserved.
    baseY: deck - Math.floor(islandAmplitudeFor(span) / 2),
  });
}

/**
 * The elevation the island profile will choose for a span.
 *
 * Mirrors the island branch of `createContinentField`. Exported so the deck
 * offset above can be computed before the field exists, and so a test can
 * assert the mirror has not drifted from the field itself.
 */
export function islandAmplitudeFor(span: number): number {
  return Math.max(4, Math.floor(Math.floor(span / 2) / 2));
}

/** A land column of an island: its surface height and whether it exists. */
export interface IslandColumn {
  readonly x: number;
  readonly z: number;
  readonly surfaceY: number;
}

/**
 * Every land column of an island, in deterministic order.
 *
 * This is what a placement pass and a decoration pass both iterate. It costs no
 * `getBlock` calls: the field is a pure function, so the terrain is known before
 * a single block is written.
 */
export function islandColumns(field: ContinentField): IslandColumn[] {
  const columns: IslandColumn[] = [];

  for (
    let x = field.centerX - field.radius;
    x <= field.centerX + field.radius;
    x += 1
  ) {
    for (
      let z = field.centerZ - field.radius;
      z <= field.centerZ + field.radius;
      z += 1
    ) {
      if (!isLand(field, x, z)) {
        continue;
      }

      columns.push({ x, z, surfaceY: surfaceY(field, x, z) });
    }
  }

  return columns;
}

/** Summary used by budget tests and by the placement planner. */
export interface IslandTerrainMetrics {
  readonly landColumns: number;
  readonly minSurfaceY: number;
  readonly maxSurfaceY: number;
  /** Vertical relief. Zero would mean the flat-top defect had returned. */
  readonly relief: number;
  /** Solid blocks from the field base to each surface, inclusive. */
  readonly solidBlocks: number;
}

export function islandTerrainMetrics(
  field: ContinentField,
): IslandTerrainMetrics {
  const columns = islandColumns(field);

  if (columns.length === 0) {
    return {
      landColumns: 0,
      minSurfaceY: field.baseY,
      maxSurfaceY: field.baseY,
      relief: 0,
      solidBlocks: 0,
    };
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let solid = 0;

  for (const column of columns) {
    min = Math.min(min, column.surfaceY);
    max = Math.max(max, column.surfaceY);
    solid += column.surfaceY - field.baseY + 1;
  }

  return {
    landColumns: columns.length,
    minSurfaceY: min,
    maxSurfaceY: max,
    relief: max - min,
    solidBlocks: solid,
  };
}
