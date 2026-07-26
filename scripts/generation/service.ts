import { Dimension, system, world } from "@minecraft/server";

import { REQUIRED_ISLANDS, STARTER_ISLAND } from "../config/constants";
import { IslandDefinition, islandDefinition } from "../config/islands";
import { Logger } from "../diagnostics/logger";
import { WorldStateRepository } from "../persistence/repositories";
import {
  GenerationJob,
  WorldState,
  islandLayoutRecord,
  recordIslandLayout,
} from "../persistence/schema";
import { addBlockVectors, structureBounds } from "./bounds";
import { prepareIslandContent } from "./content";
import {
  DestinationDiscoveryOutcome,
  discoverDestination,
  plannedIslandLayoutRecords,
  worldIncludesIsland,
} from "./discovery";
import {
  completeGeneration,
  markStructurePlaced,
  queueGeneration,
} from "./state";

let activeGenerationTask: Promise<void> | undefined;

/**
 * Persists the deterministic registry layout before any generation job can be
 * queued. `recordIslandLayout` only fills missing records, preserving the
 * origin of every existing world indefinitely.
 */
export function ensureIslandLayoutRecorded(
  repository: WorldStateRepository,
): WorldState {
  const state = repository.load();
  const next = recordIslandLayout(state, plannedIslandLayoutRecords(state));

  if (next !== state) {
    repository.save(next);
  }

  return next;
}

/**
 * Safe runtime bridge for travel/reveal code. Profiles may opt islands out;
 * in that case no job is created. An accepted request is persisted before the
 * resumable worker is started.
 */
export function prepareDestinationGeneration(
  repository: WorldStateRepository,
  logger: Logger,
  islandId: string,
): DestinationDiscoveryOutcome {
  const state = ensureIslandLayoutRecorded(repository);
  const outcome = discoverDestination(state, islandId);

  if (outcome.state !== state) {
    repository.save(outcome.state);
  }

  if (
    outcome.readiness.status !== "excluded" &&
    outcome.readiness.status !== "inactive"
  ) {
    resumeGeneration(repository, logger);
  }

  return outcome;
}

export function ensureStarterIslandQueued(
  repository: WorldStateRepository,
  logger: Logger,
  force = false,
): void {
  const current = ensureIslandLayoutRecorded(repository);

  if (current.activeGeneration !== undefined) {
    logger.warn("Starter-island regeneration skipped while a job is active.", {
      activeJobId: current.activeGeneration.id,
    });
    return;
  }

  if (!worldIncludesIsland(current, STARTER_ISLAND.id)) {
    logger.warn("Starter island is excluded by the active world profile.");
    return;
  }

  const starter = registeredIsland(STARTER_ISLAND.id);
  const next = queueGeneration(
    current,
    {
      ...generationRequest(current, starter),
    },
    force,
  );

  if (next === current && current.activeGeneration === undefined) {
    return;
  }

  repository.save(next);
  resumeGeneration(repository, logger);
}

export function ensureRequiredIslandsQueued(
  repository: WorldStateRepository,
  logger: Logger,
): void {
  let state = ensureIslandLayoutRecorded(repository);

  if (state.activeGeneration === undefined) {
    state = queueNextRequiredIsland(state);
    repository.save(state);
  }

  resumeGeneration(repository, logger);
}

export function resumeGeneration(
  repository: WorldStateRepository,
  logger: Logger,
): void {
  if (activeGenerationTask !== undefined) {
    return;
  }

  if (repository.load().activeGeneration === undefined) {
    return;
  }

  activeGenerationTask = monitorGeneration(repository, logger);
}

async function monitorGeneration(
  repository: WorldStateRepository,
  logger: Logger,
): Promise<void> {
  try {
    await runGeneration(repository, logger);
  } catch (error) {
    logger.error("Generation job paused after an error.", {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    activeGenerationTask = undefined;
  }
}

async function runGeneration(
  repository: WorldStateRepository,
  logger: Logger,
): Promise<void> {
  while (true) {
    let state = repository.load();
    const job = state.activeGeneration;

    if (job === undefined) {
      return;
    }

    const island = registeredIsland(job.id);
    const dimension = world.getDimension(job.dimensionId);
    const tickingAreaId = await loadIslandChunks(
      island,
      job.origin,
      dimension,
      logger,
    );

    try {
      const beforePlacement = verifyIslandIntegrity(
        island,
        job.origin,
        dimension,
      );

      if (job.stage === "queued" || beforePlacement.length > 0) {
        world.structureManager.place(job.structureId, dimension, job.origin);
        await system.waitTicks(5);
      }

      const failures = verifyIslandIntegrity(island, job.origin, dimension);

      if (failures.length > 0) {
        throw new Error(
          `${job.id} failed integrity verification: ${failures.join("; ")}`,
        );
      }

      state = repository.load();

      if (state.activeGeneration?.id !== job.id) {
        throw new Error(
          `Active generation job changed while placing ${job.id}.`,
        );
      }

      if (state.activeGeneration.stage === "queued") {
        state = markStructurePlaced(state);
        repository.save(state);
        logger.info("Verified structure-placement checkpoint saved.", {
          jobId: job.id,
          attempts: state.activeGeneration?.attempts,
        });
      }

      prepareIslandContent(job.id, dimension, logger.child(job.id), job.origin);
      await system.waitTicks(1);

      state = completeGeneration(repository.load());
      repository.save(state);
      logger.info("Generation job completed after loaded-chunk verification.", {
        jobId: job.id,
        generatedIslandIds: state.generatedIslandIds,
      });
    } finally {
      releaseTickingArea(tickingAreaId, logger);
    }

    const next = queueNextRequiredIsland(state);

    if (next === state) {
      return;
    }

    repository.save(next);
    logger.info("Next required island queued.", {
      jobId: next.activeGeneration?.id,
    });
  }
}

function registeredIsland(id: string): IslandDefinition {
  try {
    return islandDefinition(id);
  } catch {
    throw new Error(`Generation job references unknown island ${id}.`);
  }
}

async function loadIslandChunks(
  island: IslandDefinition,
  origin: GenerationJob["origin"],
  dimension: Dimension,
  logger: Logger,
): Promise<string> {
  const manager = world.tickingAreaManager;
  const identifier = `skyknights_generation_${island.id}`;
  const bounds = structureBounds(origin, island.size);
  const options = {
    dimension,
    from: bounds.from,
    to: bounds.to,
  };

  if (manager.hasTickingArea(identifier)) {
    manager.removeTickingArea(identifier);
  }

  if (!manager.hasCapacity(options)) {
    throw new Error(`No ticking-area capacity is available for ${island.id}.`);
  }

  logger.info("Loading all chunks for island generation.", {
    islandId: island.id,
    from: bounds.from,
    to: bounds.to,
  });

  try {
    await manager.createTickingArea(identifier, options);
  } catch (error) {
    if (manager.hasTickingArea(identifier)) {
      manager.removeTickingArea(identifier);
    }

    throw error;
  }

  return identifier;
}

function releaseTickingArea(identifier: string, logger: Logger): void {
  const manager = world.tickingAreaManager;

  if (!manager.hasTickingArea(identifier)) {
    return;
  }

  try {
    manager.removeTickingArea(identifier);
  } catch (error) {
    logger.warn("Could not release the generation ticking area.", {
      identifier,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function verifyIslandIntegrity(
  island: IslandDefinition,
  origin: GenerationJob["origin"],
  dimension: Dimension,
): string[] {
  const failures: string[] = [];

  for (const expected of island.integrityBlocks) {
    const location = addBlockVectors(origin, expected.offset);
    const actual = dimension.getBlock(location)?.typeId;

    if (actual !== expected.typeId) {
      failures.push(
        `${location.x},${location.y},${location.z} expected ${expected.typeId}, found ${actual ?? "unavailable"}`,
      );
    }
  }

  return failures;
}

function queueNextRequiredIsland(state: WorldState): WorldState {
  if (state.activeGeneration !== undefined) {
    return state;
  }

  const island = REQUIRED_ISLANDS.map((legacy) =>
    registeredIsland(legacy.id),
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

  const job: Omit<GenerationJob, "stage" | "attempts"> = generationRequest(
    state,
    island,
  );
  return queueGeneration(
    state,
    job,
    state.generatedIslandIds.includes(island.id),
  );
}

function generationRequest(
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
