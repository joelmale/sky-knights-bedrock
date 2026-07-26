import { Dimension, system, world } from "@minecraft/server";

import { REQUIRED_ISLANDS, STARTER_ISLAND } from "../config/constants";
import { Logger } from "../diagnostics/logger";
import { WorldStateRepository } from "../persistence/repositories";
import { GenerationJob, WorldState } from "../persistence/schema";
import { addBlockVectors, structureBounds } from "./bounds";
import { prepareIslandContent } from "./content";
import {
  completeGeneration,
  markStructurePlaced,
  queueGeneration,
} from "./state";

type RequiredIsland = (typeof REQUIRED_ISLANDS)[number];

let activeGenerationTask: Promise<void> | undefined;

export function ensureStarterIslandQueued(
  repository: WorldStateRepository,
  logger: Logger,
  force = false,
): void {
  const current = repository.load();

  if (current.activeGeneration !== undefined) {
    logger.warn("Starter-island regeneration skipped while a job is active.", {
      activeJobId: current.activeGeneration.id,
    });
    return;
  }

  const next = queueGeneration(
    current,
    {
      id: STARTER_ISLAND.id,
      contentVersion: STARTER_ISLAND.contentVersion,
      structureId: STARTER_ISLAND.structureId,
      dimensionId: STARTER_ISLAND.dimensionId,
      origin: STARTER_ISLAND.origin,
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
  let state = repository.load();

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

    const island = requiredIsland(job.id);
    const dimension = world.getDimension(job.dimensionId);
    const tickingAreaId = await loadIslandChunks(island, dimension, logger);

    try {
      const beforePlacement = verifyIslandIntegrity(island, dimension);

      if (job.stage === "queued" || beforePlacement.length > 0) {
        world.structureManager.place(job.structureId, dimension, job.origin);
        await system.waitTicks(5);
      }

      const failures = verifyIslandIntegrity(island, dimension);

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

      prepareIslandContent(job.id, dimension, logger.child(job.id));
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

function requiredIsland(id: string): RequiredIsland {
  const island = REQUIRED_ISLANDS.find((candidate) => candidate.id === id);

  if (island === undefined) {
    throw new Error(`Generation job references unknown island ${id}.`);
  }

  return island;
}

async function loadIslandChunks(
  island: RequiredIsland,
  dimension: Dimension,
  logger: Logger,
): Promise<string> {
  const manager = world.tickingAreaManager;
  const identifier = `skyknights_generation_${island.id}`;
  const bounds = structureBounds(island.origin, island.size);
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
  island: RequiredIsland,
  dimension: Dimension,
): string[] {
  const failures: string[] = [];

  for (const expected of island.integrityBlocks) {
    const location = addBlockVectors(island.origin, expected.offset);
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

  const island = REQUIRED_ISLANDS.find(
    (candidate) =>
      !state.generatedIslandIds.includes(candidate.id) ||
      state.islandVersions[candidate.id] !== candidate.contentVersion,
  );

  if (island === undefined) {
    return state;
  }

  const job: Omit<GenerationJob, "stage" | "attempts"> = {
    id: island.id,
    contentVersion: island.contentVersion,
    structureId: island.structureId,
    dimensionId: island.dimensionId,
    origin: island.origin,
  };
  return queueGeneration(
    state,
    job,
    state.generatedIslandIds.includes(island.id),
  );
}
