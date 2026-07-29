import { REQUIRED_ISLANDS } from "../config/constants";
import { IslandDefinition } from "../config/islands";
import { compactWorldDocument } from "../persistence/compact";
import {
  GenerationJob,
  GenerationPart,
  WorldState,
} from "../persistence/schema";
import { fnv1a32 } from "../util/hash";
import {
  ARCHIPELAGO_CONFIG as ARCHIPELAGO_V2_CONFIG,
  ARCHIPELAGO_TEMPLATES,
  ArchipelagoFamily,
  ArchipelagoIsland,
  archipelagoClusters,
  archipelagoContinentAnchors,
  archipelagoIslandsWithinRadius,
  deriveArchipelagoIsland,
  parseArchipelagoIslandId,
  planArchipelago,
} from "./archipelago";
import {
  ARCHIPELAGO_V3_CONFIG,
  ArchipelagoV3Island,
  archipelagoV3IslandsWithinRadius,
  parseArchipelagoV3IslandId,
  planArchipelagoV3,
} from "./archipelago-v3";
import { queueGeneration } from "./state";

/** Frozen run-2 content version retained for a2 jobs and tests. */
export const ARCHIPELAGO_CONTENT_VERSION = 2;
export const ARCHIPELAGO_V3_CONTENT_VERSION = 3;
export const STABLE_ARCHIPELAGO_DIMENSION = "minecraft:overworld";
/**
 * Frozen a2 layout version. New placement uses the independent a3 planner;
 * keeping this export at 2 prevents interrupted a2 jobs from being rederived
 * with a different seed contract.
 */
export const ARCHIPELAGO_LAYOUT_VERSION = ARCHIPELAGO_V2_CONFIG.idVersion;
export const ARCHIPELAGO_ACTIVE_LAYOUT_VERSION =
  ARCHIPELAGO_V3_CONFIG.idVersion;

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
  const x = cellX * ARCHIPELAGO_V2_CONFIG.cellSize;
  const z = cellZ * ARCHIPELAGO_V2_CONFIG.cellSize;

  if (
    cellRadius === 0 ||
    cellRadius > ARCHIPELAGO_V2_CONFIG.maxCellRadius ||
    x * x + z * z < ARCHIPELAGO_V2_CONFIG.protectedRadius ** 2 ||
    runtimeHash([
      worldSeed >>> 0,
      LEGACY_LAYOUT_VERSION,
      cellX,
      cellZ,
      "present",
    ]) %
      ARCHIPELAGO_V2_CONFIG.generationDensity !==
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

function v3Origin(island: ArchipelagoV3Island): GenerationJob["origin"] {
  return {
    x: island.x - Math.floor(island.size.x / 2),
    y: island.y,
    z: island.z - Math.floor(island.size.z / 2),
  };
}

function v3GenerationParts(
  island: ArchipelagoV3Island,
): readonly GenerationPart[] | undefined {
  if (island.template.parts.length <= 1) {
    return undefined;
  }

  const origin = v3Origin(island);
  return island.template.parts.map((part) => ({
    structureId: part.structureId,
    origin: {
      x: origin.x + part.relativeOrigin.x,
      y: origin.y + part.relativeOrigin.y,
      z: origin.z + part.relativeOrigin.z,
    },
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
  const v3Island = parseArchipelagoV3IslandId(state.worldSeed, id);

  if (v3Island !== undefined) {
    const parts = v3GenerationParts(v3Island);
    const firstPart = parts?.[0];

    return {
      id: v3Island.id,
      contentVersion: ARCHIPELAGO_V3_CONTENT_VERSION,
      structureId: firstPart?.structureId ?? v3Island.template.structureId,
      dimensionId,
      origin: firstPart?.origin ?? v3Origin(v3Island),
      ...(parts === undefined ? {} : { parts }),
    };
  }

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
  const v3Island = parseArchipelagoV3IslandId(state.worldSeed, id);

  if (v3Island !== undefined) {
    const job = archipelagoGenerationJobForId(state, id, dimensionId);

    if (job === undefined) {
      return undefined;
    }

    const logicalOrigin = v3Origin(v3Island);
    const integrityBlocks =
      job.parts?.map((part) => ({
        offset: {
          x: part.origin.x + part.integrityBlock.offset.x - job.origin.x,
          y: part.origin.y + part.integrityBlock.offset.y - job.origin.y,
          z: part.origin.z + part.integrityBlock.offset.z - job.origin.z,
        },
        typeId: part.integrityBlock.typeId,
      })) ?? v3Island.template.integrityBlocks;

    return {
      id: v3Island.id,
      family: v3Island.family,
      tier: 0,
      structureId: job.structureId,
      dimensionId,
      contentVersion: ARCHIPELAGO_V3_CONTENT_VERSION,
      size: v3Island.size,
      placement: "seeded",
      gameplayActivation: "structure_only",
      integrityBlocks,
      anchors: {
        safeDock: {
          x:
            logicalOrigin.x + v3Island.template.safeDock.x - job.origin.x + 0.5,
          y: v3Island.template.safeDock.y,
          z:
            logicalOrigin.z + v3Island.template.safeDock.z - job.origin.z + 0.5,
        },
      },
    };
  }

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
    parseArchipelagoV3IslandId(state.worldSeed, id) !== undefined ||
    parseArchipelagoIslandId(
      state.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
      id,
    ) !== undefined
  );
}

function distanceSquared(
  island: Pick<ArchipelagoIsland | ArchipelagoV3Island, "x" | "z">,
  observer: ArchipelagoObserver,
): number {
  const dx = island.x - observer.x;
  const dz = island.z - observer.z;
  return dx * dx + dz * dz;
}

function generatedV3Islands(state: WorldState): readonly ArchipelagoV3Island[] {
  const islands: ArchipelagoV3Island[] = [];

  for (const id of state.generatedIslandIds) {
    const island = parseArchipelagoV3IslandId(state.worldSeed, id);

    if (island !== undefined) {
      islands.push(island);
    }
  }

  return islands;
}

function generatedV2Continents(
  state: WorldState,
): readonly ArchipelagoIsland[] {
  const islands: ArchipelagoIsland[] = [];

  for (const id of state.generatedIslandIds) {
    const island = parseArchipelagoIslandId(
      state.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
      id,
    );

    if (island?.tier === "continent") {
      islands.push(island);
    }
  }

  return islands;
}

type AmbientCandidate = ArchipelagoIsland | ArchipelagoV3Island;

function ambientIslandsIntersect(
  left: Pick<
    AmbientCandidate,
    "x" | "y" | "z" | "size" | "radius" | "heightRadius"
  >,
  right: Pick<
    AmbientCandidate,
    "x" | "y" | "z" | "size" | "radius" | "heightRadius"
  >,
): boolean {
  const dx = left.x - right.x;
  const dz = left.z - right.z;
  const horizontalClearance = left.radius + right.radius;

  if (dx * dx + dz * dz >= horizontalClearance * horizontalClearance) {
    return false;
  }

  const leftCenterY = left.y + Math.floor(left.size.y / 2);
  const rightCenterY = right.y + Math.floor(right.size.y / 2);
  return (
    Math.abs(leftCenterY - rightCenterY) <
    left.heightRadius + right.heightRadius
  );
}

function plannedV2Continents(worldSeed: number): readonly ArchipelagoIsland[] {
  const result: ArchipelagoIsland[] = [];

  for (const anchor of archipelagoContinentAnchors(
    worldSeed,
    ARCHIPELAGO_LAYOUT_VERSION,
  )) {
    const island = deriveArchipelagoIsland(
      worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
      anchor.cellX,
      anchor.cellZ,
    );

    if (island?.tier === "continent") {
      result.push(island);
    }
  }

  return result;
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
  const generatedSoloCount = generatedV3Islands(state).length;
  const generatedContinentCount = generatedV2Continents(state).length;
  const soloCapReached =
    generatedSoloCount >= ARCHIPELAGO_V3_CONFIG.maxGeneratedIslands;
  const continentCapReached =
    generatedContinentCount >= ARCHIPELAGO_V2_CONFIG.maxGeneratedContinents;

  if (soloCapReached && continentCapReached) {
    return undefined;
  }

  const candidates = new Map<
    string,
    { island: AmbientCandidate; distance: number }
  >();
  const dimensionObservers = observers.filter(
    (observer) => observer.dimensionId === dimensionId,
  );
  const reservedContinents = plannedV2Continents(state.worldSeed);

  for (const observer of dimensionObservers) {
    const nearby: AmbientCandidate[] = [];

    if (!soloCapReached) {
      nearby.push(
        ...archipelagoV3IslandsWithinRadius(
          state.worldSeed,
          observer.x,
          observer.z,
          ARCHIPELAGO_V3_CONFIG.maxQueryRadius,
        ).filter(
          (island) =>
            !reservedContinents.some((continent) =>
              ambientIslandsIntersect(island, continent),
            ),
        ),
      );
    }

    if (!continentCapReached) {
      nearby.push(
        ...archipelagoIslandsWithinRadius(
          state.worldSeed,
          ARCHIPELAGO_LAYOUT_VERSION,
          observer.x,
          observer.z,
          ARCHIPELAGO_V2_CONFIG.maxQueryRadius,
        ).filter((island) => island.tier === "continent"),
      );
    }

    for (const island of nearby) {
      if (generated.has(island.id)) {
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
      (left.island.tier === "continent" ? 0 : 1) -
        (right.island.tier === "continent" ? 0 : 1) ||
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
  const islandVersions = { ...state.islandVersions };
  const generatedIslandIds = new Set(state.generatedIslandIds);
  // Worst case, not the cheapest case. The plan is ordered by site index and
  // ids are `a3_<base36 index>`, so slicing the first N took the lowest
  // indices and therefore the shortest ids. Islands are actually generated by
  // player proximity and can come from anywhere in the index space, so that
  // under-reported the real cost by about 12% and made the budget guard
  // report a world safe when it was not. Take the longest ids instead.
  const soloIds = planArchipelagoV3(state.worldSeed)
    .map((island) => island.id)
    .sort(
      (left, right) => right.length - left.length || (left < right ? -1 : 1),
    )
    .slice(0, ARCHIPELAGO_V3_CONFIG.maxGeneratedIslands);
  const continentIds = planArchipelago(
    state.worldSeed,
    ARCHIPELAGO_LAYOUT_VERSION,
  )
    .filter((island) => island.tier === "continent")
    .slice(0, ARCHIPELAGO_V2_CONFIG.maxGeneratedContinents)
    .map((island) => island.id);

  for (const id of soloIds) {
    islandVersions[id] = ARCHIPELAGO_V3_CONTENT_VERSION;
    generatedIslandIds.add(id);
  }
  for (const id of continentIds) {
    islandVersions[id] = ARCHIPELAGO_CONTENT_VERSION;
    generatedIslandIds.add(id);
  }

  const projected: WorldState = {
    ...state,
    generatedIslandIds: [...generatedIslandIds],
    islandVersions,
  };

  // Measure the compacted form, which is what actually reaches the dynamic
  // property. Measuring the in-memory string[] over-reported by ~65x once a3
  // ids became a bitset.
  return JSON.stringify(compactWorldDocument(projected)).length;
}
