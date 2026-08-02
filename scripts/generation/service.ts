import { Dimension, StructureRotation, system, world } from "@minecraft/server";

import { IslandDefinition, islandDefinition } from "../config/islands";
import { Logger } from "../diagnostics/logger";
import { WorldStateRepository } from "../persistence/repositories";
import {
  GenerationJob,
  GenerationPart,
  WorldState,
  recordIslandLayout,
} from "../persistence/schema";
import {
  addBlockVectors,
  BlockVector,
  StructureBounds,
  structureBounds,
} from "./bounds";
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
import { ARCHIPELAGO_TEMPLATES } from "./archipelago";
import { ARCHIPELAGO_V3_TEMPLATES } from "./archipelago-v3";
import { parseArchipelagoV4IslandId } from "./archipelago-v4";
import type { ArchipelagoFamily } from "./archipelago";
import type { ContinentField } from "./continent-field";
import { createIslandField } from "./island-field";
import { fillIslandTerrain } from "./island-terrain-service";
import { islandTerrainBounds, planIslandTerrain } from "./island-terrain-plan";
import {
  abandonGeneration,
  advancePartCursor,
  completeGeneration,
  markStructurePlaced,
} from "./state";
import { generationRetryDelayTicks } from "./retry";
import { queueNextRequiredIsland } from "./required-islands";

let activeGenerationTask: Promise<void> | undefined;
const generationRetryCounts = new Map<string, number>();
const TICKING_AREA_LOAD_TIMEOUT_TICKS = 20 * 30;
const INTEGRITY_RETRY_INTERVAL_TICKS = 5;
const INTEGRITY_TIMEOUT_TICKS = 20 * 10;
const CONTINENT_PART_GAP_TICKS = 5;
/**
 * Obstruction cells inspected before the scan yields the tick.
 *
 * The preflight walks a whole bounding box one getBlock at a time and only
 * exits early on the first non-air block. In a void world - the intended
 * substrate - nothing is ever non-air, so the early exit never fires and the
 * full volume is always scanned: 30,420 cells for one standard island, 139,264
 * across a four-part crag, 576,000 across a sixteen-part landmark. Run inside a
 * single tick that is a visible freeze, and the stall is itself a likely cause
 * of the transient placement failures the part-cursor repair recovers from.
 *
 * Yielding keeps the scan exact and merely spreads it. Generation is already
 * asynchronous, so the only cost is elapsed ticks.
 */
const OBSTRUCTION_SCAN_BUDGET = 4096;
const STRUCTURE_ROTATIONS: Readonly<
  Record<GenerationPart["rotation"], StructureRotation>
> = {
  None: StructureRotation.None,
  Rotate90: StructureRotation.Rotate90,
  Rotate180: StructureRotation.Rotate180,
  Rotate270: StructureRotation.Rotate270,
};

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
    } else if (job !== undefined) {
      // Abandon rather than leave the job active. A retained unrecoverable job
      // blocks every later ambient AND required-island job for the life of the
      // world, because the queue treats a set activeGeneration as "busy".
      repository.save(abandonGeneration(repository.load()));
      logger.error(
        "Generation job abandoned after a non-retryable error; generation continues.",
        {
          error: message,
          jobId: job.id,
        },
      );
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

    // Ambient a4 islands are terrain, not structures. Their blocks come from
    // the deterministic field rather than from an .mcstructure, so they take a
    // separate path that fills volumes instead of placing parts. Everything
    // else - the queue, the retry, the completion bookkeeping - is shared.
    const terrain = islandTerrainSource(state, job);

    if (terrain !== undefined) {
      state = await runIslandTerrainGeneration(
        repository,
        logger,
        job,
        island,
        terrain,
        dimension,
      );

      const nextQueued = queueNextRequiredIsland(state);

      if (nextQueued === state) {
        return;
      }

      repository.save(nextQueued);
      continue;
    }

    if (job.parts !== undefined) {
      state = await runMultipartGeneration(
        repository,
        logger,
        job,
        island,
        registered.ambient,
        dimension,
      );

      const next = queueNextRequiredIsland(state);

      if (next === state) {
        return;
      }

      repository.save(next);
      logger.info("Next required island queued.", {
        jobId: next.activeGeneration?.id,
      });
      continue;
    }

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
          const obstruction = await firstStructureObstruction(
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

async function runMultipartGeneration(
  repository: WorldStateRepository,
  logger: Logger,
  job: GenerationJob,
  island: IslandDefinition,
  ambient: boolean,
  dimension: Dimension,
): Promise<WorldState> {
  const parts = job.parts;

  if (parts === undefined || parts.length === 0) {
    throw new Error(`Multipart generation job ${job.id} has no parts.`);
  }

  const beforePlacement = await multipartIntegrityFailures(
    job,
    island,
    dimension,
    logger,
  );

  if (
    ambient &&
    beforePlacement.length > 0 &&
    job.stage === "structure_placed"
  ) {
    completeAmbientGenerationWithoutPlacement(
      repository,
      logger,
      job,
      "Ambient island changed after its placement checkpoint; preserving the current blocks.",
    );
    return repository.load();
  }

  const shouldPlace = job.stage === "queued" && beforePlacement.length > 0;
  const startingCursor = job.partCursor ?? 0;
  let cursor = startingCursor;
  // Checkpointed parts holding a player edit rather than our blocks. They are
  // deliberately not re-placed, so they are also excluded from row
  // verification, which would otherwise fail on the edit.
  const preservedParts = new Set<number>();

  if (shouldPlace && ambient) {
    const conflict = await firstMultipartPreflightConflict(
      job,
      island,
      dimension,
      logger,
      cursor,
    );

    if (conflict !== undefined) {
      completeAmbientGenerationWithoutPlacement(
        repository,
        logger,
        job,
        conflict.kind === "block"
          ? "Ambient island skipped to preserve an occupied volume."
          : "Ambient island skipped to preserve an entity-occupied volume.",
        conflict.kind === "block"
          ? { obstruction: conflict.value }
          : { occupant: conflict.value },
      );
      return repository.load();
    }
  }

  if (!shouldPlace && job.stage === "queued") {
    const state = advancePartCursor(repository.load(), job.id, parts.length);
    repository.save(state);
    cursor = state.activeGeneration?.partCursor ?? cursor;
  }

  for (const row of contiguousPartRows(parts)) {
    const tickingAreaId = await loadPartRowChunks(
      island,
      row.parts,
      row.row,
      dimension,
      logger,
    );

    try {
      if (shouldPlace) {
        for (const { index, part } of row.parts) {
          // Every part is re-verified on every attempt, including parts the
          // persisted cursor claims are done. The cursor advances immediately
          // after place() and before the row is verified, so a place() that
          // returned without landing blocks used to leave the cursor past a
          // part that was never written; skipping on `index < cursor` meant no
          // retry ever revisited it and the island completed with a permanent
          // void.
          //
          // A checkpointed part that fails its probe is only re-placed when the
          // probe is empty. A different block there is a player edit, which is
          // preserved exactly as before.
          //
          // advancePartCursor is monotonic, so re-checking an early part can
          // never rewind the cursor.
          if (index < cursor && !partProbeIsEmpty(part, dimension)) {
            preservedParts.add(index);
            continue;
          }

          if (verifyPartIntegrity(part, dimension) === undefined) {
            const state = advancePartCursor(
              repository.load(),
              job.id,
              index + 1,
            );
            repository.save(state);
            cursor = state.activeGeneration?.partCursor ?? cursor;
            continue;
          }

          if (ambient) {
            const obstruction = await firstPartObstruction(
              part,
              island,
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
              return repository.load();
            }

            const occupant = firstPartOccupant(part, island, dimension);

            if (occupant !== undefined) {
              completeAmbientGenerationWithoutPlacement(
                repository,
                logger,
                job,
                "Ambient island skipped to preserve an entity-occupied volume.",
                { occupant },
              );
              return repository.load();
            }
          }

          world.structureManager.place(
            part.structureId,
            dimension,
            part.origin,
            {
              rotation: STRUCTURE_ROTATIONS[part.rotation],
            },
          );
          await system.waitTicks(CONTINENT_PART_GAP_TICKS);

          const state = advancePartCursor(repository.load(), job.id, index + 1);
          repository.save(state);
          cursor = state.activeGeneration?.partCursor ?? cursor;
        }
      }

      // Verify the whole row, not just parts at or after the cursor this
      // attempt started from. Filtering by `startingCursor` made a resumed row
      // verify an empty set and pass vacuously, which is what let a stranded
      // part reach completion.
      const failures = await waitForPartRowIntegrity(
        row.parts.filter(({ index }) => !preservedParts.has(index)),
        dimension,
      );

      if (failures.length > 0) {
        throw new Error(
          `${job.id} failed integrity verification: ${failures.join("; ")}`,
        );
      }
    } finally {
      releaseTickingArea(tickingAreaId, logger);
    }
  }

  let state = repository.load();

  if (state.activeGeneration?.id !== job.id) {
    throw new Error(`Active generation job changed while placing ${job.id}.`);
  }

  if (state.activeGeneration.stage === "queued") {
    if (state.activeGeneration.partCursor !== parts.length) {
      throw new Error(
        `Multipart generation job ${job.id} did not place every part.`,
      );
    }

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
    ambient,
    generatedIslandCount: state.generatedIslandIds.length,
  });
  return state;
}

function contiguousPartRows(parts: readonly GenerationPart[]): readonly {
  row: number;
  parts: readonly { index: number; part: GenerationPart }[];
}[] {
  const rows: {
    row: number;
    parts: { index: number; part: GenerationPart }[];
  }[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const current = rows[rows.length - 1];

    if (current === undefined || current.row !== part.row) {
      rows.push({ row: part.row, parts: [{ index, part }] });
    } else {
      current.parts.push({ index, part });
    }
  }

  return rows;
}

async function multipartIntegrityFailures(
  job: GenerationJob,
  island: IslandDefinition,
  dimension: Dimension,
  logger: Logger,
): Promise<string[]> {
  const parts = job.parts;

  if (parts === undefined) {
    return [];
  }

  const failures: string[] = [];

  for (const row of contiguousPartRows(parts)) {
    const tickingAreaId = await loadPartRowChunks(
      island,
      row.parts,
      row.row,
      dimension,
      logger,
    );

    try {
      failures.push(...verifyPartRowIntegrity(row.parts, dimension));
    } finally {
      releaseTickingArea(tickingAreaId, logger);
    }
  }

  return failures;
}

async function firstMultipartPreflightConflict(
  job: GenerationJob,
  island: IslandDefinition,
  dimension: Dimension,
  logger: Logger,
  cursor: number,
): Promise<
  | {
      kind: "block";
      value: { x: number; y: number; z: number; typeId: string };
    }
  | { kind: "entity"; value: { id: string; typeId: string } }
  | undefined
> {
  const parts = job.parts;

  if (parts === undefined) {
    return undefined;
  }

  for (const row of contiguousPartRows(parts)) {
    const tickingAreaId = await loadPartRowChunks(
      island,
      row.parts,
      row.row,
      dimension,
      logger,
    );

    try {
      for (const { index, part } of row.parts) {
        if (
          index < cursor ||
          verifyPartIntegrity(part, dimension) === undefined
        ) {
          continue;
        }

        const obstruction = await firstPartObstruction(part, island, dimension);

        if (obstruction !== undefined) {
          return { kind: "block", value: obstruction };
        }

        const occupant = firstPartOccupant(part, island, dimension);

        if (occupant !== undefined) {
          return { kind: "entity", value: occupant };
        }
      }
    } finally {
      releaseTickingArea(tickingAreaId, logger);
    }
  }

  return undefined;
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

/**
 * The terrain descriptor for an ambient a4 island, or undefined when the job is
 * anything else.
 *
 * a4 islands are the only jobs whose blocks come from the field. Authored
 * islands, legacy a1/a2 ambient islands and a2 continents all keep their
 * existing paths, so this is additive: nothing that worked before changes route.
 */
function islandTerrainSource(
  state: WorldState,
  job: GenerationJob,
): { field: ContinentField; family: ArchipelagoFamily } | undefined {
  const island = parseArchipelagoV4IslandId(state.worldSeed, job.id);

  if (island === undefined) {
    return undefined;
  }

  return {
    field: createIslandField(state.worldSeed, {
      index: island.index,
      tier: island.tier,
      deck: island.deck,
      x: island.x,
      z: island.z,
    }),
    family: island.family,
  };
}

/**
 * Generates one ambient island as terrain.
 *
 * Deliberately simpler than the multipart structure path. Every fill is
 * air-only, so writing is idempotent: a job interrupted midway can be replayed
 * from the start without duplicating or stranding anything, which is why there
 * is no part cursor and no per-part checkpoint here. The obstruction preflight
 * is also unnecessary - an air-only fill cannot overwrite whatever it finds, so
 * an occupied volume simply keeps its existing blocks and the island grows
 * around it.
 */
async function runIslandTerrainGeneration(
  repository: WorldStateRepository,
  logger: Logger,
  job: GenerationJob,
  island: IslandDefinition,
  terrain: { field: ContinentField; family: ArchipelagoFamily },
  dimension: Dimension,
): Promise<WorldState> {
  // Size the ticking area from the FIELD, not from the planner template. See
  // islandTerrainBounds: a template-sized area leaves the outer ring unloaded,
  // every fill there throws, and the retry blocks the whole queue.
  const plan = planIslandTerrain(terrain.field);
  const tickingAreaId = await loadIslandChunks(
    island,
    job.origin,
    dimension,
    logger,
    islandTerrainBounds(terrain.field),
  );

  try {
    const result = await fillIslandTerrain(
      terrain.field,
      terrain.family,
      dimension,
      logger,
      { plan },
    );

    logger.info("Ambient island terrain generated.", {
      jobId: job.id,
      family: terrain.family,
      blocks: result.blocks,
      volumes: result.volumes,
      batches: result.batches,
      failures: result.failures,
    });

    if (result.failures > 0) {
      // Idempotent writes make a retry safe and cheap: the fills that already
      // landed become no-ops.
      throw new Error(
        `${job.id} terrain generation had ${result.failures} failed fills.`,
      );
    }
  } finally {
    releaseTickingArea(tickingAreaId, logger);
  }

  let state = markStructurePlaced(repository.load());
  repository.save(state);
  // Ambient islands carry no scripted content by design, so this is a no-op
  // for them today. It is called anyway so the terrain path stays identical to
  // the structure path if that ever changes.
  prepareIslandContent(job.id, dimension, logger, job.origin);
  state = completeGeneration(repository.load());
  repository.save(state);
  return state;
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
      expected.origin.z !== job.origin.z ||
      !sameGenerationParts(expected.parts, job.parts)
    ) {
      throw new Error(
        `Generation job does not match deterministic archipelago plan for ${job.id}.`,
      );
    }

    return { definition, ambient: true };
  }
}

function sameGenerationParts(
  expected: GenerationJob["parts"],
  actual: GenerationJob["parts"],
): boolean {
  if (expected === undefined || actual === undefined) {
    return expected === actual;
  }

  if (expected.length !== actual.length) {
    return false;
  }

  return expected.every((part, index) => {
    const candidate = actual[index];

    return (
      candidate !== undefined &&
      part.structureId === candidate.structureId &&
      part.origin.x === candidate.origin.x &&
      part.origin.y === candidate.origin.y &&
      part.origin.z === candidate.origin.z &&
      part.rotation === candidate.rotation &&
      part.row === candidate.row &&
      part.integrityBlock.offset.x === candidate.integrityBlock.offset.x &&
      part.integrityBlock.offset.y === candidate.integrityBlock.offset.y &&
      part.integrityBlock.offset.z === candidate.integrityBlock.offset.z &&
      part.integrityBlock.typeId === candidate.integrityBlock.typeId
    );
  });
}

async function firstStructureObstruction(
  island: IslandDefinition,
  origin: GenerationJob["origin"],
  dimension: Dimension,
): Promise<{ x: number; y: number; z: number; typeId: string } | undefined> {
  return scanForObstruction(structureBounds(origin, island.size), dimension);
}

/** Exact bounding-box obstruction scan that yields instead of stalling. */
async function scanForObstruction(
  bounds: StructureBounds,
  dimension: Dimension,
): Promise<{ x: number; y: number; z: number; typeId: string } | undefined> {
  let inspected = 0;

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

        inspected += 1;

        if (inspected % OBSTRUCTION_SCAN_BUDGET === 0) {
          await system.waitTicks(1);
        }
      }
    }
  }

  return undefined;
}

function partSize(part: GenerationPart, island: IslandDefinition): BlockVector {
  for (const templateKey of Object.keys(ARCHIPELAGO_TEMPLATES)) {
    const template =
      ARCHIPELAGO_TEMPLATES[templateKey as keyof typeof ARCHIPELAGO_TEMPLATES];

    if (template.structureId === part.structureId) {
      return template.size;
    }
  }

  for (const templateKey of Object.keys(ARCHIPELAGO_V3_TEMPLATES)) {
    const template = ARCHIPELAGO_V3_TEMPLATES[templateKey];
    const matchingPart = template.parts.find(
      (candidate) => candidate.structureId === part.structureId,
    );

    if (matchingPart !== undefined) {
      return matchingPart.size;
    }
  }

  return island.size;
}

function partBounds(
  part: GenerationPart,
  island: IslandDefinition,
): StructureBounds {
  return structureBounds(part.origin, partSize(part, island));
}

async function firstPartObstruction(
  part: GenerationPart,
  island: IslandDefinition,
  dimension: Dimension,
): Promise<{ x: number; y: number; z: number; typeId: string } | undefined> {
  return scanForObstruction(partBounds(part, island), dimension);
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

function firstPartOccupant(
  part: GenerationPart,
  island: IslandDefinition,
  dimension: Dimension,
): { id: string; typeId: string } | undefined {
  const bounds = partBounds(part, island);
  const center = {
    x: (bounds.from.x + bounds.to.x + 1) / 2,
    y: (bounds.from.y + bounds.to.y + 1) / 2,
    z: (bounds.from.z + bounds.to.z + 1) / 2,
  };
  const size = partSize(part, island);
  const maxDistance = Math.ceil(
    Math.sqrt((size.x + 4) ** 2 + (size.y + 4) ** 2 + (size.z + 4) ** 2) / 2,
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
  boundsOverride?: StructureBounds,
): Promise<string> {
  const manager = world.tickingAreaManager;
  const identifier = `skyknights_generation_${island.id}`;
  const bounds = boundsOverride ?? structureBounds(origin, island.size);
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

async function loadPartRowChunks(
  island: IslandDefinition,
  rowParts: readonly { index: number; part: GenerationPart }[],
  row: number,
  dimension: Dimension,
  logger: Logger,
): Promise<string> {
  if (rowParts.length === 0) {
    throw new Error(`Cannot load an empty multipart row for ${island.id}.`);
  }

  const manager = world.tickingAreaManager;
  const identifier = `skyknights_generation_${island.id}_row_${row}`;
  const bounds = partRowBounds(
    rowParts.map(({ part }) => part),
    island,
  );
  const options = {
    dimension,
    from: bounds.from,
    to: bounds.to,
  };

  if (manager.hasTickingArea(identifier)) {
    manager.removeTickingArea(identifier);
  }

  if (!manager.hasCapacity(options)) {
    throw new Error(
      `No ticking-area capacity is available for ${island.id} row ${row}.`,
    );
  }

  logger.info("Loading chunks for multipart generation row.", {
    islandId: island.id,
    row,
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

function partRowBounds(
  parts: readonly GenerationPart[],
  island: IslandDefinition,
): StructureBounds {
  const first = partBounds(parts[0], island);
  const bounds = {
    from: { ...first.from },
    to: { ...first.to },
  };

  for (let index = 1; index < parts.length; index += 1) {
    const next = partBounds(parts[index], island);
    bounds.from.x = Math.min(bounds.from.x, next.from.x);
    bounds.from.y = Math.min(bounds.from.y, next.from.y);
    bounds.from.z = Math.min(bounds.from.z, next.from.z);
    bounds.to.x = Math.max(bounds.to.x, next.to.x);
    bounds.to.y = Math.max(bounds.to.y, next.to.y);
    bounds.to.z = Math.max(bounds.to.z, next.to.z);
  }

  return bounds;
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

function verifyPartIntegrity(
  part: GenerationPart,
  dimension: Dimension,
): string | undefined {
  const location = addBlockVectors(part.origin, part.integrityBlock.offset);
  const actual = dimension.getBlock(location)?.typeId;

  if (actual === part.integrityBlock.typeId) {
    return undefined;
  }

  return `${location.x},${location.y},${location.z} expected ${part.integrityBlock.typeId}, found ${actual ?? "unavailable"}`;
}

/**
 * True when a checkpointed part's probe is empty rather than merely different.
 *
 * The persisted cursor cannot distinguish "this part was placed and a player
 * has since edited it" from "place() returned but never landed the blocks".
 * Both fail the integrity probe. The difference is what is actually there: a
 * player edit leaves some other block, whereas a placement that never happened
 * leaves the void the island was going to fill.
 *
 * Air therefore means re-place; any other mismatch means preserve the edit.
 */
function partProbeIsEmpty(part: GenerationPart, dimension: Dimension): boolean {
  const location = addBlockVectors(part.origin, part.integrityBlock.offset);

  try {
    return dimension.getBlock(location)?.isAir === true;
  } catch {
    // An unreadable probe is not evidence of an empty one.
    return false;
  }
}

function verifyPartRowIntegrity(
  rowParts: readonly { index: number; part: GenerationPart }[],
  dimension: Dimension,
): string[] {
  const failures: string[] = [];

  for (const { part } of rowParts) {
    const failure = verifyPartIntegrity(part, dimension);

    if (failure !== undefined) {
      failures.push(failure);
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

async function waitForPartRowIntegrity(
  rowParts: readonly { index: number; part: GenerationPart }[],
  dimension: Dimension,
): Promise<string[]> {
  let failures = verifyPartRowIntegrity(rowParts, dimension);

  for (
    let waitedTicks = 0;
    failures.length > 0 && waitedTicks < INTEGRITY_TIMEOUT_TICKS;
    waitedTicks += INTEGRITY_RETRY_INTERVAL_TICKS
  ) {
    await system.waitTicks(INTEGRITY_RETRY_INTERVAL_TICKS);
    failures = verifyPartRowIntegrity(rowParts, dimension);
  }

  return failures;
}
