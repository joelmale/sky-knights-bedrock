import { beforeEach, describe, expect, it, vi } from "vitest";

const minecraft = vi.hoisted(() => {
  const properties = new Map<string, string>();
  const tickingAreas = new Set<string>();

  return {
    properties,
    tickingAreas,
    currentTick: 0,
    hasTickingAreaCapacity: true,
    occupiedBlocks: 0,
    entities: [] as {
      location: { x: number; y: number; z: number };
    }[],
    fills: [] as {
      from: { x: number; y: number; z: number };
      to: { x: number; y: number; z: number };
      block: string;
      options: unknown;
    }[],
  };
});

vi.mock("@minecraft/server", () => {
  class BlockVolume {
    public constructor(
      public readonly from: { x: number; y: number; z: number },
      public readonly to: { x: number; y: number; z: number },
    ) {}
  }

  const dimension = {
    getBlocks: vi.fn(() => ({
      getCapacity: () => minecraft.occupiedBlocks,
    })),
    getEntities: vi.fn(() => minecraft.entities),
    fillBlocks: vi.fn(
      (
        volume: BlockVolume,
        block: string,
        options: unknown,
      ): { getCapacity(): number } => {
        minecraft.fills.push({
          from: volume.from,
          to: volume.to,
          block,
          options,
        });
        return { getCapacity: () => 1 };
      },
    ),
  };

  return {
    BlockVolume,
    Dimension: class {},
    system: {
      get currentTick() {
        return minecraft.currentTick;
      },
      waitTicks: vi.fn(async () => {}),
    },
    world: {
      getDynamicProperty: vi.fn((id: string) => minecraft.properties.get(id)),
      setDynamicProperty: vi.fn((id: string, value?: string) => {
        if (value === undefined) {
          minecraft.properties.delete(id);
        } else {
          minecraft.properties.set(id, value);
        }
      }),
      getDimension: vi.fn(() => dimension),
      tickingAreaManager: {
        hasTickingArea: vi.fn((id: string) => minecraft.tickingAreas.has(id)),
        removeTickingArea: vi.fn((id: string) => {
          minecraft.tickingAreas.delete(id);
        }),
        hasCapacity: vi.fn(() => minecraft.hasTickingAreaCapacity),
        createTickingArea: vi.fn(async (id: string) => {
          minecraft.tickingAreas.add(id);
        }),
        getTickingArea: vi.fn((id: string) =>
          minecraft.tickingAreas.has(id) ? { isFullyLoaded: true } : undefined,
        ),
      },
    },
  };
});

import { system, world } from "@minecraft/server";

import { REQUIRED_ISLANDS } from "../scripts/config/constants";
import { Logger } from "../scripts/diagnostics/logger";
import { ARCHIPELAGO_LAYOUT_VERSION } from "../scripts/generation/archipelago-runtime";
import {
  CONTINENT_FILL_CALLS_PER_TICK,
  CONTINENT_STREAMING_SPAN,
  ContinentStreamingSelection,
  executeContinentStreamingSelection,
  resumeContinentStreaming,
} from "../scripts/generation/continent-service";
import {
  continentStreamingChunkAt,
  createContinentChunkBitset,
  decodeContinentChunkBitset,
  deriveContinentStreamingSites,
  nextContinentStreamingChunk,
} from "../scripts/generation/continent-streaming";
import { ContinentProgressRepository } from "../scripts/persistence/continent-progress";
import { WorldStateRepository } from "../scripts/persistence/repositories";
import { createWorldState } from "../scripts/persistence/schema";

function repositories() {
  const worldRepository = new WorldStateRepository(world, () => 2026);
  const initial = createWorldState(2026);
  const islandVersions: Record<string, number> = {};

  for (const island of REQUIRED_ISLANDS) {
    islandVersions[island.id] = island.contentVersion;
  }

  const ready = {
    ...initial,
    generatedIslandIds: REQUIRED_ISLANDS.map((island) => island.id),
    islandVersions,
  };
  worldRepository.save(ready);

  return {
    ready,
    worldRepository,
    progressRepository: new ContinentProgressRepository(world, ready.worldSeed),
  };
}

function siteFor(worldSeed: number) {
  return deriveContinentStreamingSites(worldSeed, {
    legacyLayoutVersion: ARCHIPELAGO_LAYOUT_VERSION,
    span: CONTINENT_STREAMING_SPAN,
  })[0];
}

function selectionAt(
  site: ReturnType<typeof siteFor>,
  chunkIndex: number,
  recovering = false,
): ContinentStreamingSelection {
  return {
    site,
    task: continentStreamingChunkAt(site, chunkIndex),
    bitset: createContinentChunkBitset(site),
    recovering,
  };
}

describe("formula continent chunk execution", () => {
  beforeEach(() => {
    minecraft.properties.clear();
    minecraft.tickingAreas.clear();
    minecraft.currentTick += 1_000;
    minecraft.hasTickingAreaCapacity = true;
    minecraft.occupiedBlocks = 0;
    minecraft.entities = [];
    minecraft.fills = [];
    vi.mocked(system.waitTicks).mockClear();
  });

  it("fills only air in bounded four-call batches and checkpoints completion", async () => {
    const { ready, worldRepository, progressRepository } = repositories();
    const site = siteFor(ready.worldSeed);
    const task = nextContinentStreamingChunk(
      site,
      createContinentChunkBitset(site),
      { x: site.field.centerX, z: site.field.centerZ },
    )!;
    const selection: ContinentStreamingSelection = {
      site,
      task,
      bitset: createContinentChunkBitset(site),
      recovering: false,
    };

    expect(task.plan.empty).toBe(false);
    await executeContinentStreamingSelection(
      worldRepository,
      progressRepository,
      selection,
      "minecraft:overworld",
      new Logger("continent-test", () => {}),
    );

    expect(minecraft.fills).toHaveLength(task.volumes.length);
    expect(minecraft.fills).toEqual(
      task.volumes.map((volume) => ({
        from: volume.from,
        to: volume.to,
        block: expect.stringMatching(/^minecraft:/u),
        options: {
          blockFilter: { includeTypes: ["minecraft:air"] },
        },
      })),
    );
    expect(system.waitTicks).toHaveBeenCalledTimes(
      Math.ceil(task.volumes.length / CONTINENT_FILL_CALLS_PER_TICK) - 1,
    );
    expect(minecraft.tickingAreas.size).toBe(0);

    const progress = progressRepository.load();
    expect(progress.activeChunk).toBeUndefined();
    const bitset = decodeContinentChunkBitset(site, progress.chunks[site.id])!;
    expect(
      nextContinentStreamingChunk(site, bitset, {
        x: site.field.centerX,
        z: site.field.centerZ,
      })?.chunkIndex,
    ).not.toBe(task.chunkIndex);
  });

  it("marks an empty chunk complete without creating a ticking area", async () => {
    const { ready, worldRepository, progressRepository } = repositories();
    const site = siteFor(ready.worldSeed);
    let emptyIndex = -1;

    for (let index = 0; index < site.chunkBounds.count; index += 1) {
      if (continentStreamingChunkAt(site, index).plan.empty) {
        emptyIndex = index;
        break;
      }
    }

    expect(emptyIndex).toBeGreaterThanOrEqual(0);
    await executeContinentStreamingSelection(
      worldRepository,
      progressRepository,
      selectionAt(site, emptyIndex),
      "minecraft:overworld",
      new Logger("continent-test", () => {}),
    );

    expect(minecraft.fills).toHaveLength(0);
    expect(minecraft.tickingAreas.size).toBe(0);
    expect(progressRepository.load().activeChunk).toBeUndefined();
    expect(progressRepository.load().chunks[site.id]).toBeDefined();
  });

  it("skips an occupied new chunk but resumes an exact in-flight chunk", async () => {
    const { ready, worldRepository, progressRepository } = repositories();
    const site = siteFor(ready.worldSeed);
    const task = nextContinentStreamingChunk(
      site,
      createContinentChunkBitset(site),
      { x: site.field.centerX, z: site.field.centerZ },
    )!;
    minecraft.occupiedBlocks = 1;

    await executeContinentStreamingSelection(
      worldRepository,
      progressRepository,
      {
        site,
        task,
        bitset: createContinentChunkBitset(site),
        recovering: false,
      },
      "minecraft:overworld",
      new Logger("continent-test", () => {}),
    );
    expect(minecraft.fills).toHaveLength(0);

    const fresh = repositories();
    let active = fresh.progressRepository.load();
    active = {
      ...active,
      activeChunk: {
        continentId: site.id,
        chunkIndex: task.chunkIndex,
      },
    };
    fresh.progressRepository.save(active);

    await executeContinentStreamingSelection(
      fresh.worldRepository,
      fresh.progressRepository,
      {
        site,
        task,
        bitset: createContinentChunkBitset(site),
        recovering: true,
      },
      "minecraft:overworld",
      new Logger("continent-test", () => {}),
    );

    expect(minecraft.fills).toHaveLength(task.volumes.length);
    expect(fresh.progressRepository.load().activeChunk).toBeUndefined();
  });

  it("defers an entity-occupied chunk without writing blocks or progress", async () => {
    const { ready, worldRepository, progressRepository } = repositories();
    const site = siteFor(ready.worldSeed);
    const task = nextContinentStreamingChunk(
      site,
      createContinentChunkBitset(site),
      { x: site.field.centerX, z: site.field.centerZ },
    )!;
    minecraft.entities = [
      {
        location: {
          x: task.plan.originX + 8,
          y: task.plan.minY,
          z: task.plan.originZ + 8,
        },
      },
    ];

    await executeContinentStreamingSelection(
      worldRepository,
      progressRepository,
      {
        site,
        task,
        bitset: createContinentChunkBitset(site),
        recovering: false,
      },
      "minecraft:overworld",
      new Logger("continent-test", () => {}),
    );

    expect(minecraft.fills).toHaveLength(0);
    expect(progressRepository.load().activeChunk).toBeUndefined();
    expect(progressRepository.load().chunks).toEqual({});
    expect(minecraft.tickingAreas.size).toBe(0);
  });

  it("checkpoints and exactly replays a chunk paused by a structure job", async () => {
    const { ready, worldRepository, progressRepository } = repositories();
    const site = siteFor(ready.worldSeed);
    const task = nextContinentStreamingChunk(
      site,
      createContinentChunkBitset(site),
      { x: site.field.centerX, z: site.field.centerZ },
    )!;
    expect(task.volumes.length).toBeGreaterThan(CONTINENT_FILL_CALLS_PER_TICK);

    vi.mocked(system.waitTicks).mockImplementationOnce(async () => {
      worldRepository.save({
        ...worldRepository.load(),
        activeGeneration: {
          id: "a4_pause_test",
          contentVersion: 4,
          structureId: "skyknights:ambient_island_01",
          dimensionId: "minecraft:overworld",
          origin: { x: 0, y: 80, z: 0 },
          stage: "queued",
          attempts: 0,
        },
      });
    });

    await executeContinentStreamingSelection(
      worldRepository,
      progressRepository,
      {
        site,
        task,
        bitset: createContinentChunkBitset(site),
        recovering: false,
      },
      "minecraft:overworld",
      new Logger("continent-test", () => {}),
    );

    expect(minecraft.fills).toHaveLength(CONTINENT_FILL_CALLS_PER_TICK);
    expect(progressRepository.load().activeChunk).toEqual({
      continentId: site.id,
      chunkIndex: task.chunkIndex,
    });
    expect(minecraft.tickingAreas.size).toBe(0);

    worldRepository.save({
      ...worldRepository.load(),
      activeGeneration: undefined,
    });
    vi.mocked(system.waitTicks).mockImplementation(async () => {});

    await executeContinentStreamingSelection(
      worldRepository,
      progressRepository,
      {
        site,
        task,
        bitset: createContinentChunkBitset(site),
        recovering: true,
      },
      "minecraft:overworld",
      new Logger("continent-test", () => {}),
    );

    expect(minecraft.fills).toHaveLength(
      CONTINENT_FILL_CALLS_PER_TICK + task.volumes.length,
    );
    expect(progressRepository.load().activeChunk).toBeUndefined();
  });

  it("backs off all continent work after a runtime failure", async () => {
    const { ready, worldRepository } = repositories();
    const site = siteFor(ready.worldSeed);
    const logger = new Logger("continent-test", () => {});
    const observer = [
      {
        dimensionId: "minecraft:overworld",
        x: site.field.centerX,
        z: site.field.centerZ,
      },
    ];
    minecraft.hasTickingAreaCapacity = false;

    expect(resumeContinentStreaming(worldRepository, observer, logger)).toBe(
      true,
    );
    await vi.waitFor(() => {
      expect(resumeContinentStreaming(worldRepository, observer, logger)).toBe(
        false,
      );
    });
  });
});
