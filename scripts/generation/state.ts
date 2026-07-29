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

/**
 * Persists multipart placement progress without ever moving the checkpoint
 * backwards. Legacy single-structure jobs intentionally have no cursor.
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

  const current = job.partCursor ?? 0;
  const requested = Number.isFinite(cursor) ? Math.trunc(cursor) : current;
  const nextCursor = Math.min(job.parts.length, Math.max(current, requested));

  if (nextCursor === current) {
    return state;
  }

  return {
    ...state,
    activeGeneration: {
      ...job,
      partCursor: nextCursor,
    },
  };
}

/**
 * Drops an unrecoverable job without recording its island as generated.
 *
 * `completeGeneration` is the only other writer of `activeGeneration:
 * undefined`, and it requires a placed structure. That meant a job failing a
 * non-retryable error stayed active forever: the queue believed generation was
 * still in progress, so no ambient island and no required progression island
 * was ever started again for that world, silently and with no way to clear it.
 *
 * An a3 id encodes only its site index, so its tier, origin and structure are
 * re-derived from the current planner constants. Changing any of those
 * constants invalidates an already-queued job and raises exactly that
 * non-retryable error, which made editing the planner enough to freeze a world.
 * Abandoning the job lets the planner pick a valid one on the next sweep.
 */
export function abandonGeneration(state: WorldState): WorldState {
  if (state.activeGeneration === undefined) {
    return state;
  }

  return {
    ...state,
    activeGeneration: undefined,
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
