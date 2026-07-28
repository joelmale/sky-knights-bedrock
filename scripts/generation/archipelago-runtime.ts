import { REQUIRED_ISLANDS } from "../config/constants";
import { IslandDefinition } from "../config/islands";
import {
  GenerationJob,
  GenerationPart,
  WorldState,
} from "../persistence/schema";
import {
  ARCHIPELAGO_CONFIG,
  ARCHIPELAGO_TEMPLATES,
  ArchipelagoIsland,
  ArchipelagoPart,
  archipelagoIntegrityBlocks,
  archipelagoIslandOrigin,
  archipelagoIslandsWithinRadius,
  archipelagoMinObserverDistance,
  archipelagoTemplateKey,
  parseArchipelagoIslandId,
  planArchipelago,
} from "./archipelago";
import { queueGeneration } from "./state";

/**
 * Bumped alongside `ARCHIPELAGO_CONFIG.idVersion`: the ambient tier system,
 * altitude bands, and composed continents are all new content.
 */
export const ARCHIPELAGO_CONTENT_VERSION = 2;
export const STABLE_ARCHIPELAGO_DIMENSION = "minecraft:overworld";
/**
 * Ambient IDs carry the planner version in their prefix, so their coordinates
 * must always be rederived with the matching planner version. Authored-island
 * layout migrations must not silently move an already persisted ambient job.
 */
export const ARCHIPELAGO_LAYOUT_VERSION = ARCHIPELAGO_CONFIG.idVersion;

export interface ArchipelagoObserver {
  dimensionId: string;
  x: number;
  z: number;
}

function generationParts(
  island: ArchipelagoIsland,
): readonly GenerationPart[] | undefined {
  if (island.parts === undefined) {
    return undefined;
  }

  return island.parts.map((part: ArchipelagoPart) => ({
    structureId: part.structureId,
    origin: { ...part.origin },
    rotation: part.rotation,
    row: part.row,
    size: { ...part.size },
    integrityBlock: {
      offset: { ...part.integrityBlock.offset },
      typeId: part.integrityBlock.typeId,
    },
  }));
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
    // `structureId` describes part 0 and `origin` is always the whole island's
    // footprint corner, so `structureBounds(job.origin, island.size)` and the
    // island's integrity offsets stay meaningful for composed islands too.
    structureId: island.structureId,
    dimensionId,
    origin: archipelagoIslandOrigin(island),
    parts: generationParts(island),
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

  const template =
    ARCHIPELAGO_TEMPLATES[
      archipelagoTemplateKey(island.tier, island.family, island.variant)
    ];

  return {
    id: island.id,
    family: island.family,
    tier: 0,
    structureId: island.structureId,
    dimensionId,
    contentVersion: ARCHIPELAGO_CONTENT_VERSION,
    size: island.size,
    placement: "seeded",
    gameplayActivation: "structure_only",
    integrityBlocks: archipelagoIntegrityBlocks(island),
    anchors: {
      safeDock: {
        x: Math.floor(island.size.x / 2) + 0.5,
        // Per-tier surface datum. A flat 6 was only ever correct for the
        // 10-tall standard template; on a crag or landmark it would drop the
        // recovery teleport inside solid rock.
        y: template.dockY,
        z: Math.floor(island.size.z / 2) + 0.5,
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

export function isArchipelagoContinentId(
  state: Pick<WorldState, "worldSeed">,
  id: string,
): boolean {
  return (
    parseArchipelagoIslandId(state.worldSeed, ARCHIPELAGO_LAYOUT_VERSION, id)
      ?.tier === "continent"
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
  let generatedAmbientCount = 0;
  let generatedContinentCount = 0;

  // NOTE: `isArchipelagoIslandId` reparses against the CURRENT layout version,
  // so ids from an earlier planner version deliberately do not count against
  // either budget. Those islands remain on disk as inert terrain.
  for (const id of state.generatedIslandIds) {
    const island = parseArchipelagoIslandId(
      state.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
      id,
    );

    if (island === undefined) {
      continue;
    }

    if (island.tier === "continent") {
      generatedContinentCount += 1;
    } else {
      generatedAmbientCount += 1;
    }
  }

  const ambientBudgetSpent =
    generatedAmbientCount >= ARCHIPELAGO_CONFIG.maxGeneratedIslands;
  const continentBudgetSpent =
    generatedContinentCount >= ARCHIPELAGO_CONFIG.maxGeneratedContinents;

  if (ambientBudgetSpent && continentBudgetSpent) {
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

      if (island.tier === "continent" ? continentBudgetSpent : ambientBudgetSpent) {
        continue;
      }

      // Clearance scales with the island: 48 for islets through standards, 57
      // for a landmark, 137 for a continent.
      const clearance = archipelagoMinObserverDistance(island);

      if (
        dimensionObservers.some(
          (candidateObserver) =>
            distanceSquared(island, candidateObserver) < clearance * clearance,
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

/**
 * Worst-case persisted size once the ambient budget is spent. A continent adds
 * exactly one id like any other island — its 21 components live in the active
 * job while it is being raised and are gone once it completes — so the
 * projection stays a plain id/version count.
 */
export function archipelagoPersistenceBudgetBytes(state: WorldState): number {
  const ids = planArchipelago(state.worldSeed, ARCHIPELAGO_LAYOUT_VERSION)
    .map((island) => island.id)
    .slice(
      0,
      ARCHIPELAGO_CONFIG.maxGeneratedIslands +
        ARCHIPELAGO_CONFIG.maxGeneratedContinents,
    );
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
