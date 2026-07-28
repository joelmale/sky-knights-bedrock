import { REQUIRED_ISLANDS } from "../config/constants";
import { IslandDefinition } from "../config/islands";
import {
  GenerationJob,
  GenerationPart,
  WorldState,
} from "../persistence/schema";
import { fnv1a32 } from "../util/hash";
import {
  ARCHIPELAGO_CONFIG,
  ARCHIPELAGO_TEMPLATES,
  ArchipelagoFamily,
  ArchipelagoIsland,
  archipelagoClusters,
  archipelagoIslandsWithinRadius,
  parseArchipelagoIslandId,
  planArchipelago,
} from "./archipelago";
import { queueGeneration } from "./state";

export const ARCHIPELAGO_CONTENT_VERSION = 2;
export const STABLE_ARCHIPELAGO_DIMENSION = "minecraft:overworld";
/**
 * Run-2 ambient IDs use the `a2_` prefix and are always rederived with that
 * planner version. Existing `a1_` terrain remains on disk but is deliberately
 * outside the new plan and its independent generation caps.
 */
export const ARCHIPELAGO_LAYOUT_VERSION = ARCHIPELAGO_CONFIG.idVersion;

export interface ArchipelagoObserver {
  dimensionId: string;
  x: number;
  z: number;
}

const LEGACY_ID_PATTERN = /^a1_([np]\d+)_([np]\d+)$/u;
const LEGACY_LAYOUT_VERSION = 1;
const LEGACY_CONTENT_VERSION = 1;
const LEGACY_MIN_Y = 145;
const LEGACY_MAX_Y = 163;

function runtimeHash(values: readonly (string | number)[]): number {
  return fnv1a32(values.map(String).join("\0")) >>> 0;
}

function decodeLegacyCoordinate(value: string): number | undefined {
  const magnitude = Number(value.slice(1));

  if (
    !Number.isSafeInteger(magnitude) ||
    String(magnitude) !== value.slice(1) ||
    (value.startsWith("n") && magnitude === 0)
  ) {
    return undefined;
  }

  return value.startsWith("n") ? -magnitude : magnitude;
}

function legacyFamilyFor(
  worldSeed: number,
  cellX: number,
  cellZ: number,
): ArchipelagoFamily {
  const clusters = archipelagoClusters(worldSeed, LEGACY_LAYOUT_VERSION);
  let selected = clusters[0];
  let selectedDistance = Number.POSITIVE_INFINITY;

  for (const cluster of clusters) {
    const distance =
      Math.abs(cellX - cluster.cellX) + Math.abs(cellZ - cluster.cellZ);

    if (distance < selectedDistance) {
      selected = cluster;
      selectedDistance = distance;
    }
  }

  return selected.family;
}

function legacyArchipelagoIsland(
  worldSeed: number,
  id: string,
):
  | {
      id: string;
      family: ArchipelagoFamily;
      x: number;
      y: number;
      z: number;
    }
  | undefined {
  const match = LEGACY_ID_PATTERN.exec(id);

  if (match === null) {
    return undefined;
  }

  const cellX = decodeLegacyCoordinate(match[1]);
  const cellZ = decodeLegacyCoordinate(match[2]);

  if (cellX === undefined || cellZ === undefined) {
    return undefined;
  }

  const cellRadius = Math.max(Math.abs(cellX), Math.abs(cellZ));
  const x = cellX * ARCHIPELAGO_CONFIG.cellSize;
  const z = cellZ * ARCHIPELAGO_CONFIG.cellSize;

  if (
    cellRadius === 0 ||
    cellRadius > ARCHIPELAGO_CONFIG.maxCellRadius ||
    x * x + z * z < ARCHIPELAGO_CONFIG.protectedRadius ** 2 ||
    runtimeHash([
      worldSeed >>> 0,
      LEGACY_LAYOUT_VERSION,
      cellX,
      cellZ,
      "present",
    ]) %
      ARCHIPELAGO_CONFIG.generationDensity !==
      0
  ) {
    return undefined;
  }

  return {
    id,
    family: legacyFamilyFor(worldSeed, cellX, cellZ),
    x,
    y:
      LEGACY_MIN_Y +
      (runtimeHash([
        worldSeed >>> 0,
        LEGACY_LAYOUT_VERSION,
        cellX,
        cellZ,
        "height",
      ]) %
        (LEGACY_MAX_Y - LEGACY_MIN_Y + 1)),
    z,
  };
}

function soloOrigin(island: ArchipelagoIsland): GenerationJob["origin"] {
  return {
    x: island.x - Math.floor(island.size.x / 2),
    y: island.y,
    z: island.z - Math.floor(island.size.z / 2),
  };
}

function generationParts(
  island: ArchipelagoIsland,
): readonly GenerationPart[] | undefined {
  return island.parts?.map((part) => ({
    structureId: part.structureId,
    origin: part.origin,
    rotation: part.rotation,
    row: part.row,
    integrityBlock: part.integrityBlock,
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
    const legacy = legacyArchipelagoIsland(state.worldSeed, id);

    if (legacy === undefined) {
      return undefined;
    }

    const template = ARCHIPELAGO_TEMPLATES[legacy.family];

    return {
      id: legacy.id,
      contentVersion: LEGACY_CONTENT_VERSION,
      structureId: template.structureId,
      dimensionId,
      origin: {
        x: legacy.x - Math.floor(template.size.x / 2),
        y: legacy.y,
        z: legacy.z - Math.floor(template.size.z / 2),
      },
    };
  }

  const parts = generationParts(island);
  const firstPart = parts?.[0];

  return {
    id: island.id,
    contentVersion: ARCHIPELAGO_CONTENT_VERSION,
    structureId: firstPart?.structureId ?? island.template.structureId,
    dimensionId,
    origin: firstPart?.origin ?? soloOrigin(island),
    ...(parts === undefined ? {} : { parts }),
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
    const legacy = legacyArchipelagoIsland(state.worldSeed, id);

    if (legacy === undefined) {
      return undefined;
    }

    const template = ARCHIPELAGO_TEMPLATES[legacy.family];

    return {
      id: legacy.id,
      family: legacy.family,
      tier: 0,
      structureId: template.structureId,
      dimensionId,
      contentVersion: LEGACY_CONTENT_VERSION,
      size: template.size,
      placement: "seeded",
      gameplayActivation: "structure_only",
      integrityBlocks: template.integrityBlocks,
      anchors: {
        safeDock: {
          x: template.safeDock.x + 0.5,
          y: template.safeDock.y,
          z: template.safeDock.z + 0.5,
        },
      },
    };
  }

  const job = archipelagoGenerationJobForId(state, id, dimensionId);

  if (job === undefined) {
    return undefined;
  }

  const integrityBlocks =
    job.parts?.map((part) => ({
      offset: {
        x: part.origin.x + part.integrityBlock.offset.x - job.origin.x,
        y: part.origin.y + part.integrityBlock.offset.y - job.origin.y,
        z: part.origin.z + part.integrityBlock.offset.z - job.origin.z,
      },
      typeId: part.integrityBlock.typeId,
    })) ?? island.template.integrityBlocks;
  const logicalOrigin = soloOrigin(island);

  return {
    id: island.id,
    // IslandDefinition's gameplay families intentionally stay the four
    // progression palettes. Continents use the family-neutral temperate kit,
    // whose closest gameplay palette is Verdant.
    family: island.family === "continent" ? "verdant" : island.family,
    tier: 0,
    structureId: job.structureId,
    dimensionId,
    contentVersion: ARCHIPELAGO_CONTENT_VERSION,
    size: island.size,
    placement: "seeded",
    gameplayActivation: "structure_only",
    integrityBlocks,
    anchors: {
      safeDock: {
        x: logicalOrigin.x + island.template.safeDock.x - job.origin.x + 0.5,
        y: island.template.safeDock.y,
        z: logicalOrigin.z + island.template.safeDock.z - job.origin.z + 0.5,
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

function generatedArchipelagoIslands(
  state: WorldState,
): readonly ArchipelagoIsland[] {
  const islands: ArchipelagoIsland[] = [];

  for (const id of state.generatedIslandIds) {
    const island = parseArchipelagoIslandId(
      state.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
      id,
    );

    if (island !== undefined) {
      islands.push(island);
    }
  }

  return islands;
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
  const generatedArchipelago = generatedArchipelagoIslands(state);
  const generatedSoloCount = generatedArchipelago.filter(
    (island) => island.tier !== "continent",
  ).length;
  const generatedContinentCount = generatedArchipelago.filter(
    (island) => island.tier === "continent",
  ).length;
  const soloCapReached =
    generatedSoloCount >= ARCHIPELAGO_CONFIG.maxGeneratedIslands;
  const continentCapReached =
    generatedContinentCount >= ARCHIPELAGO_CONFIG.maxGeneratedContinents;

  if (soloCapReached && continentCapReached) {
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
        (island.tier === "continent" && continentCapReached) ||
        (island.tier !== "continent" && soloCapReached)
      ) {
        continue;
      }

      if (
        dimensionObservers.some(
          (candidateObserver) =>
            distanceSquared(island, candidateObserver) <
            island.observerClearance ** 2,
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
  const plan = planArchipelago(state.worldSeed, ARCHIPELAGO_LAYOUT_VERSION);
  const ids = [
    ...plan
      .filter((island) => island.tier !== "continent")
      .slice(0, ARCHIPELAGO_CONFIG.maxGeneratedIslands),
    ...plan
      .filter((island) => island.tier === "continent")
      .slice(0, ARCHIPELAGO_CONFIG.maxGeneratedContinents),
  ].map((island) => island.id);
  const islandVersions = { ...state.islandVersions };
  const generatedIslandIds = new Set(state.generatedIslandIds);

  for (const id of ids) {
    islandVersions[id] = ARCHIPELAGO_CONTENT_VERSION;
    generatedIslandIds.add(id);
  }

  const projected: WorldState = {
    ...state,
    generatedIslandIds: [...generatedIslandIds],
    islandVersions,
  };

  return JSON.stringify(projected).length;
}
