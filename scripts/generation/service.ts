import { Dimension, StructureRotation, system, world } from "@minecraft/server";

import { IslandDefinition, islandDefinition } from "../config/islands";
import { Logger } from "../diagnostics/logger";
import { WorldStateRepository } from "../persistence/repositories";
import {
  GenerationJob,
  GenerationPart,
  GenerationRotation,
  WorldState,
  recordIslandLayout,
} from "../persistence/schema";
import { BlockVector, StructureBounds, addBlockVectors, structureBounds } from "./bounds";
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
import {
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
/**
 * Settle gap between two components of a composed island. Twenty-one parts at
 * five ticks is roughly 5.25 s to raise a continent, and it caps what the
 * engine sees in any single tick at one component's worth of blocks.
 */
const COMPOSED_PART_GAP_TICKS = 5;
/**
 * A landmark is ~41k cells and one continent component ~36k. Scanning that many
 * blocks in a single tick is the exact hitch this system exists to avoid, so
 * the occupied-volume survey yields after this many `getBlock` calls.
 */
const OBSTRUCTION_SCAN_BLOCKS_PER_TICK = 4096;

const PLACEMENT_ROTATIONS: Readonly<
  Record<GenerationRotation, StructureRotation>
> = {
  None: StructureRotation.None,
  Rotate90: StructureRotation.Rotate90,
  Rotate180: StructureRotation.Rotate180,
  Rotate270: StructureRotation.Rotate270,
};

type PlacementOutcome = "verified" | "completed_without_placement";

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
    const outcome =
      job.parts === undefined
        ? await placeSingleStructure(
            repository,
            logger,
            job,
            island,
            dimension,
            registered.ambient,
          )
        : await placeComposedStructure(
            repository,
            logger,
            job,
            island,
            dimension,
            registered.ambient,
          );

    if (outcome === "completed_without_placement") {
      continue;
    }

    state = repository.load();

    if (state.activeGeneration?.id !== job.id) {
      throw new Error(`Active generation job changed while placing ${job.id}.`);
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
      parts: job.parts?.length,
      generatedIslandCount: state.generatedIslandIds.length,
    });

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

/** Unchanged single-`place()` path: every non-composed island still uses it. */
async function placeSingleStructure(
  repository: WorldStateRepository,
  logger: Logger,
  job: GenerationJob,
  island: IslandDefinition,
  dimension: Dimension,
  ambient: boolean,
): Promise<PlacementOutcome> {
  const bounds = structureBounds(job.origin, island.size);
  const tickingAreaId = await loadChunks(
    `skyknights_generation_${island.id}`,
    bounds,
    dimension,
    island.id,
    logger,
  );

  try {
    const beforePlacement = verifyIslandIntegrity(island, job.origin, dimension);
    let shouldPlace = job.stage === "queued" || beforePlacement.length > 0;

    if (ambient) {
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
        return "completed_without_placement";
      } else {
        const obstruction = await firstBoundsObstruction(bounds, dimension);

        if (obstruction !== undefined) {
          completeAmbientGenerationWithoutPlacement(
            repository,
            logger,
            job,
            "Ambient island skipped to preserve an occupied volume.",
            { obstruction },
          );
          return "completed_without_placement";
        }
      }
    }

    if (shouldPlace) {
      if (ambient) {
        const occupant = firstBoundsOccupant(bounds, dimension);

        if (occupant !== undefined) {
          completeAmbientGenerationWithoutPlacement(
            repository,
            logger,
            job,
            "Ambient island skipped to preserve an entity-occupied volume.",
            { occupant },
          );
          return "completed_without_placement";
        }
      }

      world.structureManager.place(job.structureId, dimension, job.origin);
      await system.waitTicks(5);
    }

    const failures = await waitForIntegrity(
      island.integrityBlocks,
      job.origin,
      dimension,
    );

    if (failures.length > 0) {
      throw new Error(
        `${job.id} failed integrity verification: ${failures.join("; ")}`,
      );
    }

    return "verified";
  } finally {
    releaseTickingArea(tickingAreaId, logger);
  }
}

/**
 * Composed (multi-component) placement.
 *
 * Restart safety, in order:
 *
 *   1. `partCursor === undefined` means the job has not committed to its volume
 *      yet. The occupied-volume survey runs over EVERY part first, one grid row
 *      of ticking areas at a time, and nothing is placed until all of it passes.
 *      A player build anywhere under the footprint skips the whole island
 *      rather than leaving half of one on top of it.
 *   2. Passing the survey persists `partCursor = 0`. That is the commitment
 *      point: the survey never runs again for this job, so a crash inside a
 *      `place()` call cannot be mistaken for someone else's blocks.
 *   3. Each part is placed, settled, verified against its own probe, and only
 *      then is `partCursor` advanced and saved. A crash between `place()` and
 *      the save costs exactly one re-place, which is idempotent: same
 *      structure, same origin, same rotation, same blocks.
 *   4. The job only reaches `structure_placed` once `partCursor` equals the
 *      part count, so a half-raised island can never be mistaken for a
 *      finished one.
 */
async function placeComposedStructure(
  repository: WorldStateRepository,
  logger: Logger,
  job: GenerationJob,
  island: IslandDefinition,
  dimension: Dimension,
  ambient: boolean,
): Promise<PlacementOutcome> {
  const parts = job.parts ?? [];
  const rows = partRows(parts);

  if (job.partCursor === undefined) {
    if (ambient) {
      const blocked = await surveyComposedVolume(rows, dimension, island.id, logger);

      if (blocked !== undefined) {
        completeAmbientGenerationWithoutPlacement(
          repository,
          logger,
          job,
          "Composed island skipped to preserve an occupied volume.",
          blocked,
        );
        return "completed_without_placement";
      }
    }

    const committed = advancePartCursor(repository.load(), job.id, 0);

    if (committed.activeGeneration?.id !== job.id) {
      throw new Error(`Active generation job changed while placing ${job.id}.`);
    }

    repository.save(committed);
    logger.info("Composed island volume surveyed and committed.", {
      jobId: job.id,
      parts: parts.length,
    });
  }

  for (const row of rows) {
    const cursor = repository.load().activeGeneration?.partCursor ?? 0;

    if (row.parts.every((entry) => entry.index < cursor)) {
      continue;
    }

    const tickingAreaId = await loadChunks(
      `skyknights_generation_${island.id}_r${row.row}`,
      row.bounds,
      dimension,
      `${island.id} row ${row.row}`,
      logger,
    );

    try {
      for (const entry of row.parts) {
        if (entry.index < (repository.load().activeGeneration?.partCursor ?? 0)) {
          // Already placed and verified. Its blocks are legitimately present,
          // so it must never be re-checked for obstruction.
          continue;
        }

        world.structureManager.place(
          entry.part.structureId,
          dimension,
          entry.part.origin,
          { rotation: PLACEMENT_ROTATIONS[entry.part.rotation] },
        );
        await system.waitTicks(COMPOSED_PART_GAP_TICKS);

        const failures = await waitForIntegrity(
          [entry.part.integrityBlock],
          entry.part.origin,
          dimension,
        );

        if (failures.length > 0) {
          throw new Error(
            `${job.id} part ${entry.index} failed integrity verification: ${failures.join("; ")}`,
          );
        }

        const advanced = advancePartCursor(
          repository.load(),
          job.id,
          entry.index + 1,
        );

        if (advanced.activeGeneration?.id !== job.id) {
          throw new Error(
            `Active generation job changed while placing ${job.id}.`,
          );
        }

        repository.save(advanced);
      }
    } finally {
      releaseTickingArea(tickingAreaId, logger);
    }
  }

  return "verified";
}

interface PartEntry {
  index: number;
  part: GenerationPart;
}

interface PartRow {
  row: number;
  parts: readonly PartEntry[];
  bounds: StructureBounds;
}

/**
 * Groups parts into grid rows. One ticking area covers a whole row; a ticking
 * area over a full composed footprint would be ~100 chunks and `hasCapacity`
 * refuses it.
 */
function partRows(parts: readonly GenerationPart[]): readonly PartRow[] {
  const rows: PartRow[] = [];

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    const bounds = structureBounds(part.origin, part.size);
    const existing = rows.find((candidate) => candidate.row === part.row);

    if (existing === undefined) {
      rows.push({ row: part.row, parts: [{ index, part }], bounds });
      continue;
    }

    existing.parts = [...existing.parts, { index, part }];
    existing.bounds = {
      from: {
        x: Math.min(existing.bounds.from.x, bounds.from.x),
        y: Math.min(existing.bounds.from.y, bounds.from.y),
        z: Math.min(existing.bounds.from.z, bounds.from.z),
      },
      to: {
        x: Math.max(existing.bounds.to.x, bounds.to.x),
        y: Math.max(existing.bounds.to.y, bounds.to.y),
        z: Math.max(existing.bounds.to.z, bounds.to.z),
      },
    };
  }

  return rows;
}

async function surveyComposedVolume(
  rows: readonly PartRow[],
  dimension: Dimension,
  islandId: string,
  logger: Logger,
): Promise<Readonly<Record<string, unknown>> | undefined> {
  for (const row of rows) {
    const tickingAreaId = await loadChunks(
      `skyknights_survey_${islandId}_r${row.row}`,
      row.bounds,
      dimension,
      `${islandId} survey row ${row.row}`,
      logger,
    );

    try {
      for (const entry of row.parts) {
        const bounds = structureBounds(entry.part.origin, entry.part.size);
        const obstruction = await firstBoundsObstruction(bounds, dimension);

        if (obstruction !== undefined) {
          return { part: entry.index, obstruction };
        }

        const occupant = firstBoundsOccupant(bounds, dimension);

        if (occupant !== undefined) {
          return { part: entry.index, occupant };
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

function samePart(left: GenerationPart, right: GenerationPart): boolean {
  return (
    left.structureId === right.structureId &&
    left.rotation === right.rotation &&
    left.origin.x === right.origin.x &&
    left.origin.y === right.origin.y &&
    left.origin.z === right.origin.z
  );
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

    const expectedParts = expected.parts ?? [];
    const actualParts = job.parts ?? [];
    // `partCursor` is deliberately excluded: it legitimately advances while the
    // job is in flight, so comparing it would reject every resumed job.
    const partsMatch =
      expectedParts.length === actualParts.length &&
      expectedParts.every((part, index) => samePart(part, actualParts[index]));

    if (
      expected.contentVersion !== job.contentVersion ||
      expected.structureId !== job.structureId ||
      expected.dimensionId !== job.dimensionId ||
      expected.origin.x !== job.origin.x ||
      expected.origin.y !== job.origin.y ||
      expected.origin.z !== job.origin.z ||
      !partsMatch
    ) {
      throw new Error(
        `Generation job does not match deterministic archipelago plan for ${job.id}.`,
      );
    }

    return { definition, ambient: true };
  }
}

/**
 * Exhaustive occupied-volume scan, budgeted across ticks. A landmark is ~41k
 * cells and a continent ~756k across all its parts, so scanning without yielding
 * would be exactly the placement hitch the tier budgets exist to prevent.
 */
async function firstBoundsObstruction(
  bounds: StructureBounds,
  dimension: Dimension,
): Promise<{ x: number; y: number; z: number; typeId: string } | undefined> {
  let scanned = 0;

  for (let x = bounds.from.x; x <= bounds.to.x; x += 1) {
    for (let y = bounds.from.y; y <= bounds.to.y; y += 1) {
      for (let z = bounds.from.z; z <= bounds.to.z; z += 1) {
        if (scanned >= OBSTRUCTION_SCAN_BLOCKS_PER_TICK) {
          scanned = 0;
          await system.waitTicks(1);
        }

        scanned += 1;

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

function firstBoundsOccupant(
  bounds: StructureBounds,
  dimension: Dimension,
): { id: string; typeId: string } | undefined {
  const size = {
    x: bounds.to.x - bounds.from.x + 1,
    y: bounds.to.y - bounds.from.y + 1,
    z: bounds.to.z - bounds.from.z + 1,
  };
  const center = {
    x: (bounds.from.x + bounds.to.x + 1) / 2,
    y: (bounds.from.y + bounds.to.y + 1) / 2,
    z: (bounds.from.z + bounds.to.z + 1) / 2,
  };
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

async function loadChunks(
  identifier: string,
  bounds: StructureBounds,
  dimension: Dimension,
  label: string,
  logger: Logger,
): Promise<string> {
  const manager = world.tickingAreaManager;
  const options = {
    dimension,
    from: bounds.from,
    to: bounds.to,
  };

  if (manager.hasTickingArea(identifier)) {
    manager.removeTickingArea(identifier);
  }

  if (!manager.hasCapacity(options)) {
    throw new Error(`No ticking-area capacity is available for ${label}.`);
  }

  logger.info("Loading all chunks for island generation.", {
    islandId: label,
    from: bounds.from,
    to: bounds.to,
  });

  try {
    await manager.createTickingArea(identifier, options);
    await waitForTickingArea(identifier, label);
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
  label: string,
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
    `Ticking area did not fully load for ${label} within ${TICKING_AREA_LOAD_TIMEOUT_TICKS} ticks.`,
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

function verifyIntegrity(
  probes: readonly { offset: BlockVector; typeId: string }[],
  origin: BlockVector,
  dimension: Dimension,
): string[] {
  const failures: string[] = [];

  for (const expected of probes) {
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

function verifyIslandIntegrity(
  island: IslandDefinition,
  origin: BlockVector,
  dimension: Dimension,
): string[] {
  return verifyIntegrity(island.integrityBlocks, origin, dimension);
}

async function waitForIntegrity(
  probes: readonly { offset: BlockVector; typeId: string }[],
  origin: BlockVector,
  dimension: Dimension,
): Promise<string[]> {
  let failures = verifyIntegrity(probes, origin, dimension);

  for (
    let waitedTicks = 0;
    failures.length > 0 && waitedTicks < INTEGRITY_TIMEOUT_TICKS;
    waitedTicks += INTEGRITY_RETRY_INTERVAL_TICKS
  ) {
    await system.waitTicks(INTEGRITY_RETRY_INTERVAL_TICKS);
    failures = verifyIntegrity(probes, origin, dimension);
  }

  return failures;
}
