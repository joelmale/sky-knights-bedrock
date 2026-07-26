import { GenerationJob, WorldState } from "../persistence/schema";

export function queueGeneration(
  state: WorldState,
  job: Omit<GenerationJob, "stage" | "attempts">,
  force = false,
): WorldState {
  if (!force && state.activeGeneration?.id === job.id) {
    return state;
  }

  if (!force && state.generatedIslandIds.includes(job.id)) {
    return state;
  }

  return {
    ...state,
    generatedIslandIds: force
      ? state.generatedIslandIds.filter((id) => id !== job.id)
      : state.generatedIslandIds,
    activeGeneration: {
      ...job,
      stage: "queued",
      attempts: 0,
    },
  };
}

export function markStructurePlaced(state: WorldState): WorldState {
  if (state.activeGeneration === undefined) {
    return state;
  }

  return {
    ...state,
    activeGeneration: {
      ...state.activeGeneration,
      stage: "structure_placed",
      attempts: state.activeGeneration.attempts + 1,
    },
  };
}

export function completeGeneration(state: WorldState): WorldState {
  const job = state.activeGeneration;

  if (job === undefined || job.stage !== "structure_placed") {
    return state;
  }

  return {
    ...state,
    generatedIslandIds: Array.from(
      new Set([...state.generatedIslandIds, job.id]),
    ),
    islandVersions: {
      ...state.islandVersions,
      [job.id]: job.contentVersion,
    },
    activeGeneration: undefined,
  };
}
