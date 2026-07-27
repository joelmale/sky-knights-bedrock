import { REQUIRED_ISLANDS } from "../config/constants";
import { IslandDefinition } from "../config/islands";
import { GenerationJob, WorldState } from "../persistence/schema";
import {
  ARCHIPELAGO_CONFIG,
  ARCHIPELAGO_TEMPLATES,
  ArchipelagoIsland,
  archipelagoIslandsWithinRadius,
  parseArchipelagoIslandId,
  planArchipelago,
} from "./archipelago";
import { queueGeneration } from "./state";

export const ARCHIPELAGO_CONTENT_VERSION = 1;
export const STABLE_ARCHIPELAGO_DIMENSION = "minecraft:overworld";
/**
 * Ambient IDs use the `a1_` prefix, so their coordinates must always be
 * rederived with the matching planner version. Authored-island layout
 * migrations must not silently move an already persisted ambient job.
 */
export const ARCHIPELAGO_LAYOUT_VERSION = ARCHIPELAGO_CONFIG.idVersion;

export interface ArchipelagoObserver {
  dimensionId: string;
  x: number;
  z: number;
}

function archipelagoOrigin(island: ArchipelagoIsland): {
  x: number;
  y: number;
  z: number;
} {
  const size = ARCHIPELAGO_TEMPLATES[island.family].size;

  return {
    x: island.x - Math.floor(size.x / 2),
    y: island.y,
    z: island.z - Math.floor(size.z / 2),
  };
}

export function archipelagoGenerationJobForId(
  state: Pick<WorldState, "worldSeed">,
  id: string,
  dimensionId: string = STABLE_ARCHIPELAGO_DIMENSION,
): Omit<GenerationJob, "stage" | "attempts"> | undefined {
  const island = parseArchipelagoIslandId(
    state.worldSeed,
    ARCHIPELAGO_LAYOUT_VERSION,
    id,
  );

  if (island === undefined) {
    return undefined;
  }

  return {
    id: island.id,
    contentVersion: ARCHIPELAGO_CONTENT_VERSION,
    structureId: ARCHIPELAGO_TEMPLATES[island.family].structureId,
    dimensionId,
    origin: archipelagoOrigin(island),
  };
}

export function archipelagoIslandDefinition(
  state: Pick<WorldState, "worldSeed">,
  id: string,
  dimensionId: string = STABLE_ARCHIPELAGO_DIMENSION,
): IslandDefinition | undefined {
  const island = parseArchipelagoIslandId(
    state.worldSeed,
    ARCHIPELAGO_LAYOUT_VERSION,
    id,
  );

  if (island === undefined) {
    return undefined;
  }

  const template = ARCHIPELAGO_TEMPLATES[island.family];

  return {
    id: island.id,
    family: island.family,
    tier: 0,
    structureId: template.structureId,
    dimensionId,
    contentVersion: ARCHIPELAGO_CONTENT_VERSION,
    size: template.size,
    placement: "seeded",
    gameplayActivation: "structure_only",
    integrityBlocks: template.integrityBlocks,
    anchors: {
      safeDock: {
        x: Math.floor(template.size.x / 2) + 0.5,
        y: 6,
        z: Math.floor(template.size.z / 2) + 0.5,
      },
    },
  };
}

export function isArchipelagoIslandId(
  state: Pick<WorldState, "worldSeed">,
  id: string,
): boolean {
  return (
    parseArchipelagoIslandId(
      state.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
      id,
    ) !== undefined
  );
}

function distanceSquared(
  island: ArchipelagoIsland,
  observer: ArchipelagoObserver,
): number {
  const dx = island.x - observer.x;
  const dz = island.z - observer.z;
  return dx * dx + dz * dz;
}

export function nextArchipelagoGenerationJob(
  state: WorldState,
  observers: readonly ArchipelagoObserver[],
  dimensionId: string = STABLE_ARCHIPELAGO_DIMENSION,
): Omit<GenerationJob, "stage" | "attempts"> | undefined {
  if (
    state.activeGeneration !== undefined ||
    REQUIRED_ISLANDS.some(
      (required) => !state.generatedIslandIds.includes(required.id),
    )
  ) {
    return undefined;
  }

  const generated = new Set(state.generatedIslandIds);
  const generatedAmbientCount = state.generatedIslandIds.filter((id) =>
    isArchipelagoIslandId(state, id),
  ).length;

  if (generatedAmbientCount >= ARCHIPELAGO_CONFIG.maxGeneratedIslands) {
    return undefined;
  }

  const candidates = new Map<
    string,
    { island: ArchipelagoIsland; distance: number }
  >();
  const dimensionObservers = observers.filter(
    (observer) => observer.dimensionId === dimensionId,
  );

  for (const observer of dimensionObservers) {
    for (const island of archipelagoIslandsWithinRadius(
      state.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
      observer.x,
      observer.z,
      ARCHIPELAGO_CONFIG.maxQueryRadius,
    )) {
      if (generated.has(island.id)) {
        continue;
      }

      if (
        dimensionObservers.some(
          (candidateObserver) =>
            distanceSquared(island, candidateObserver) <
            ARCHIPELAGO_CONFIG.minObserverDistance ** 2,
        )
      ) {
        continue;
      }

      const distance = distanceSquared(island, observer);
      const existing = candidates.get(island.id);

      if (existing === undefined || distance < existing.distance) {
        candidates.set(island.id, { island, distance });
      }
    }
  }

  const next = [...candidates.values()].sort(
    (left, right) =>
      left.distance - right.distance ||
      (left.island.id < right.island.id
        ? -1
        : left.island.id > right.island.id
          ? 1
          : 0),
  )[0]?.island;

  return next === undefined
    ? undefined
    : archipelagoGenerationJobForId(state, next.id, dimensionId);
}

export function queueNextArchipelagoIsland(
  state: WorldState,
  observers: readonly ArchipelagoObserver[],
  dimensionId: string = STABLE_ARCHIPELAGO_DIMENSION,
): WorldState {
  const job = nextArchipelagoGenerationJob(state, observers, dimensionId);
  return job === undefined ? state : queueGeneration(state, job);
}

export function archipelagoPersistenceBudgetBytes(state: WorldState): number {
  const ids = planArchipelago(state.worldSeed, ARCHIPELAGO_LAYOUT_VERSION)
    .map((island) => island.id)
    .slice(0, ARCHIPELAGO_CONFIG.maxGeneratedIslands);
  const islandVersions = { ...state.islandVersions };

  for (const id of ids) {
    islandVersions[id] = ARCHIPELAGO_CONTENT_VERSION;
  }

  const projected: WorldState = {
    ...state,
    generatedIslandIds: [...state.generatedIslandIds, ...ids],
    islandVersions,
  };

  return JSON.stringify(projected).length;
}
