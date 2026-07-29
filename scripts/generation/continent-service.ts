import { BlockVolume, Dimension, system, world } from "@minecraft/server";

import { REQUIRED_ISLANDS } from "../config/constants";
import { Logger } from "../diagnostics/logger";
import {
  ContinentProgressRepository,
  ContinentProgressState,
  beginContinentChunkProgress,
  completeContinentChunkProgress,
} from "../persistence/continent-progress";
import { WorldStateRepository } from "../persistence/repositories";
import { WorldState } from "../persistence/schema";
import {
  ARCHIPELAGO_CONFIG,
  archipelagoContinentAnchors,
  deriveArchipelagoIsland,
} from "./archipelago";
import {
  ARCHIPELAGO_LAYOUT_VERSION,
  ArchipelagoObserver,
  STABLE_ARCHIPELAGO_DIMENSION,
} from "./archipelago-runtime";
import { CONTINENT_DEFAULT_SPAN } from "./continent-field";
import {
  ContinentStreamingChunkTask,
  ContinentStreamingSite,
  completeContinentChunk,
  continentStreamingChunkAt,
  createContinentChunkBitset,
  decodeContinentChunkBitset,
  deriveContinentStreamingSites,
  encodeContinentChunkBitset,
  isContinentStreamingComplete,
  nextContinentStreamingChunk,
  parseContinentStreamingId,
} from "./continent-streaming";

export const CONTINENT_STREAMING_CONTENT_VERSION = 1;
export const CONTINENT_STREAMING_SPAN = CONTINENT_DEFAULT_SPAN;
export const CONTINENT_STREAMING_TRIGGER_MARGIN = 256;
export const CONTINENT_FILL_CALLS_PER_TICK = 4;
export const CONTINENT_RETRY_BACKOFF_TICKS = 20 * 10;

const TICKING_AREA_LOAD_TIMEOUT_TICKS = 20 * 30;
const TICKING_AREA_RETRY_TICKS = 5;
const FORMULA_CONTINENT_BLOCKS = {
  core: "minecraft:stone",
  subsurface: "minecraft:dirt",
  surface: "minecraft:grass_block",
  water: "minecraft:water",
} as const;

let activeContinentTask: Promise<void> | undefined;
const deferredContinentChunks = new Map<string, number>();
let continentStreamingRetryTick = 0;

export interface ContinentStreamingSelection {
  readonly site: ContinentStreamingSite;
  readonly task: ContinentStreamingChunkTask;
  readonly bitset: Uint8Array;
  readonly recovering: boolean;
}

function continentChunkRuntimeKey(
  continentId: string,
  chunkIndex: number,
): string {
  return `${continentId}:${chunkIndex}`;
}

function activeDeferredChunkKeys(): ReadonlySet<string> {
  const currentTick = system.currentTick;

  for (const [key, retryTick] of deferredContinentChunks) {
    if (retryTick <= currentTick) {
      deferredContinentChunks.delete(key);
    }
  }

  return new Set(deferredContinentChunks.keys());
}

function deferContinentChunk(selection: ContinentStreamingSelection): void {
  deferredContinentChunks.set(
    continentChunkRuntimeKey(selection.site.id, selection.task.chunkIndex),
    system.currentTick + CONTINENT_RETRY_BACKOFF_TICKS,
  );
}

function deferAllContinentStreaming(): void {
  continentStreamingRetryTick = Math.max(
    continentStreamingRetryTick,
    system.currentTick + CONTINENT_RETRY_BACKOFF_TICKS,
  );
}

function clearContinentChunkDeferral(
  selection: ContinentStreamingSelection,
): void {
  deferredContinentChunks.delete(
    continentChunkRuntimeKey(selection.site.id, selection.task.chunkIndex),
  );
}

function bitsetWithoutDeferredChunks(
  site: ContinentStreamingSite,
  bitset: Uint8Array,
  deferredChunkKeys: ReadonlySet<string>,
): Uint8Array {
  let schedulingBitset = bitset;

  for (
    let chunkIndex = 0;
    chunkIndex < site.chunkBounds.count;
    chunkIndex += 1
  ) {
    if (deferredChunkKeys.has(continentChunkRuntimeKey(site.id, chunkIndex))) {
      schedulingBitset = completeContinentChunk(
        site,
        schedulingBitset,
        chunkIndex,
      );
    }
  }

  return schedulingBitset;
}

function distanceSquared(
  left: { readonly x: number; readonly z: number },
  right: { readonly x: number; readonly z: number },
): number {
  const dx = left.x - right.x;
  const dz = left.z - right.z;
  return dx * dx + dz * dz;
}

export function generatedLegacyContinentSiteIndices(
  state: Pick<WorldState, "worldSeed" | "generatedIslandIds">,
): readonly number[] {
  const generated = new Set(state.generatedIslandIds);
  const result: number[] = [];

  for (const anchor of archipelagoContinentAnchors(
    state.worldSeed,
    ARCHIPELAGO_LAYOUT_VERSION,
  )) {
    const island = deriveArchipelagoIsland(
      state.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
      anchor.cellX,
      anchor.cellZ,
    );

    if (island?.tier === "continent" && generated.has(island.id)) {
      result.push(anchor.siteIndex);
    }
  }

  return result;
}

function bitsetFor(
  site: ContinentStreamingSite,
  progress: ContinentProgressState,
): Uint8Array {
  const encoded = progress.chunks[site.id];

  if (encoded === undefined) {
    return createContinentChunkBitset(site);
  }

  const decoded = decodeContinentChunkBitset(site, encoded);

  if (decoded === undefined) {
    throw new Error(`Persisted chunk progress for ${site.id} is corrupt.`);
  }

  return decoded;
}

function startedFormulaContinentIds(
  state: Pick<WorldState, "generatedIslandIds">,
  progress: ContinentProgressState,
): ReadonlySet<string> {
  const ids = new Set<string>();

  for (const id of state.generatedIslandIds) {
    if (parseContinentStreamingId(id) !== undefined) {
      ids.add(id);
    }
  }

  for (const id of Object.keys(progress.chunks)) {
    ids.add(id);
  }

  if (progress.activeChunk !== undefined) {
    ids.add(progress.activeChunk.continentId);
  }

  return ids;
}

export function reconcileCompletedContinentHistory(
  state: WorldState,
  progress: ContinentProgressState,
): WorldState {
  const generated = new Set(state.generatedIslandIds);
  const islandVersions = { ...state.islandVersions };
  let changed = false;
  const sites = deriveContinentStreamingSites(state.worldSeed, {
    legacyLayoutVersion: ARCHIPELAGO_LAYOUT_VERSION,
    existingLegacySiteIndices: generatedLegacyContinentSiteIndices(state),
    span: CONTINENT_STREAMING_SPAN,
  });

  for (const site of sites) {
    if (generated.has(site.id)) {
      continue;
    }

    const encoded = progress.chunks[site.id];

    if (encoded === undefined) {
      continue;
    }

    const bitset = decodeContinentChunkBitset(site, encoded);

    if (bitset === undefined) {
      throw new Error(`Persisted chunk progress for ${site.id} is corrupt.`);
    }

    if (!isContinentStreamingComplete(site, bitset)) {
      continue;
    }

    generated.add(site.id);
    islandVersions[site.id] = CONTINENT_STREAMING_CONTENT_VERSION;
    changed = true;
  }

  return changed
    ? {
        ...state,
        generatedIslandIds: [...generated],
        islandVersions,
      }
    : state;
}

export function selectContinentStreamingChunk(
  state: WorldState,
  progress: ContinentProgressState,
  observers: readonly ArchipelagoObserver[],
  dimensionId: string = STABLE_ARCHIPELAGO_DIMENSION,
  deferredChunkKeys: ReadonlySet<string> = new Set(),
): ContinentStreamingSelection | undefined {
  if (
    state.activeGeneration !== undefined ||
    REQUIRED_ISLANDS.some(
      (required) => !state.generatedIslandIds.includes(required.id),
    )
  ) {
    return undefined;
  }

  const legacySiteIndices = generatedLegacyContinentSiteIndices(state);
  const sites = deriveContinentStreamingSites(state.worldSeed, {
    legacyLayoutVersion: ARCHIPELAGO_LAYOUT_VERSION,
    existingLegacySiteIndices: legacySiteIndices,
    span: CONTINENT_STREAMING_SPAN,
  });
  const started = startedFormulaContinentIds(state, progress);
  const claimedContinentSlots = legacySiteIndices.length + started.size;

  if (claimedContinentSlots > ARCHIPELAGO_CONFIG.maxGeneratedContinents) {
    throw new Error(
      `Formula continent history claims ${claimedContinentSlots} sites, exceeding the shared ${ARCHIPELAGO_CONFIG.maxGeneratedContinents}-continent cap.`,
    );
  }

  if (progress.activeChunk !== undefined) {
    const site = sites.find(
      (candidate) => candidate.id === progress.activeChunk?.continentId,
    );

    if (site === undefined) {
      throw new Error(
        `Active formula continent ${progress.activeChunk.continentId} is unavailable.`,
      );
    }

    if (
      deferredChunkKeys.has(
        continentChunkRuntimeKey(
          progress.activeChunk.continentId,
          progress.activeChunk.chunkIndex,
        ),
      )
    ) {
      return undefined;
    }

    return {
      site,
      task: continentStreamingChunkAt(site, progress.activeChunk.chunkIndex),
      bitset: bitsetFor(site, progress),
      recovering: true,
    };
  }

  const dimensionObservers = observers.filter(
    (observer) => observer.dimensionId === dimensionId,
  );

  if (dimensionObservers.length === 0) {
    return undefined;
  }

  const generated = new Set(state.generatedIslandIds);
  const canStartAnother =
    claimedContinentSlots < ARCHIPELAGO_CONFIG.maxGeneratedContinents;
  const candidates: {
    site: ContinentStreamingSite;
    task: ContinentStreamingChunkTask;
    bitset: Uint8Array;
    distance: number;
  }[] = [];

  for (const site of sites) {
    if (generated.has(site.id)) {
      continue;
    }

    if (!started.has(site.id) && !canStartAnother) {
      continue;
    }

    const bitset = bitsetFor(site, progress);

    if (isContinentStreamingComplete(site, bitset)) {
      continue;
    }

    const triggerRadius =
      site.field.radius + CONTINENT_STREAMING_TRIGGER_MARGIN;
    const nearbyObservers = dimensionObservers.filter(
      (observer) =>
        distanceSquared(observer, {
          x: site.field.centerX,
          z: site.field.centerZ,
        }) <=
        triggerRadius * triggerRadius,
    );

    for (const observer of nearbyObservers) {
      const task = nextContinentStreamingChunk(
        site,
        bitsetWithoutDeferredChunks(site, bitset, deferredChunkKeys),
        observer,
      );

      if (task === undefined) {
        continue;
      }

      candidates.push({
        site,
        task,
        bitset,
        distance: distanceSquared(observer, {
          x: task.chunkX * 16 + 8,
          z: task.chunkZ * 16 + 8,
        }),
      });
    }
  }

  const selected = candidates.sort(
    (left, right) =>
      left.distance - right.distance ||
      left.site.siteIndex - right.site.siteIndex ||
      left.task.chunkIndex - right.task.chunkIndex,
  )[0];

  return selected === undefined
    ? undefined
    : {
        site: selected.site,
        task: selected.task,
        bitset: selected.bitset,
        recovering: false,
      };
}

function entityOccupiesTask(
  dimension: Dimension,
  selection: ContinentStreamingSelection,
): boolean {
  const { plan } = selection.task;

  if (plan.empty) {
    return false;
  }

  const center = {
    x: plan.originX + 8,
    y: (plan.minY + plan.maxY) / 2,
    z: plan.originZ + 8,
  };
  const maxDistance = Math.ceil(
    Math.sqrt(8 ** 2 + ((plan.maxY - plan.minY + 1) / 2) ** 2 + 8 ** 2),
  );

  return dimension
    .getEntities({ location: center, maxDistance })
    .some(({ location }) => {
      return (
        location.x >= plan.originX &&
        location.x < plan.originX + 16 &&
        location.y >= plan.minY - 2 &&
        location.y <= plan.maxY + 3 &&
        location.z >= plan.originZ &&
        location.z < plan.originZ + 16
      );
    });
}

function taskVolume(selection: ContinentStreamingSelection): BlockVolume {
  const { plan } = selection.task;
  return new BlockVolume(
    { x: plan.originX, y: plan.minY, z: plan.originZ },
    { x: plan.originX + 15, y: plan.maxY, z: plan.originZ + 15 },
  );
}

function taskIsOccupied(
  dimension: Dimension,
  selection: ContinentStreamingSelection,
): boolean {
  return (
    dimension
      .getBlocks(taskVolume(selection), {
        excludeTypes: ["minecraft:air"],
      })
      .getCapacity() > 0
  );
}

async function loadTaskChunk(
  dimension: Dimension,
  selection: ContinentStreamingSelection,
): Promise<string> {
  const manager = world.tickingAreaManager;
  const identifier = `skyknights_continent_${selection.site.id}_${selection.task.chunkIndex}`;
  const options = {
    dimension,
    from: taskVolume(selection).from,
    to: taskVolume(selection).to,
  };

  if (manager.hasTickingArea(identifier)) {
    manager.removeTickingArea(identifier);
  }

  if (!manager.hasCapacity(options)) {
    throw new Error(
      `No ticking-area capacity is available for ${selection.site.id}.`,
    );
  }

  try {
    await manager.createTickingArea(identifier, options);

    for (
      let waited = 0;
      waited <= TICKING_AREA_LOAD_TIMEOUT_TICKS;
      waited += TICKING_AREA_RETRY_TICKS
    ) {
      if (manager.getTickingArea(identifier)?.isFullyLoaded === true) {
        return identifier;
      }

      await system.waitTicks(TICKING_AREA_RETRY_TICKS);
    }
  } catch (error) {
    if (manager.hasTickingArea(identifier)) {
      manager.removeTickingArea(identifier);
    }

    throw error;
  }

  if (manager.hasTickingArea(identifier)) {
    manager.removeTickingArea(identifier);
  }

  throw new Error(
    `Ticking area did not fully load for ${selection.site.id} chunk ${selection.task.chunkIndex}.`,
  );
}

function releaseTaskChunk(identifier: string, logger: Logger): void {
  const manager = world.tickingAreaManager;

  if (!manager.hasTickingArea(identifier)) {
    return;
  }

  try {
    manager.removeTickingArea(identifier);
  } catch (error) {
    logger.warn("Could not release the continent ticking area.", {
      identifier,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function saveCompletedChunk(
  repository: ContinentProgressRepository,
  progress: ContinentProgressState,
  selection: ContinentStreamingSelection,
): ContinentProgressState {
  const completed = completeContinentChunk(
    selection.site,
    selection.bitset,
    selection.task.chunkIndex,
  );
  const next = completeContinentChunkProgress(
    progress,
    selection.site.id,
    selection.task.chunkIndex,
    encodeContinentChunkBitset(selection.site, completed),
  );
  repository.save(next);
  return next;
}

function markContinentComplete(
  repository: WorldStateRepository,
  selection: ContinentStreamingSelection,
  progress: ContinentProgressState,
): void {
  const completed = decodeContinentChunkBitset(
    selection.site,
    progress.chunks[selection.site.id],
  );

  if (
    completed === undefined ||
    !isContinentStreamingComplete(selection.site, completed)
  ) {
    return;
  }

  const state = repository.load();

  if (state.generatedIslandIds.includes(selection.site.id)) {
    return;
  }

  repository.save({
    ...state,
    generatedIslandIds: [...state.generatedIslandIds, selection.site.id],
    islandVersions: {
      ...state.islandVersions,
      [selection.site.id]: CONTINENT_STREAMING_CONTENT_VERSION,
    },
  });
}

export async function executeContinentStreamingSelection(
  worldRepository: WorldStateRepository,
  progressRepository: ContinentProgressRepository,
  selection: ContinentStreamingSelection,
  dimensionId: string,
  logger: Logger,
): Promise<void> {
  let progress = progressRepository.load();

  if (worldRepository.load().activeGeneration !== undefined) {
    logger.info("Formula continent chunk paused for a structure job.", {
      continentId: selection.site.id,
      chunkIndex: selection.task.chunkIndex,
    });
    return;
  }

  if (selection.task.plan.empty) {
    clearContinentChunkDeferral(selection);
    progress = beginContinentChunkProgress(
      progress,
      selection.site.id,
      selection.task.chunkIndex,
    );
    progress = saveCompletedChunk(progressRepository, progress, selection);
    markContinentComplete(worldRepository, selection, progress);
    return;
  }

  const dimension = world.getDimension(dimensionId);
  const tickingAreaId = await loadTaskChunk(dimension, selection);

  try {
    if (entityOccupiesTask(dimension, selection)) {
      deferContinentChunk(selection);
      logger.info("Formula continent chunk deferred for an occupying entity.", {
        continentId: selection.site.id,
        chunkIndex: selection.task.chunkIndex,
      });
      return;
    }

    if (!selection.recovering && taskIsOccupied(dimension, selection)) {
      clearContinentChunkDeferral(selection);
      progress = beginContinentChunkProgress(
        progress,
        selection.site.id,
        selection.task.chunkIndex,
      );
      progress = saveCompletedChunk(progressRepository, progress, selection);
      logger.warn(
        "Formula continent chunk skipped to preserve existing blocks.",
        {
          continentId: selection.site.id,
          chunkIndex: selection.task.chunkIndex,
        },
      );
      markContinentComplete(worldRepository, selection, progress);
      return;
    }

    if (!selection.recovering) {
      progress = beginContinentChunkProgress(
        progress,
        selection.site.id,
        selection.task.chunkIndex,
      );
      progressRepository.save(progress);
    }

    for (
      let volumeIndex = 0;
      volumeIndex < selection.task.volumes.length;
      volumeIndex += CONTINENT_FILL_CALLS_PER_TICK
    ) {
      if (worldRepository.load().activeGeneration !== undefined) {
        logger.info("Formula continent chunk paused for a structure job.", {
          continentId: selection.site.id,
          chunkIndex: selection.task.chunkIndex,
          volumeIndex,
        });
        return;
      }

      if (entityOccupiesTask(dimension, selection)) {
        deferContinentChunk(selection);
        logger.info(
          "Formula continent chunk paused because an entity entered it.",
          {
            continentId: selection.site.id,
            chunkIndex: selection.task.chunkIndex,
            volumeIndex,
          },
        );
        return;
      }

      const batch = selection.task.volumes.slice(
        volumeIndex,
        volumeIndex + CONTINENT_FILL_CALLS_PER_TICK,
      );

      for (const volume of batch) {
        dimension.fillBlocks(
          new BlockVolume(volume.from, volume.to),
          FORMULA_CONTINENT_BLOCKS[volume.band],
          {
            blockFilter: { includeTypes: ["minecraft:air"] },
          },
        );
      }

      if (
        volumeIndex + CONTINENT_FILL_CALLS_PER_TICK <
        selection.task.volumes.length
      ) {
        await system.waitTicks(1);
      }
    }

    progress = saveCompletedChunk(
      progressRepository,
      progressRepository.load(),
      selection,
    );
    clearContinentChunkDeferral(selection);
    markContinentComplete(worldRepository, selection, progress);
    logger.info("Formula continent chunk completed.", {
      continentId: selection.site.id,
      chunkIndex: selection.task.chunkIndex,
      blocks: selection.task.plan.blocks,
      fillCalls: selection.task.volumes.length,
    });
  } finally {
    releaseTaskChunk(tickingAreaId, logger);
  }
}

export function resumeContinentStreaming(
  worldRepository: WorldStateRepository,
  observers: readonly ArchipelagoObserver[],
  logger: Logger,
  dimensionId: string = STABLE_ARCHIPELAGO_DIMENSION,
): boolean {
  if (activeContinentTask !== undefined) {
    return true;
  }

  if (system.currentTick < continentStreamingRetryTick) {
    return false;
  }

  let state = worldRepository.load();
  const progressRepository = new ContinentProgressRepository(
    world,
    state.worldSeed,
  );
  let selection: ContinentStreamingSelection | undefined;

  try {
    const progress = progressRepository.load();
    const reconciled = reconcileCompletedContinentHistory(state, progress);

    if (reconciled !== state) {
      worldRepository.save(reconciled);
      state = reconciled;
    }

    selection = selectContinentStreamingChunk(
      state,
      progress,
      observers,
      dimensionId,
      activeDeferredChunkKeys(),
    );
  } catch (error) {
    logger.error("Formula continent streaming is disabled by invalid state.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }

  if (selection === undefined) {
    return false;
  }

  activeContinentTask = monitorContinentChunk(
    worldRepository,
    progressRepository,
    selection,
    dimensionId,
    logger,
  );
  return true;
}

async function monitorContinentChunk(
  worldRepository: WorldStateRepository,
  progressRepository: ContinentProgressRepository,
  selection: ContinentStreamingSelection,
  dimensionId: string,
  logger: Logger,
): Promise<void> {
  try {
    await executeContinentStreamingSelection(
      worldRepository,
      progressRepository,
      selection,
      dimensionId,
      logger,
    );
  } catch (error) {
    deferContinentChunk(selection);
    deferAllContinentStreaming();
    logger.warn("Formula continent chunk will retry.", {
      continentId: selection.site.id,
      chunkIndex: selection.task.chunkIndex,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    activeContinentTask = undefined;
  }
}
