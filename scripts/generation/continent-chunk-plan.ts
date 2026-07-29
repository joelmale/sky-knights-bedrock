/**
 * Per-chunk description of continent terrain.
 *
 * Turns the pure height field in `continent-field.ts` into the geometry a chunk
 * generator needs: which columns are land, and which volumes to fill them with.
 * This module is still host-side and pure — it produces the fill instructions
 * but never issues them. Calling `Dimension.fillBlocks` is gated on the
 * throughput measurement the design doc names as its largest risk.
 *
 * Decomposition strategy
 * ----------------------
 * A naive per-column, per-band emission costs 256 * 3 volumes per chunk, which
 * would be several hundred `fillBlocks` calls. Instead the chunk's band voxels
 * are greedily merged into axis-aligned boxes: grow along X, then Z, then Y,
 * consuming cells as they are claimed. The core band, which is the bulk of the
 * mass, collapses into a handful of tall boxes; only the thin shell that
 * follows the relief costs one box per flat run. The emitted boxes tile the
 * band voxels exactly — no overlap, no gaps.
 */

import type {
  ContinentBand,
  ContinentColumn,
  ContinentField,
} from "./continent-field";
import {
  boxIntersectsContinent,
  buildColumn,
  maxColumnHeight,
  strataAt,
} from "./continent-field";

export const CHUNK_SIZE = 16;
const CHUNK_COLUMNS = CHUNK_SIZE * CHUNK_SIZE;

export type ContinentFillBand = Exclude<ContinentBand, "air">;

const BAND_IDS: readonly ContinentFillBand[] = [
  "core",
  "subsurface",
  "surface",
  "water",
];

export interface ContinentFillVolume {
  readonly band: ContinentFillBand;
  readonly from: { readonly x: number; readonly y: number; readonly z: number };
  readonly to: { readonly x: number; readonly y: number; readonly z: number };
  readonly blocks: number;
}

export interface ContinentChunkPlan {
  readonly chunkX: number;
  readonly chunkZ: number;
  readonly originX: number;
  readonly originZ: number;
  /** True when the chunk holds no continent blocks at all. */
  readonly empty: boolean;
  readonly landColumns: number;
  readonly lakeColumns: number;
  /** Inclusive Y span actually written. Both are `field.baseY` when empty. */
  readonly minY: number;
  readonly maxY: number;
  readonly volumes: readonly ContinentFillVolume[];
  readonly blocks: number;
  readonly waterBlocks: number;
}

/**
 * Ceiling on blocks a single chunk of this field can contain. Every land column
 * runs from `baseY` to at most `baseY + amplitude + ridgeAmplitude`, and water
 * only ever replaces air above a carved bed, so it cannot raise the total.
 */
export function chunkBlockCeiling(field: ContinentField): number {
  return CHUNK_COLUMNS * maxColumnHeight(field);
}

function emptyPlan(
  field: ContinentField,
  chunkX: number,
  chunkZ: number,
): ContinentChunkPlan {
  return {
    chunkX,
    chunkZ,
    originX: chunkX * CHUNK_SIZE,
    originZ: chunkZ * CHUNK_SIZE,
    empty: true,
    landColumns: 0,
    lakeColumns: 0,
    minY: field.baseY,
    maxY: field.baseY,
    volumes: [],
    blocks: 0,
    waterBlocks: 0,
  };
}

function bandId(band: ContinentBand): number {
  switch (band) {
    case "core":
      return 1;
    case "subsurface":
      return 2;
    case "surface":
      return 3;
    case "water":
      return 4;
    default:
      return 0;
  }
}

/**
 * Greedy 3D box merge over a band-id voxel grid. Grows along X, then Z, then Y,
 * claiming cells as it goes, so the emitted boxes tile the grid exactly.
 */
function mergeBoxes(
  grid: Uint8Array,
  originX: number,
  originZ: number,
  minY: number,
  levels: number,
  volumes: ContinentFillVolume[],
): number {
  const claimed = new Uint8Array(grid.length);
  const layer = CHUNK_COLUMNS;
  let blocks = 0;

  for (let level = 0; level < levels; level += 1) {
    const base = level * layer;
    for (let z = 0; z < CHUNK_SIZE; z += 1) {
      for (let x = 0; x < CHUNK_SIZE; x += 1) {
        const start = base + z * CHUNK_SIZE + x;
        const id = grid[start];
        if (id === 0 || claimed[start] === 1) continue;

        let width = 1;
        while (
          x + width < CHUNK_SIZE &&
          grid[start + width] === id &&
          claimed[start + width] === 0
        ) {
          width += 1;
        }

        let depth = 1;
        for (let nz = z + 1; nz < CHUNK_SIZE; nz += 1) {
          let full = true;
          for (let nx = x; nx < x + width; nx += 1) {
            const index = base + nz * CHUNK_SIZE + nx;
            if (grid[index] !== id || claimed[index] === 1) {
              full = false;
              break;
            }
          }
          if (!full) break;
          depth += 1;
        }

        let height = 1;
        for (let ny = level + 1; ny < levels; ny += 1) {
          let full = true;
          for (let nz = z; nz < z + depth && full; nz += 1) {
            for (let nx = x; nx < x + width; nx += 1) {
              const index = ny * layer + nz * CHUNK_SIZE + nx;
              if (grid[index] !== id || claimed[index] === 1) {
                full = false;
                break;
              }
            }
          }
          if (!full) break;
          height += 1;
        }

        for (let ny = level; ny < level + height; ny += 1) {
          for (let nz = z; nz < z + depth; nz += 1) {
            for (let nx = x; nx < x + width; nx += 1) {
              claimed[ny * layer + nz * CHUNK_SIZE + nx] = 1;
            }
          }
        }

        const count = width * depth * height;
        blocks += count;
        volumes.push({
          band: BAND_IDS[id - 1],
          from: { x: originX + x, y: minY + level, z: originZ + z },
          to: {
            x: originX + x + width - 1,
            y: minY + level + height - 1,
            z: originZ + z + depth - 1,
          },
          blocks: count,
        });
      }
    }
  }

  return blocks;
}

/**
 * Describe one chunk. Rejects immediately when the chunk cannot touch the
 * continent — the common case near a continent's edge, and the reason a
 * continent costs nothing to have in the world until a player approaches it.
 */
export function planContinentChunk(
  field: ContinentField,
  chunkX: number,
  chunkZ: number,
): ContinentChunkPlan {
  const originX = chunkX * CHUNK_SIZE;
  const originZ = chunkZ * CHUNK_SIZE;

  if (
    !boxIntersectsContinent(
      field,
      originX,
      originZ,
      originX + CHUNK_SIZE - 1,
      originZ + CHUNK_SIZE - 1,
    )
  ) {
    return emptyPlan(field, chunkX, chunkZ);
  }

  const anchorCache = new Map<number, number>();
  const columns: ContinentColumn[] = new Array(CHUNK_COLUMNS);
  let landColumns = 0;
  let lakeColumns = 0;
  let maxY = field.baseY - 1;

  for (let z = 0; z < CHUNK_SIZE; z += 1) {
    for (let x = 0; x < CHUNK_SIZE; x += 1) {
      const column = buildColumn(field, originX + x, originZ + z, anchorCache);
      columns[z * CHUNK_SIZE + x] = column;
      if (!column.land) continue;
      landColumns += 1;
      if (column.lake) lakeColumns += 1;
      const top = Math.max(column.solidTopY, column.waterTopY);
      if (top > maxY) maxY = top;
    }
  }

  if (landColumns === 0) return emptyPlan(field, chunkX, chunkZ);

  const minY = field.baseY;
  const levels = maxY - minY + 1;
  const grid = new Uint8Array(levels * CHUNK_COLUMNS);
  let waterBlocks = 0;

  for (let level = 0; level < levels; level += 1) {
    const y = minY + level;
    const base = level * CHUNK_COLUMNS;
    for (let index = 0; index < CHUNK_COLUMNS; index += 1) {
      const id = bandId(strataAt(field, columns[index], y));
      grid[base + index] = id;
      if (id === 4) waterBlocks += 1;
    }
  }

  const volumes: ContinentFillVolume[] = [];
  const blocks = mergeBoxes(grid, originX, originZ, minY, levels, volumes);

  return {
    chunkX,
    chunkZ,
    originX,
    originZ,
    empty: false,
    landColumns,
    lakeColumns,
    minY,
    maxY,
    volumes,
    blocks,
    waterBlocks,
  };
}

/** Inclusive chunk-coordinate bounds covering the whole footprint. */
export function continentChunkBounds(field: ContinentField): {
  minChunkX: number;
  minChunkZ: number;
  maxChunkX: number;
  maxChunkZ: number;
} {
  return {
    minChunkX: (field.centerX - field.radius) >> 4,
    minChunkZ: (field.centerZ - field.radius) >> 4,
    maxChunkX: (field.centerX + field.radius) >> 4,
    maxChunkZ: (field.centerZ + field.radius) >> 4,
  };
}
