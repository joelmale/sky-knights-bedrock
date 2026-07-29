import { describe, expect, it, vi } from "vitest";

vi.mock("@minecraft/server", () => ({
  BlockVolume: class {
    public constructor(
      public readonly from: { x: number; y: number; z: number },
      public readonly to: { x: number; y: number; z: number },
    ) {}
  },
  Dimension: class {},
  system: {
    waitTicks: vi.fn(async () => {}),
  },
  world: {
    tickingAreaManager: {},
  },
}));

import { REQUIRED_ISLANDS } from "../scripts/config/constants";
import {
  ARCHIPELAGO_CONFIG,
  archipelagoContinentAnchors,
  deriveArchipelagoIsland,
} from "../scripts/generation/archipelago";
import {
  ARCHIPELAGO_LAYOUT_VERSION,
  STABLE_ARCHIPELAGO_DIMENSION,
} from "../scripts/generation/archipelago-runtime";
import {
  CONTINENT_STREAMING_SPAN,
  generatedLegacyContinentSiteIndices,
  reconcileCompletedContinentHistory,
  selectContinentStreamingChunk,
} from "../scripts/generation/continent-service";
import {
  completeContinentChunk,
  createContinentChunkBitset,
  deriveContinentStreamingSites,
  encodeContinentChunkBitset,
} from "../scripts/generation/continent-streaming";
import {
  ContinentProgressState,
  createContinentProgressState,
} from "../scripts/persistence/continent-progress";
import { WorldState, createWorldState } from "../scripts/persistence/schema";

function readyState(seed = 2026): WorldState {
  const state = createWorldState(seed);
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

function legacyContinentIds(state: WorldState): readonly string[] {
  return archipelagoContinentAnchors(
    state.worldSeed,
    ARCHIPELAGO_LAYOUT_VERSION,
  ).map((anchor) => {
    const island = deriveArchipelagoIsland(
      state.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
      anchor.cellX,
      anchor.cellZ,
    );
    expect(island?.tier).toBe("continent");
    return island!.id;
  });
}

function sites(state: WorldState) {
  return deriveContinentStreamingSites(state.worldSeed, {
    legacyLayoutVersion: ARCHIPELAGO_LAYOUT_VERSION,
    span: CONTINENT_STREAMING_SPAN,
  });
}

function observerAt(site: ReturnType<typeof sites>[number]) {
  return {
    dimensionId: STABLE_ARCHIPELAGO_DIMENSION,
    x: site.field.centerX,
    z: site.field.centerZ,
  };
}

function started(
  base: ContinentProgressState,
  ...startedSites: readonly ReturnType<typeof sites>[number][]
): ContinentProgressState {
  const chunks: Record<string, string> = {};

  for (const site of startedSites) {
    chunks[site.id] = encodeContinentChunkBitset(
      site,
      createContinentChunkBitset(site),
    );
  }

  return { ...base, chunks };
}

describe("formula continent runtime selection", () => {
  it("maps generated frozen a2 continent IDs back to their site indexes", () => {
    const state = readyState();
    const ids = legacyContinentIds(state);

    expect(
      generatedLegacyContinentSiteIndices({
        ...state,
        generatedIslandIds: [...state.generatedIslandIds, ids[1], ids[4]],
      }),
    ).toEqual([1, 4]);
  });

  it("continues started sites but never exceeds the shared two-continent cap", () => {
    const state = readyState();
    const plan = sites(state);
    const empty = createContinentProgressState(state.worldSeed);
    const first = selectContinentStreamingChunk(state, empty, [
      observerAt(plan[0]),
    ]);

    expect(first?.site.id).toBe("c1_0");

    const oneStarted = started(empty, plan[0]);
    expect(
      selectContinentStreamingChunk(state, oneStarted, [observerAt(plan[1])])
        ?.site.id,
    ).toBe("c1_1");
    expect(
      selectContinentStreamingChunk(state, oneStarted, [observerAt(plan[0])])
        ?.site.id,
    ).toBe("c1_0");

    const twoStarted = started(empty, plan[0], plan[1]);
    expect(
      selectContinentStreamingChunk(state, twoStarted, [observerAt(plan[2])]),
    ).toBeUndefined();

    const invalid = started(empty, plan[0], plan[1], plan[2]);
    expect(() =>
      selectContinentStreamingChunk(state, invalid, [observerAt(plan[0])]),
    ).toThrow(/exceeding the shared 2-continent cap/u);
  });

  it("counts archived a2 continents against the shared cap", () => {
    const base = readyState();
    const ids = legacyContinentIds(base);
    const state: WorldState = {
      ...base,
      generatedIslandIds: [...base.generatedIslandIds, ids[0], ids[1]],
    };
    const remaining = deriveContinentStreamingSites(state.worldSeed, {
      legacyLayoutVersion: ARCHIPELAGO_LAYOUT_VERSION,
      existingLegacySiteIndices: [0, 1],
      span: CONTINENT_STREAMING_SPAN,
    });

    expect(ARCHIPELAGO_CONFIG.maxGeneratedContinents).toBe(2);
    expect(
      selectContinentStreamingChunk(
        state,
        createContinentProgressState(state.worldSeed),
        [observerAt(remaining[0])],
      ),
    ).toBeUndefined();
  });

  it("resumes the exact persisted active chunk without an observer", () => {
    const state = readyState();
    const site = sites(state)[0];
    const progress: ContinentProgressState = {
      ...createContinentProgressState(state.worldSeed),
      activeChunk: {
        continentId: site.id,
        chunkIndex: site.chunkBounds.count - 1,
      },
    };
    const selected = selectContinentStreamingChunk(state, progress, []);

    expect(selected?.recovering).toBe(true);
    expect(selected?.task.continentId).toBe(site.id);
    expect(selected?.task.chunkIndex).toBe(site.chunkBounds.count - 1);
  });

  it("schedules around deferred chunks and yields a deferred active chunk", () => {
    const state = readyState();
    const site = sites(state)[0];
    const progress = createContinentProgressState(state.worldSeed);
    const observer = observerAt(site);
    const first = selectContinentStreamingChunk(state, progress, [observer])!;
    const deferred = new Set([`${site.id}:${first.task.chunkIndex}`]);
    const alternate = selectContinentStreamingChunk(
      state,
      progress,
      [observer],
      STABLE_ARCHIPELAGO_DIMENSION,
      deferred,
    );

    expect(alternate?.task.chunkIndex).not.toBe(first.task.chunkIndex);

    const active: ContinentProgressState = {
      ...progress,
      activeChunk: {
        continentId: site.id,
        chunkIndex: first.task.chunkIndex,
      },
    };
    expect(
      selectContinentStreamingChunk(
        state,
        active,
        [],
        STABLE_ARCHIPELAGO_DIMENSION,
        deferred,
      ),
    ).toBeUndefined();
  });

  it("fails closed on a corrupt started-site bitset", () => {
    const state = readyState();
    const site = sites(state)[0];
    const progress: ContinentProgressState = {
      ...createContinentProgressState(state.worldSeed),
      chunks: { [site.id]: "AAAA" },
    };

    expect(() =>
      selectContinentStreamingChunk(state, progress, [observerAt(site)]),
    ).toThrow(/is corrupt/u);
  });

  it("reconciles a completed bitset after a crash before world-history save", () => {
    const state = readyState();
    const site = sites(state)[0];
    let bitset = createContinentChunkBitset(site);

    for (let index = 0; index < site.chunkBounds.count; index += 1) {
      bitset = completeContinentChunk(site, bitset, index);
    }

    const progress: ContinentProgressState = {
      ...createContinentProgressState(state.worldSeed),
      chunks: {
        [site.id]: encodeContinentChunkBitset(site, bitset),
      },
    };
    const reconciled = reconcileCompletedContinentHistory(state, progress);

    expect(reconciled.generatedIslandIds).toContain(site.id);
    expect(reconciled.islandVersions[site.id]).toBe(1);
    expect(reconcileCompletedContinentHistory(reconciled, progress)).toBe(
      reconciled,
    );
  });
});
