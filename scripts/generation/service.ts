import { Dimension, system, world } from "@minecraft/server";

import { IslandDefinition, islandDefinition } from "../config/islands";
import { Logger } from "../diagnostics/logger";
import { WorldStateRepository } from "../persistence/repositories";
import {
  GenerationJob,
  WorldState,
  recordIslandLayout,
} from "../persistence/schema";
import { addBlockVectors, structureBounds } from "./bounds";
import { prepareIslandContent } from "./content";
import {
  DestinationDiscoveryOutcome,
  discoverDestination,
  plannedIslandLayoutRecords,
} from "./discovery";
import {
  archipelagoGenerationJobForId,
  archipelagoIslandDefinition,
} from "./archipelago-runtime";
import { completeGeneration, markStructurePlaced } from "./state";
import { generationRetryDelayTicks } from "./retry";
import { queueNextRequiredIsland } from "./required-islands";

let activeGenerationTask: Promise<void> | undefined;
const generationRetryCounts = new Map<string, number>();
const TICKING_AREA_LOAD_TIMEOUT_TICKS = 20 * 30;
const INTEGRITY_RETRY_INTERVAL_TICKS = 5;
const INTEGRITY_TIMEOUT_TICKS = 20 * 10;

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

export function ensureRequiredIslandsQueued(
  repository: WorldStateRepository,
  logger: Logger,
): void {
  const state = ensureIslandLayoutRecorded(repository);
  const next = queueNextRequiredIsland(state);

  if (next !== state) {
    repository.save(next);
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
    const message = error instanceof Error ? error.message : String(error);
    const job = repository.load().activeGeneration;

    logger.error("Generation job failed.", {
      error: message,
      jobId: job?.id,
    });

    if (job !== undefined && isRetryableGenerationError(message)) {
      scheduleGenerationRetry(repository, logger, job);
    } else {
      logger.error("Generation job paused after a non-retryable error.", {
        error: message,
        jobId: job?.id,
      });
    }
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

    const registered = registeredIsland(state, job);
    const island = registered.definition;
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
      let shouldPlace = job.stage === "queued" || beforePlacement.length > 0;

      if (registered.ambient) {
        if (beforePlacement.length === 0) {
          // A crash can leave a complete structure with a queued checkpoint.
          // Accept it without stamping over any blocks.
          shouldPlace = false;
        } else if (job.stage === "structure_placed") {
          completeAmbientGenerationWithoutPlacement(
            repository,
            logger,
            job,
            "Ambient island changed after its placement checkpoint; preserving the current blocks.",
          );
          continue;
        } else {
          const obstruction = firstStructureObstruction(
            island,
            job.origin,
            dimension,
          );

          if (obstruction !== undefined) {
            completeAmbientGenerationWithoutPlacement(
              repository,
              logger,
              job,
              "Ambient island skipped to preserve an occupied volume.",
              { obstruction },
            );
            continue;
          }
        }
      }

      if (shouldPlace) {
        if (registered.ambient) {
          const occupant = firstStructureOccupant(
            island,
            job.origin,
            dimension,
          );

          if (occupant !== undefined) {
            completeAmbientGenerationWithoutPlacement(
              repository,
              logger,
              job,
              "Ambient island skipped to preserve an entity-occupied volume.",
              { occupant },
            );
            continue;
          }
        }

        world.structureManager.place(job.structureId, dimension, job.origin);
        await system.waitTicks(5);
      }

      const failures = await waitForIslandIntegrity(
        island,
        job.origin,
        dimension,
      );

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
      generationRetryCounts.delete(generationRetryKey(job));
      logger.info("Generation job completed after loaded-chunk verification.", {
        jobId: job.id,
        ambient: registered.ambient,
        generatedIslandCount: state.generatedIslandIds.length,
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

function scheduleGenerationRetry(
  repository: WorldStateRepository,
  logger: Logger,
  job: GenerationJob,
): void {
  const key = generationRetryKey(job);
  const retryCount = (generationRetryCounts.get(key) ?? 0) + 1;
  const delayTicks = generationRetryDelayTicks(retryCount);

  generationRetryCounts.set(key, retryCount);
  logger.warn("Generation job will retry automatically.", {
    jobId: job.id,
    retryCount,
    delayTicks,
  });
  system.runTimeout(() => resumeGeneration(repository, logger), delayTicks);
}

function generationRetryKey(job: GenerationJob): string {
  return `${job.id}:${job.dimensionId}:${job.origin.x},${job.origin.y},${job.origin.z}:${job.contentVersion}`;
}

function isRetryableGenerationError(message: string): boolean {
  return !(
    message.startsWith("Generation job references unknown island") ||
    message.startsWith(
      "Generation job does not match deterministic archipelago plan",
    ) ||
    message.startsWith("Active generation job changed while placing")
  );
}

function completeAmbientGenerationWithoutPlacement(
  repository: WorldStateRepository,
  logger: Logger,
  job: GenerationJob,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): void {
  let state = repository.load();

  if (state.activeGeneration?.id !== job.id) {
    throw new Error(`Active generation job changed while checking ${job.id}.`);
  }

  if (state.activeGeneration.stage === "queued") {
    state = markStructurePlaced(state);
    repository.save(state);
  }

  state = completeGeneration(state);
  repository.save(state);
  generationRetryCounts.delete(generationRetryKey(job));
  logger.warn(message, {
    jobId: job.id,
    ...details,
  });
}

function registeredIsland(
  state: WorldState,
  job: GenerationJob,
): { definition: IslandDefinition; ambient: boolean } {
  try {
    return { definition: islandDefinition(job.id), ambient: false };
  } catch {
    const definition = archipelagoIslandDefinition(
      state,
      job.id,
      job.dimensionId,
    );
    const expected = archipelagoGenerationJobForId(
      state,
      job.id,
      job.dimensionId,
    );

    if (definition === undefined || expected === undefined) {
      throw new Error(`Generation job references unknown island ${job.id}.`);
    }

    if (
      expected.contentVersion !== job.contentVersion ||
      expected.structureId !== job.structureId ||
      expected.dimensionId !== job.dimensionId ||
      expected.origin.x !== job.origin.x ||
      expected.origin.y !== job.origin.y ||
      expected.origin.z !== job.origin.z
    ) {
      throw new Error(
        `Generation job does not match deterministic archipelago plan for ${job.id}.`,
      );
    }

    return { definition, ambient: true };
  }
}

function firstStructureObstruction(
  island: IslandDefinition,
  origin: GenerationJob["origin"],
  dimension: Dimension,
): { x: number; y: number; z: number; typeId: string } | undefined {
  const bounds = structureBounds(origin, island.size);

  for (let x = bounds.from.x; x <= bounds.to.x; x += 1) {
    for (let y = bounds.from.y; y <= bounds.to.y; y += 1) {
      for (let z = bounds.from.z; z <= bounds.to.z; z += 1) {
        const block = dimension.getBlock({ x, y, z });

        if (block === undefined) {
          return { x, y, z, typeId: "unavailable" };
        }

        if (block.typeId !== "minecraft:air") {
          return { x, y, z, typeId: block.typeId };
        }
      }
    }
  }

  return undefined;
}

function firstStructureOccupant(
  island: IslandDefinition,
  origin: GenerationJob["origin"],
  dimension: Dimension,
): { id: string; typeId: string } | undefined {
  const bounds = structureBounds(origin, island.size);
  const center = {
    x: (bounds.from.x + bounds.to.x + 1) / 2,
    y: (bounds.from.y + bounds.to.y + 1) / 2,
    z: (bounds.from.z + bounds.to.z + 1) / 2,
  };
  const maxDistance = Math.ceil(
    Math.sqrt(
      (island.size.x + 4) ** 2 +
        (island.size.y + 4) ** 2 +
        (island.size.z + 4) ** 2,
    ) / 2,
  );

  return dimension
    .getEntities({ location: center, maxDistance })
    .find(({ location }) => {
      const padding = 2;

      return (
        location.x >= bounds.from.x - padding &&
        location.x <= bounds.to.x + 1 + padding &&
        location.y >= bounds.from.y - padding &&
        location.y <= bounds.to.y + 1 + padding &&
        location.z >= bounds.from.z - padding &&
        location.z <= bounds.to.z + 1 + padding
      );
    });
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
    await waitForTickingArea(identifier, island.id);
  } catch (error) {
    if (manager.hasTickingArea(identifier)) {
      manager.removeTickingArea(identifier);
    }

    throw error;
  }

  return identifier;
}

async function waitForTickingArea(
  identifier: string,
  islandId: string,
): Promise<void> {
  const manager = world.tickingAreaManager;

  for (
    let waitedTicks = 0;
    waitedTicks <= TICKING_AREA_LOAD_TIMEOUT_TICKS;
    waitedTicks += INTEGRITY_RETRY_INTERVAL_TICKS
  ) {
    if (manager.getTickingArea(identifier)?.isFullyLoaded === true) {
      return;
    }

    await system.waitTicks(INTEGRITY_RETRY_INTERVAL_TICKS);
  }

  throw new Error(
    `Ticking area did not fully load for ${islandId} within ${TICKING_AREA_LOAD_TIMEOUT_TICKS} ticks.`,
  );
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

async function waitForIslandIntegrity(
  island: IslandDefinition,
  origin: GenerationJob["origin"],
  dimension: Dimension,
): Promise<string[]> {
  let failures = verifyIslandIntegrity(island, origin, dimension);

  for (
    let waitedTicks = 0;
    failures.length > 0 && waitedTicks < INTEGRITY_TIMEOUT_TICKS;
    waitedTicks += INTEGRITY_RETRY_INTERVAL_TICKS
  ) {
    await system.waitTicks(INTEGRITY_RETRY_INTERVAL_TICKS);
    failures = verifyIslandIntegrity(island, origin, dimension);
  }

  return failures;
}
