import { beforeEach, describe, expect, it, vi } from "vitest";

const minecraft = vi.hoisted(() => ({
  fills: [] as { block: string; filtered: boolean }[],
  placements: [] as string[],
  tickingAreas: new Set<string>(),
}));

vi.mock("@minecraft/server", () => ({
  BlockVolume: class {
    public constructor(
      public readonly from: { x: number; y: number; z: number },
      public readonly to: { x: number; y: number; z: number },
    ) {}
  },
  Dimension: class {},
  ItemStack: class {},
  StructureRotation: {
    None: "None",
    Rotate90: "Rotate90",
    Rotate180: "Rotate180",
    Rotate270: "Rotate270",
  },
  system: {
    runTimeout: vi.fn(),
    waitTicks: vi.fn(async () => {}),
  },
  world: {
    getDimension: vi.fn(() => ({
      getBlock: vi.fn(() => ({ typeId: "minecraft:air", isAir: true })),
      getEntities: vi.fn(() => []),
      fillBlocks: vi.fn(
        (
          _volume: unknown,
          block: string,
          options?: { blockFilter?: unknown },
        ) => {
          minecraft.fills.push({
            block,
            filtered: options?.blockFilter !== undefined,
          });
        },
      ),
    })),
    structureManager: {
      place: vi.fn((structureId: string) => {
        minecraft.placements.push(structureId);
      }),
    },
    tickingAreaManager: {
      hasTickingArea: vi.fn((id: string) => minecraft.tickingAreas.has(id)),
      removeTickingArea: vi.fn((id: string) => {
        minecraft.tickingAreas.delete(id);
      }),
      hasCapacity: vi.fn(() => true),
      createTickingArea: vi.fn(async (id: string) => {
        minecraft.tickingAreas.add(id);
      }),
      getTickingArea: vi.fn((id: string) =>
        minecraft.tickingAreas.has(id) ? { isFullyLoaded: true } : undefined,
      ),
    },
  },
}));

import { Logger } from "../scripts/diagnostics/logger";
import { archipelagoGenerationJobForId } from "../scripts/generation/archipelago-runtime";
import { planArchipelagoV4 } from "../scripts/generation/archipelago-v4";
import { resumeGeneration } from "../scripts/generation/service";
import { queueGeneration } from "../scripts/generation/state";
import {
  DynamicPropertyHost,
  WorldStateRepository,
} from "../scripts/persistence/repositories";
import { createWorldState } from "../scripts/persistence/schema";
import { REQUIRED_ISLANDS } from "../scripts/config/constants";

class MemoryHost implements DynamicPropertyHost {
  private readonly properties = new Map<string, string>();

  public getDynamicProperty(identifier: string): string | undefined {
    return this.properties.get(identifier);
  }

  public setDynamicProperty(identifier: string, value?: string): void {
    if (value === undefined) {
      this.properties.delete(identifier);
      return;
    }
    this.properties.set(identifier, value);
  }
}

function readyState(seed: number) {
  const initial = createWorldState(seed);
  const islandVersions: Record<string, number> = {};

  for (const island of REQUIRED_ISLANDS) {
    islandVersions[island.id] = island.contentVersion;
  }

  return {
    ...initial,
    generatedIslandIds: REQUIRED_ISLANDS.map((island) => island.id),
    islandVersions,
  };
}

// The wiring is the whole point of the slice: without it the field, the fill
// plan and the executor are dead code and the game still shows the old authored
// discs. This asserts an ambient a4 island genuinely takes the terrain path.
describe("ambient island generation dispatch", () => {
  beforeEach(() => {
    minecraft.fills = [];
    minecraft.placements = [];
    minecraft.tickingAreas.clear();
  });

  it("generates an a4 island as terrain, not as a structure", async () => {
    const ready = readyState(2026);
    const island = planArchipelagoV4(ready.worldSeed).find(
      (candidate) => candidate.tier === "standard",
    );

    expect(island).toBeDefined();
    const job = archipelagoGenerationJobForId(ready, island!.id);
    expect(job).toBeDefined();
    expect(job!.id.startsWith("a4_")).toBe(true);

    const host = new MemoryHost();
    const repository = new WorldStateRepository(host, () => ready.worldSeed);
    repository.save(queueGeneration(ready, job!));

    resumeGeneration(repository, new Logger("dispatch-test", () => {}));

    await vi.waitFor(
      () => {
        expect(repository.load().activeGeneration).toBeUndefined();
      },
      { timeout: 20_000 },
    );

    // Terrain, not structures.
    expect(minecraft.fills.length).toBeGreaterThan(0);
    expect(minecraft.placements).toHaveLength(0);

    // Every terrain fill is air-only; only the bounded dock pad is unfiltered.
    const unfiltered = minecraft.fills.filter((fill) => !fill.filtered);
    expect(unfiltered).toHaveLength(2);

    // Recorded as generated, so it is never rebuilt.
    expect(repository.load().generatedIslandIds).toContain(island!.id);
    await Promise.resolve();
  }, 30_000);
});
