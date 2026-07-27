import { describe, expect, it } from "vitest";

import { REQUIRED_ISLANDS } from "../scripts/config/constants";
import {
  ARCHIPELAGO_CONFIG,
  ARCHIPELAGO_TEMPLATES,
  parseArchipelagoIslandId,
  planArchipelago,
} from "../scripts/generation/archipelago";
import {
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
    expect(
      parseArchipelagoIslandId(
        state.worldSeed,
        ARCHIPELAGO_LAYOUT_VERSION,
        job!.id,
      ),
    ).toBeDefined();

    const queued = queueNextArchipelagoIsland(state, [observer]);

    expect(queued.activeGeneration).toMatchObject(job!);
    expect(
      nextArchipelagoGenerationJob(createWorldState(2026), [observer]),
    ).toBeUndefined();
    expect(nextArchipelagoGenerationJob(queued, [observer])).toBeUndefined();
  });

  it("rederives exact structure jobs and definitions from compact IDs", () => {
    const state = readyState();
    const island = planArchipelago(
      state.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
    )[0];
    const template = ARCHIPELAGO_TEMPLATES[island.family];
    const job = archipelagoGenerationJobForId(state, island.id);
    const definition = archipelagoIslandDefinition(state, island.id);

    expect(job).toEqual({
      id: island.id,
      contentVersion: 1,
      structureId: template.structureId,
      dimensionId: STABLE_ARCHIPELAGO_DIMENSION,
      origin: {
        x: island.x - 7,
        y: island.y,
        z: island.z - 6,
      },
    });
    expect(definition).toMatchObject({
      id: island.id,
      family: island.family,
      structureId: template.structureId,
      size: template.size,
      integrityBlocks: template.integrityBlocks,
      gameplayActivation: "structure_only",
    });
    expect(
      archipelagoGenerationJobForId(state, "a1_p999_p999"),
    ).toBeUndefined();
    const futureAuthoredLayout: WorldState = {
      ...state,
      layoutVersion: state.layoutVersion + 99,
    };

    expect(
      archipelagoGenerationJobForId(futureAuthoredLayout, island.id),
    ).toEqual(job);
  });

  it("isolates dimensions and stops at the persisted ambient cap", () => {
    const state = readyState();
    const observer = {
      dimensionId: "skyknights:sky_realm",
      x: 500,
      z: 0,
    };

    expect(nextArchipelagoGenerationJob(state, [observer])).toBeUndefined();

    const ambientIds = planArchipelago(
      state.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
    )
      .slice(0, ARCHIPELAGO_CONFIG.maxGeneratedIslands)
      .map((island) => island.id);
    const capped = {
      ...state,
      generatedIslandIds: [...state.generatedIslandIds, ...ambientIds],
    };

    expect(
      nextArchipelagoGenerationJob(capped, [
        { ...observer, dimensionId: STABLE_ARCHIPELAGO_DIMENSION },
      ]),
    ).toBeUndefined();
  });

  it("never queues an island directly around an observer", () => {
    const state = readyState();
    const island = planArchipelago(
      state.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
    )[0];
    const job = nextArchipelagoGenerationJob(state, [
      {
        dimensionId: STABLE_ARCHIPELAGO_DIMENSION,
        x: island.x,
        z: island.z,
      },
    ]);
    const queuedIsland =
      job === undefined
        ? undefined
        : parseArchipelagoIslandId(
            state.worldSeed,
            ARCHIPELAGO_LAYOUT_VERSION,
            job.id,
          );

    expect(job).toBeDefined();
    expect(queuedIsland).toBeDefined();
    expect(queuedIsland?.id).not.toBe(island.id);
    expect(
      Math.hypot(
        (queuedIsland?.x ?? island.x) - island.x,
        (queuedIsland?.z ?? island.z) - island.z,
      ),
    ).toBeGreaterThanOrEqual(ARCHIPELAGO_CONFIG.minObserverDistance);
  });

  it("keeps the worst-case bounded world document below its string limit", () => {
    expect(archipelagoPersistenceBudgetBytes(readyState())).toBeLessThan(
      30_000,
    );
  });
});
