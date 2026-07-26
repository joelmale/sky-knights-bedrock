// Destination discovery + pre-generation ahead of travel (roadmap 7 "Generate
// ahead of player travel, beginning when a destination is revealed or
// selected. Keep a safe holding platform until the destination reports
// ready.", roadmap 11 Phase 3 "destination discovery and pre-generation").
//
// Pure decision layer only — no @minecraft/server import, so vitest covers it
// without the game runtime (see tests/discovery.test.ts). It reuses the
// existing resumable job queue (`queueGeneration` in `state.ts`) instead of
// rewriting it: this module only ever decides WHETHER and WITH WHAT job to
// call it, one destination at a time, exactly like
// `service.ts#queueNextRequiredIsland` already does for the required-island
// loop.
//
// Runtime wiring belongs at a player-facing reveal/selection boundary. Call
// `prepareDestinationGeneration` from `service.ts` there; it persists a
// profile-allowed request and starts the resumable worker atomically.
// - Use `shouldHoldForDestination(outcome.readiness)` to keep the player at
//   their last safe dock until the destination reports `"ready"`.

import {
  isIslandGameplayReady,
  islandDefinition,
  islandPlacement,
  planIslandLayout,
} from "../config/islands";
import { profileIncludesIsland, worldProfile } from "../config/profiles";
import {
  GenerationStage,
  IslandLayoutRecord,
  WorldState,
  islandLayoutRecord,
} from "../persistence/schema";
import { BlockVector } from "./bounds";
import { queueGeneration } from "./state";

export interface DestinationGenerationRequest {
  id: string;
  contentVersion: number;
  structureId: string;
  dimensionId: string;
  origin: BlockVector;
}

export type DestinationReadinessStatus =
  "ready" | "generating" | "waiting" | "not_started" | "inactive" | "excluded";

export interface DestinationReadiness {
  status: DestinationReadinessStatus;
  /** The island id currently occupying the single-job queue, if any. */
  activeJobId?: string;
  stage?: GenerationStage;
}

export interface DestinationDiscoveryOutcome {
  state: WorldState;
  readiness: DestinationReadiness;
}

/** Whether an island is enabled by the world's persisted profile. */
export function worldIncludesIsland(
  state: WorldState,
  islandId: string,
): boolean {
  try {
    islandDefinition(islandId);
  } catch {
    return false;
  }

  return profileIncludesIsland(worldProfile(state.worldProfile), islandId);
}

/**
 * Converts the deterministic registry layout into persistence records. The
 * repository layer merges these only for islands that have no record yet, so
 * this is safe to call on every startup.
 */
export function plannedIslandLayoutRecords(
  state: WorldState,
): readonly IslandLayoutRecord[] {
  return planIslandLayout(state.worldSeed, state.layoutVersion)
    .placements.filter((placement) => worldIncludesIsland(state, placement.id))
    .map((placement) => ({
      id: placement.id,
      structureId: placement.structureId,
      dimensionId: placement.dimensionId,
      placement: placement.placement,
      origin: placement.origin,
      size: placement.size,
      reserved: placement.reserved,
      playerModified: false,
    }));
}

/**
 * Finds the persisted island whose placed structure contains a block. The
 * structure bounds, rather than the padded reservation, are used because a
 * later structure placement can only overwrite blocks inside this volume.
 */
export function islandLayoutRecordAtBlock(
  state: WorldState,
  dimensionId: string,
  location: BlockVector,
): IslandLayoutRecord | undefined {
  for (const id of Object.keys(state.islandLayout).sort()) {
    const record = state.islandLayout[id];
    const to = {
      x: record.origin.x + record.size.x - 1,
      y: record.origin.y + record.size.y - 1,
      z: record.origin.z + record.size.z - 1,
    };

    if (
      record.dimensionId === dimensionId &&
      location.x >= record.origin.x &&
      location.x <= to.x &&
      location.y >= record.origin.y &&
      location.y <= to.y &&
      location.z >= record.origin.z &&
      location.z <= to.z
    ) {
      return record;
    }
  }

  return undefined;
}

/**
 * Builds the generation job a destination would need, preferring (in order)
 * a previously recorded layout origin, a pinned origin, and finally a fresh
 * layout computation. Persisted records always win so an existing world is
 * never silently relocated by a later planner revision.
 */
export function destinationGenerationRequest(
  state: WorldState,
  islandId: string,
): DestinationGenerationRequest {
  const definition = islandDefinition(islandId);
  const recorded = islandLayoutRecord(state, islandId);
  const origin =
    recorded?.origin ??
    definition.pinnedOrigin ??
    islandPlacement(
      planIslandLayout(state.worldSeed, state.layoutVersion),
      islandId,
    ).origin;

  return {
    id: definition.id,
    contentVersion: definition.contentVersion,
    structureId: definition.structureId,
    dimensionId: definition.dimensionId,
    origin,
  };
}

/**
 * Readiness for a destination given the current world document.
 *
 * A generated island whose content version has since drifted is still
 * `"ready"` once a player has edited its authored terrain (ADR-007,
 * `WorldState.islandLayout[id].playerModified`) — a content retune must never
 * force a regeneration over player edits.
 */
export function evaluateDestinationReadiness(
  state: WorldState,
  destination: Pick<DestinationGenerationRequest, "id" | "contentVersion">,
): DestinationReadiness {
  const generated = state.generatedIslandIds.includes(destination.id);
  const currentVersionMatches =
    state.islandVersions[destination.id] === destination.contentVersion;
  const playerModified =
    islandLayoutRecord(state, destination.id)?.playerModified === true;

  if (generated && (currentVersionMatches || playerModified)) {
    return { status: "ready" };
  }

  const active = state.activeGeneration;

  if (active?.id === destination.id) {
    return {
      status: "generating",
      activeJobId: active.id,
      stage: active.stage,
    };
  }

  if (active !== undefined) {
    return { status: "waiting", activeJobId: active.id };
  }

  return { status: "not_started" };
}

/**
 * Queues a destination's generation ahead of travel. A no-op whenever the
 * destination is already ready, already the active job, or another job
 * currently occupies the single-job queue — the caller should simply retry
 * later (e.g. on the next reveal check or holding-state poll) once that job
 * finishes, exactly like `service.ts#queueNextRequiredIsland` already does.
 */
export function requestDestinationGeneration(
  state: WorldState,
  destination: DestinationGenerationRequest,
): WorldState {
  const readiness = evaluateDestinationReadiness(state, destination);

  if (readiness.status !== "not_started") {
    return state;
  }

  return queueGeneration(
    state,
    {
      id: destination.id,
      contentVersion: destination.contentVersion,
      structureId: destination.structureId,
      dimensionId: destination.dimensionId,
      origin: destination.origin,
    },
    // Force only when re-queueing a previously generated, non-player-modified
    // island whose content version has moved on — the same rule
    // `queueNextRequiredIsland` uses for the required-island loop.
    state.generatedIslandIds.includes(destination.id),
  );
}

/**
 * The single entry point for "a destination was revealed or selected":
 * resolves its job, queues it if and only if nothing else is in flight, and
 * reports the resulting readiness. Always returns the destination's own
 * readiness against the *returned* state, so a caller that skips the save
 * (state unchanged) still gets an accurate answer.
 */
export function discoverDestination(
  state: WorldState,
  islandId: string,
): DestinationDiscoveryOutcome {
  if (!worldIncludesIsland(state, islandId)) {
    return { state, readiness: { status: "excluded" } };
  }

  if (!isIslandGameplayReady(islandDefinition(islandId))) {
    return { state, readiness: { status: "inactive" } };
  }

  const destination = destinationGenerationRequest(state, islandId);
  const nextState = requestDestinationGeneration(state, destination);

  return {
    state: nextState,
    readiness: evaluateDestinationReadiness(nextState, destination),
  };
}

/** True whenever the player should be kept at a safe holding dock rather than
 * allowed to depart for this destination. */
export function shouldHoldForDestination(
  readiness: DestinationReadiness,
): boolean {
  return readiness.status !== "ready" && readiness.status !== "excluded";
}
