import { REQUIRED_ISLANDS } from "../config/constants";
import { IslandDefinition, islandDefinition } from "../config/islands";
import {
  GenerationJob,
  WorldState,
  islandLayoutRecord,
} from "../persistence/schema";
import { worldIncludesIsland } from "./discovery";
import { queueGeneration } from "./state";

/**
 * Queues the first incomplete gameplay-ready island in the released
 * progression order. Active jobs are never replaced, and player-modified
 * islands are never restamped for a content-version change.
 */
export function queueNextRequiredIsland(state: WorldState): WorldState {
  if (state.activeGeneration !== undefined) {
    return refreshQueuedRequiredIsland(state);
  }

  const island = REQUIRED_ISLANDS.map((legacy) =>
    islandDefinition(legacy.id),
  ).find((candidate) => {
    if (!worldIncludesIsland(state, candidate.id)) {
      return false;
    }

    const generated = state.generatedIslandIds.includes(candidate.id);
    const playerModified =
      islandLayoutRecord(state, candidate.id)?.playerModified === true;

    return (
      !generated ||
      (!playerModified &&
        state.islandVersions[candidate.id] !== candidate.contentVersion)
    );
  });

  if (island === undefined) {
    return state;
  }

  return queueGeneration(
    state,
    generationRequest(state, island),
    state.generatedIslandIds.includes(island.id),
  );
}

/**
 * A playtest pack can replace authored structure bytes while an interrupted
 * queued job is persisted. Refresh only an uncheckpointed, unmodified required
 * island so recovery records the content version that is actually packaged.
 */
function refreshQueuedRequiredIsland(state: WorldState): WorldState {
  const job = state.activeGeneration;

  if (job === undefined || job.stage !== "queued") {
    return state;
  }

  const island = REQUIRED_ISLANDS.map((legacy) =>
    islandDefinition(legacy.id),
  ).find((candidate) => candidate.id === job.id);
  const playerModified =
    islandLayoutRecord(state, job.id)?.playerModified === true;

  if (
    island === undefined ||
    playerModified ||
    (job.contentVersion === island.contentVersion &&
      job.structureId === island.structureId)
  ) {
    return state;
  }

  return {
    ...state,
    activeGeneration: {
      ...generationRequest(state, island),
      stage: "queued",
      attempts: job.attempts,
    },
  };
}

export function generationRequest(
  state: WorldState,
  island: IslandDefinition,
): Omit<GenerationJob, "stage" | "attempts"> {
  const origin = islandLayoutRecord(state, island.id)?.origin;

  if (origin === undefined) {
    throw new Error(`Island ${island.id} has no persisted layout record.`);
  }

  return {
    id: island.id,
    contentVersion: island.contentVersion,
    structureId: island.structureId,
    dimensionId: island.dimensionId,
    origin,
  };
}
