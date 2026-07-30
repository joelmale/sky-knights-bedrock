/**
 * Tick-budgeted fill plan for one ambient island's terrain.
 *
 * Slice 2 of the procedural-island program. The field says what the terrain is;
 * this says how to write it without stalling a tick, and where the arrival pad
 * must be levelled.
 *
 * It reuses `planContinentChunk` unchanged, because an island field is a
 * `ContinentField` with the island profile. The measured shape of that reuse:
 *
 *   tier      chunks  volumes  maxVolume  blocks
 *   islet          4      189         32     938
 *   standard       4      427         64   3,105
 *   crag          14    1,475        256  14,409
 *   landmark      29    5,506      7,424 100,883
 *
 * No volume approaches the 32,768-block `fillBlocks` ceiling the BDS benchmark
 * established, so the cap is never the constraint. The constraint is the number
 * of calls: relief means adjacent columns differ in height, so boxes merge
 * poorly and the average island volume is only about 18 blocks. Budgeting four
 * calls per tick — the conservative continent rule — would spend 1,377 ticks,
 * about 69 seconds, on a single landmark.
 *
 * The benchmark measured a 10,240-block fill at roughly 6 ms and found four
 * 8,192-block fills cost about the same as one 32,768-block fill, so cost tracks
 * blocks written far more than calls issued. Batching is therefore bounded by
 * both a block budget and a call budget, with the block budget doing the real
 * work and the call budget only guarding against pathological fragmentation.
 */

import {
  CHUNK_SIZE,
  ContinentChunkPlan,
  ContinentFillVolume,
  continentChunkBounds,
  planContinentChunk,
} from "./continent-chunk-plan";
import { ContinentField, surfaceY } from "./continent-field";

/**
 * Blocks written per tick.
 *
 * The benchmark host wrote 10,240 blocks in about 6 ms. 24,576 is a little over
 * twice that, so roughly 15 ms of a 50 ms tick, leaving the rest of the frame to
 * the game. Deliberately conservative: the weakest target device has not been
 * measured, and this is the number to lower if it disappoints.
 */
export const ISLAND_FILL_BLOCK_BUDGET = 24_576;

/**
 * Fill calls per tick, regardless of how small they are.
 *
 * Only a guard. Island volumes average about 18 blocks, so without this a
 * heavily fragmented island could issue thousands of tiny calls inside one
 * block budget and pay per-call overhead the block budget cannot see.
 */
export const ISLAND_FILL_CALL_BUDGET = 96;

/** Radius of the levelled arrival pad, in blocks. */
export const ISLAND_DOCK_PAD_RADIUS = 3;

/** One tick's worth of fill work. */
export interface IslandFillBatch {
  readonly volumes: readonly ContinentFillVolume[];
  readonly blocks: number;
}

export interface IslandTerrainPlan {
  readonly chunks: number;
  readonly volumes: number;
  readonly blocks: number;
  /** Ordered batches. One batch is intended to be one tick of work. */
  readonly batches: readonly IslandFillBatch[];
  /** Deterministic arrival point, already levelled by `dockPad`. */
  readonly dock: { readonly x: number; readonly y: number; readonly z: number };
  /**
   * The pad volume whose top face must be flat at `dock.y - 1`.
   *
   * A real height field breaks the assumption the arrival path was built on:
   * the old authored islands had one constant surface height, so the dock
   * anchor was always valid. With relief, an unlevelled anchor drops the player
   * inside terrain or leaves them standing in air.
   */
  readonly dockPad: {
    readonly from: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
    readonly to: { readonly x: number; readonly y: number; readonly z: number };
  };
}

function volumeBlocks(volume: ContinentFillVolume): number {
  return (
    (volume.to.x - volume.from.x + 1) *
    (volume.to.y - volume.from.y + 1) *
    (volume.to.z - volume.from.z + 1)
  );
}

/**
 * The levelled arrival height for an island.
 *
 * Taken from the field's own surface at the island centre, so it is derived
 * rather than stored and can never disagree with the terrain around it.
 */
export function islandDockSurfaceY(field: ContinentField): number {
  return surfaceY(field, field.centerX, field.centerZ);
}

/**
 * Builds the ordered fill plan for an island.
 *
 * Batches are cut at whichever budget is reached first. A single volume larger
 * than the block budget is emitted alone rather than split, because the
 * benchmark showed one large fill is not more expensive than several small ones
 * totalling the same blocks, and splitting would only add calls.
 */
export function planIslandTerrain(
  field: ContinentField,
  options: {
    readonly blockBudget?: number;
    readonly callBudget?: number;
  } = {},
): IslandTerrainPlan {
  const blockBudget = Math.max(
    1,
    Math.trunc(options.blockBudget ?? ISLAND_FILL_BLOCK_BUDGET),
  );
  const callBudget = Math.max(
    1,
    Math.trunc(options.callBudget ?? ISLAND_FILL_CALL_BUDGET),
  );
  const bounds = continentChunkBounds(field);
  const batches: IslandFillBatch[] = [];

  let current: ContinentFillVolume[] = [];
  let currentBlocks = 0;
  let chunks = 0;
  let volumes = 0;
  let blocks = 0;

  const flush = (): void => {
    if (current.length === 0) {
      return;
    }

    batches.push({ volumes: current, blocks: currentBlocks });
    current = [];
    currentBlocks = 0;
  };

  // Chunk-major order, ascending. Deterministic, and it keeps each batch local
  // so a ticking area covers the whole batch.
  for (let chunkX = bounds.minChunkX; chunkX <= bounds.maxChunkX; chunkX += 1) {
    for (
      let chunkZ = bounds.minChunkZ;
      chunkZ <= bounds.maxChunkZ;
      chunkZ += 1
    ) {
      const plan: ContinentChunkPlan = planContinentChunk(
        field,
        chunkX,
        chunkZ,
      );

      if (plan.volumes.length === 0) {
        continue;
      }

      chunks += 1;

      for (const volume of plan.volumes) {
        const size = volumeBlocks(volume);

        if (
          current.length > 0 &&
          (currentBlocks + size > blockBudget ||
            current.length + 1 > callBudget)
        ) {
          flush();
        }

        current.push(volume);
        currentBlocks += size;
        volumes += 1;
        blocks += size;
      }
    }
  }

  flush();

  const padSurface = islandDockSurfaceY(field);

  return {
    chunks,
    volumes,
    blocks,
    batches,
    dock: { x: field.centerX, y: padSurface + 1, z: field.centerZ },
    dockPad: {
      from: {
        x: field.centerX - ISLAND_DOCK_PAD_RADIUS,
        y: padSurface,
        z: field.centerZ - ISLAND_DOCK_PAD_RADIUS,
      },
      to: {
        x: field.centerX + ISLAND_DOCK_PAD_RADIUS,
        y: padSurface,
        z: field.centerZ + ISLAND_DOCK_PAD_RADIUS,
      },
    },
  };
}

/** Chunk span an island occupies, for ticking-area sizing. */
export function islandChunkSpan(field: ContinentField): {
  readonly chunksX: number;
  readonly chunksZ: number;
} {
  const bounds = continentChunkBounds(field);
  return {
    chunksX: bounds.maxChunkX - bounds.minChunkX + 1,
    chunksZ: bounds.maxChunkZ - bounds.minChunkZ + 1,
  };
}

export { CHUNK_SIZE };
