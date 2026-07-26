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
    return state;
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
