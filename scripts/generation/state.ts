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

/**
 * Persists composed-placement progress. `cursor` is the number of parts that
 * are placed and verified; it never decreases and never exceeds the part count,
 * so a replayed or out-of-order save can only ever be a no-op.
 *
 * A cursor of `0` is meaningful: it records that the occupied-volume survey
 * passed and the job has committed to its volume.
 */
export function advancePartCursor(
  state: WorldState,
  jobId: string,
  cursor: number,
): WorldState {
  const job = state.activeGeneration;

  if (job === undefined || job.id !== jobId || job.parts === undefined) {
    return state;
  }

  const next = Math.min(job.parts.length, Math.max(0, Math.trunc(cursor)));

  if (job.partCursor !== undefined && next <= job.partCursor) {
    return state;
  }

  return {
    ...state,
    activeGeneration: { ...job, partCursor: next },
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
