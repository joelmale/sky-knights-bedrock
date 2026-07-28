import { describe, expect, it } from "vitest";

import { REQUIRED_ISLANDS } from "../scripts/config/constants";
import {
  ARCHIPELAGO_CONFIG,
  ArchipelagoIsland,
  parseArchipelagoIslandId,
  planArchipelago,
} from "../scripts/generation/archipelago";
import {
  ARCHIPELAGO_CONTENT_VERSION,
  ARCHIPELAGO_LAYOUT_VERSION,
  STABLE_ARCHIPELAGO_DIMENSION,
  archipelagoGenerationJobForId,
  archipelagoIslandDefinition,
  archipelagoPersistenceBudgetBytes,
  nextArchipelagoGenerationJob,
  queueNextArchipelagoIsland,
} from "../scripts/generation/archipelago-runtime";
import { WorldState, createWorldState } from "../scripts/persistence/schema";

function readyState(): WorldState {
  const state = createWorldState(2026);
  const islandVersions: Record<string, number> = {};

  for (const island of REQUIRED_ISLANDS) {
    islandVersions[island.id] = island.contentVersion;
  }

  return {
    ...state,
    generatedIslandIds: REQUIRED_ISLANDS.map((island) => island.id),
    islandVersions,
  };
}

function islandForJob(
  state: WorldState,
  id: string | undefined,
): ArchipelagoIsland | undefined {
  return id === undefined
    ? undefined
    : parseArchipelagoIslandId(state.worldSeed, ARCHIPELAGO_LAYOUT_VERSION, id);
}

function encodedCoordinate(value: number): string {
  return `${value < 0 ? "n" : "p"}${Math.abs(value)}`;
}

describe("archipelago runtime planning", () => {
  it("queues the nearest ungenerated island only after bootstrap", () => {
    const state = readyState();
    const observer = {
      dimensionId: STABLE_ARCHIPELAGO_DIMENSION,
      x: 0,
      z: 0,
    };
    const job = nextArchipelagoGenerationJob(state, [observer]);

    expect(job).toBeDefined();
    expect(islandForJob(state, job?.id)).toBeDefined();

    const queued = queueNextArchipelagoIsland(state, [observer]);

    expect(queued.activeGeneration).toMatchObject(job!);
    expect(
      nextArchipelagoGenerationJob(createWorldState(2026), [observer]),
    ).toBeUndefined();
    expect(nextArchipelagoGenerationJob(queued, [observer])).toBeUndefined();
  });

  it("rederives exact solo jobs, definitions, versions, and safe docks", () => {
    const state = readyState();
    const plan = planArchipelago(state.worldSeed, ARCHIPELAGO_LAYOUT_VERSION);

    for (const tier of ["islet", "standard", "crag", "landmark"] as const) {
      const island = plan.find((candidate) => candidate.tier === tier)!;
      const job = archipelagoGenerationJobForId(state, island.id);
      const definition = archipelagoIslandDefinition(state, island.id);

      expect(job).toEqual({
        id: island.id,
        contentVersion: ARCHIPELAGO_CONTENT_VERSION,
        structureId: island.template.structureId,
        dimensionId: STABLE_ARCHIPELAGO_DIMENSION,
        origin: {
          x: island.x - Math.floor(island.size.x / 2),
          y: island.y,
          z: island.z - Math.floor(island.size.z / 2),
        },
      });
      expect(definition).toMatchObject({
        id: island.id,
        family: island.family,
        structureId: island.template.structureId,
        size: island.size,
        integrityBlocks: island.template.integrityBlocks,
        gameplayActivation: "structure_only",
        anchors: {
          safeDock: {
            x: island.template.safeDock.x + 0.5,
            y: island.template.safeDock.y,
            z: island.template.safeDock.z + 0.5,
          },
        },
      });
    }

    expect(
      archipelagoGenerationJobForId(state, "a1_p999_p999"),
    ).toBeUndefined();
    const futureAuthoredLayout: WorldState = {
      ...state,
      layoutVersion: state.layoutVersion + 99,
    };
    const island = plan.find((candidate) => candidate.tier === "crag")!;

    expect(
      archipelagoGenerationJobForId(futureAuthoredLayout, island.id),
    ).toEqual(archipelagoGenerationJobForId(state, island.id));
  });

  it("creates a complete resumable continent job and definition", () => {
    const state = readyState();
    const island = planArchipelago(
      state.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
    ).find((candidate) => candidate.tier === "continent")!;
    const job = archipelagoGenerationJobForId(state, island.id);
    const definition = archipelagoIslandDefinition(state, island.id);
    const firstPart = island.parts?.[0];

    expect(firstPart).toBeDefined();
    expect(job).toMatchObject({
      id: island.id,
      contentVersion: ARCHIPELAGO_CONTENT_VERSION,
      structureId: firstPart?.structureId,
      origin: firstPart?.origin,
      parts: island.parts?.map(
        ({ structureId, origin, rotation, row, integrityBlock }) => ({
          structureId,
          origin,
          rotation,
          row,
          integrityBlock,
        }),
      ),
    });
    expect(job?.parts).toHaveLength(21);
    expect(definition).toMatchObject({
      id: island.id,
      family: "verdant",
      size: island.size,
      gameplayActivation: "structure_only",
    });
    expect(definition?.integrityBlocks).toHaveLength(21);
    expect({
      x: (job?.origin.x ?? 0) + (definition?.anchors.safeDock.x ?? 0),
      y: (job?.origin.y ?? 0) + (definition?.anchors.safeDock.y ?? 0),
      z: (job?.origin.z ?? 0) + (definition?.anchors.safeDock.z ?? 0),
    }).toEqual({
      x:
        island.x -
        Math.floor(island.size.x / 2) +
        island.template.safeDock.x +
        0.5,
      y: island.y + island.template.safeDock.y,
      z:
        island.z -
        Math.floor(island.size.z / 2) +
        island.template.safeDock.z +
        0.5,
    });
  });

  it("can finish a valid in-flight a1 job without admitting it to the new plan", () => {
    const state = readyState();
    let legacyId: string | undefined;

    for (
      let cellX = -ARCHIPELAGO_CONFIG.maxCellRadius;
      cellX <= ARCHIPELAGO_CONFIG.maxCellRadius && legacyId === undefined;
      cellX += 1
    ) {
      for (
        let cellZ = -ARCHIPELAGO_CONFIG.maxCellRadius;
        cellZ <= ARCHIPELAGO_CONFIG.maxCellRadius;
        cellZ += 1
      ) {
        const candidate = `a1_${encodedCoordinate(cellX)}_${encodedCoordinate(cellZ)}`;

        if (archipelagoGenerationJobForId(state, candidate) !== undefined) {
          legacyId = candidate;
          break;
        }
      }
    }

    expect(legacyId).toBeDefined();
    expect(archipelagoGenerationJobForId(state, legacyId!)).toMatchObject({
      id: legacyId,
      contentVersion: 1,
      structureId: expect.stringMatching(/^skyknights:ambient_/u),
    });
    expect(archipelagoIslandDefinition(state, legacyId!)).toMatchObject({
      id: legacyId,
      contentVersion: 1,
      size: { x: 15, y: 10, z: 13 },
    });
    expect(
      parseArchipelagoIslandId(
        state.worldSeed,
        ARCHIPELAGO_LAYOUT_VERSION,
        legacyId!,
      ),
    ).toBeUndefined();
  });

  it("isolates dimensions and enforces solo and continent caps independently", () => {
    const state = readyState();
    const wrongDimension = {
      dimensionId: "skyknights:sky_realm",
      x: 500,
      z: 0,
    };

    expect(
      nextArchipelagoGenerationJob(state, [wrongDimension]),
    ).toBeUndefined();

    const plan = planArchipelago(state.worldSeed, ARCHIPELAGO_LAYOUT_VERSION);
    const solos = plan.filter((island) => island.tier !== "continent");
    const continents = plan.filter((island) => island.tier === "continent");
    const soloCapped: WorldState = {
      ...state,
      generatedIslandIds: [
        ...state.generatedIslandIds,
        ...solos
          .slice(0, ARCHIPELAGO_CONFIG.maxGeneratedIslands)
          .map((island) => island.id),
      ],
    };
    const continentJob = nextArchipelagoGenerationJob(soloCapped, [
      {
        dimensionId: STABLE_ARCHIPELAGO_DIMENSION,
        x: continents[0].x + 200,
        z: continents[0].z,
      },
    ]);

    expect(islandForJob(state, continentJob?.id)?.tier).toBe("continent");

    const continentCapped: WorldState = {
      ...state,
      generatedIslandIds: [
        ...state.generatedIslandIds,
        ...continents
          .slice(0, ARCHIPELAGO_CONFIG.maxGeneratedContinents)
          .map((island) => island.id),
      ],
    };
    const solo = solos.find(
      (candidate) =>
        Math.min(
          ...continents.map((continent) =>
            Math.hypot(candidate.x - continent.x, candidate.z - continent.z),
          ),
        ) > ARCHIPELAGO_CONFIG.maxQueryRadius,
    )!;
    const soloJob = nextArchipelagoGenerationJob(continentCapped, [
      {
        dimensionId: STABLE_ARCHIPELAGO_DIMENSION,
        x: solo.x,
        z: solo.z,
      },
    ]);

    expect(islandForJob(state, soloJob?.id)?.tier).not.toBe("continent");

    const fullyCapped: WorldState = {
      ...soloCapped,
      generatedIslandIds: [
        ...soloCapped.generatedIslandIds,
        ...continents
          .slice(0, ARCHIPELAGO_CONFIG.maxGeneratedContinents)
          .map((island) => island.id),
      ],
    };

    expect(
      nextArchipelagoGenerationJob(fullyCapped, [
        {
          dimensionId: STABLE_ARCHIPELAGO_DIMENSION,
          x: continents[2].x,
          z: continents[2].z,
        },
      ]),
    ).toBeUndefined();
  });

  it("never queues an island inside its per-template observer clearance", () => {
    const state = readyState();
    const island = planArchipelago(
      state.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
    ).find((candidate) => candidate.tier === "continent")!;
    const observer = {
      dimensionId: STABLE_ARCHIPELAGO_DIMENSION,
      x: island.x,
      z: island.z,
    };
    const job = nextArchipelagoGenerationJob(state, [observer]);
    const queuedIsland = islandForJob(state, job?.id);

    expect(job).toBeDefined();
    expect(queuedIsland).toBeDefined();
    expect(queuedIsland?.id).not.toBe(island.id);
    expect(
      Math.hypot(
        (queuedIsland?.x ?? island.x) - observer.x,
        (queuedIsland?.z ?? island.z) - observer.z,
      ),
    ).toBeGreaterThanOrEqual(queuedIsland?.observerClearance ?? 0);
  });

  it("keeps legacy a1 history outside new caps and bounds persistence", () => {
    const state: WorldState = {
      ...readyState(),
      generatedIslandIds: [
        ...readyState().generatedIslandIds,
        ...Array.from({ length: 384 }, (_, index) => `a1_p${index + 1}_p1`),
      ],
    };
    const job = nextArchipelagoGenerationJob(state, [
      {
        dimensionId: STABLE_ARCHIPELAGO_DIMENSION,
        x: 0,
        z: 0,
      },
    ]);

    expect(job?.id.startsWith("a2_")).toBe(true);
    expect(archipelagoPersistenceBudgetBytes(state)).toBeLessThan(30_000);
  });
});
