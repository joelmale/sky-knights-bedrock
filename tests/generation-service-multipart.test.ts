import { beforeEach, describe, expect, it, vi } from "vitest";

const minecraft = vi.hoisted(() => {
  const blockTypes = new Map<string, string>();
  const tickingAreas = new Set<string>();

  return {
    blockTypes,
    tickingAreas,
    parts: [] as {
      structureId: string;
      origin: { x: number; y: number; z: number };
      integrityBlock: {
        offset: { x: number; y: number; z: number };
        typeId: string;
      };
    }[],
    placements: [] as string[],
    locationKey(location: { x: number; y: number; z: number }): string {
      return `${location.x},${location.y},${location.z}`;
    },
  };
});

vi.mock("@minecraft/server", () => ({
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
      getBlock: vi.fn((location: { x: number; y: number; z: number }) => {
        const typeId =
          minecraft.blockTypes.get(minecraft.locationKey(location)) ??
          "minecraft:air";
        // isAir is how production tells "never placed" from "player edited".
        // A mock without it reports every probe as occupied, which silently
        // disables that distinction.
        return { typeId, isAir: typeId === "minecraft:air" };
      }),
      getEntities: vi.fn(() => []),
    })),
    structureManager: {
      place: vi.fn(
        (
          structureId: string,
          _dimension: unknown,
          origin: { x: number; y: number; z: number },
        ) => {
          const part = minecraft.parts.find(
            (candidate) =>
              candidate.structureId === structureId &&
              candidate.origin.x === origin.x &&
              candidate.origin.y === origin.y &&
              candidate.origin.z === origin.z,
          );

          if (part === undefined) {
            throw new Error(`Unexpected structure placement ${structureId}.`);
          }

          const probe = {
            x: origin.x + part.integrityBlock.offset.x,
            y: origin.y + part.integrityBlock.offset.y,
            z: origin.z + part.integrityBlock.offset.z,
          };
          minecraft.blockTypes.set(
            minecraft.locationKey(probe),
            part.integrityBlock.typeId,
          );
          minecraft.placements.push(minecraft.locationKey(origin));
        },
      ),
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

import { world } from "@minecraft/server";

import { Logger } from "../scripts/diagnostics/logger";
import {
  ARCHIPELAGO_LAYOUT_VERSION,
  archipelagoGenerationJobForId,
} from "../scripts/generation/archipelago-runtime";
import { planArchipelago } from "../scripts/generation/archipelago";
import { planArchipelagoV3 } from "../scripts/generation/archipelago-v3";
import { resumeGeneration } from "../scripts/generation/service";
import {
  advancePartCursor,
  queueGeneration,
} from "../scripts/generation/state";
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

describe("multipart generation service", () => {
  beforeEach(() => {
    minecraft.blockTypes.clear();
    minecraft.tickingAreas.clear();
    minecraft.parts = [];
    minecraft.placements = [];
  });

  it("resumes after a placed part whose cursor checkpoint was interrupted", async () => {
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
    const continent = planArchipelago(
      ready.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
    ).find((island) => island.tier === "continent");

    expect(continent).toBeDefined();
    const job = archipelagoGenerationJobForId(ready, continent!.id);

    expect(job?.parts).toHaveLength(21);
    minecraft.parts = [...job!.parts!];

    const first = job!.parts![0];
    minecraft.blockTypes.set(
      minecraft.locationKey({
        x: first.origin.x + first.integrityBlock.offset.x,
        y: first.origin.y + first.integrityBlock.offset.y,
        z: first.origin.z + first.integrityBlock.offset.z,
      }),
      first.integrityBlock.typeId,
    );

    const host = new MemoryHost();
    const repository = new WorldStateRepository(host, () => ready.worldSeed);
    repository.save(queueGeneration(ready, job!));

    resumeGeneration(repository, new Logger("multipart-test", () => {}));

    await vi.waitFor(
      () => {
        expect(repository.load().activeGeneration).toBeUndefined();
      },
      { timeout: 10_000 },
    );

    const completed = repository.load();
    expect(completed.generatedIslandIds).toContain(continent!.id);
    expect(minecraft.placements).toHaveLength(20);
    expect(minecraft.tickingAreas.size).toBe(0);
    await Promise.resolve();
  });

  it("preflights every remaining part before placing around a late obstruction", async () => {
    const initial = createWorldState(2027);
    const islandVersions: Record<string, number> = {};

    for (const island of REQUIRED_ISLANDS) {
      islandVersions[island.id] = island.contentVersion;
    }

    const ready = {
      ...initial,
      generatedIslandIds: REQUIRED_ISLANDS.map((island) => island.id),
      islandVersions,
    };
    const continent = planArchipelago(
      ready.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
    ).find((island) => island.tier === "continent");

    expect(continent).toBeDefined();
    const job = archipelagoGenerationJobForId(ready, continent!.id);

    expect(job?.parts).toHaveLength(21);
    minecraft.parts = [...job!.parts!];

    const latePart = job!.parts![10];
    const obstruction = {
      x: latePart.origin.x + 1,
      y: latePart.origin.y + 1,
      z: latePart.origin.z + 1,
    };
    minecraft.blockTypes.set(
      minecraft.locationKey(obstruction),
      "minecraft:cobblestone",
    );

    const host = new MemoryHost();
    const repository = new WorldStateRepository(host, () => ready.worldSeed);
    repository.save(queueGeneration(ready, job!));

    resumeGeneration(repository, new Logger("multipart-test", () => {}));

    await vi.waitFor(
      () => {
        expect(repository.load().activeGeneration).toBeUndefined();
      },
      { timeout: 10_000 },
    );

    const completed = repository.load();
    expect(completed.generatedIslandIds).toContain(continent!.id);
    expect(minecraft.placements).toHaveLength(0);
    expect(minecraft.blockTypes.get(minecraft.locationKey(obstruction))).toBe(
      "minecraft:cobblestone",
    );
    expect(minecraft.tickingAreas.size).toBe(0);
    await Promise.resolve();
  });

  it("preserves edits to checkpointed parts while completing later parts", async () => {
    const initial = createWorldState(2028);
    const islandVersions: Record<string, number> = {};

    for (const island of REQUIRED_ISLANDS) {
      islandVersions[island.id] = island.contentVersion;
    }

    const ready = {
      ...initial,
      generatedIslandIds: REQUIRED_ISLANDS.map((island) => island.id),
      islandVersions,
    };
    const continent = planArchipelago(
      ready.worldSeed,
      ARCHIPELAGO_LAYOUT_VERSION,
    ).find((island) => island.tier === "continent");

    expect(continent).toBeDefined();
    const job = archipelagoGenerationJobForId(ready, continent!.id);

    expect(job?.parts).toHaveLength(21);
    minecraft.parts = [...job!.parts!];

    const first = job!.parts![0];
    const editedProbe = {
      x: first.origin.x + first.integrityBlock.offset.x,
      y: first.origin.y + first.integrityBlock.offset.y,
      z: first.origin.z + first.integrityBlock.offset.z,
    };
    minecraft.blockTypes.set(
      minecraft.locationKey(editedProbe),
      "minecraft:cobblestone",
    );

    const host = new MemoryHost();
    const repository = new WorldStateRepository(host, () => ready.worldSeed);
    const queued = queueGeneration(ready, job!);
    repository.save(advancePartCursor(queued, job!.id, 1));

    resumeGeneration(repository, new Logger("multipart-test", () => {}));

    await vi.waitFor(
      () => {
        expect(repository.load().activeGeneration).toBeUndefined();
      },
      { timeout: 10_000 },
    );

    const completed = repository.load();
    expect(completed.generatedIslandIds).toContain(continent!.id);
    expect(minecraft.placements).toHaveLength(20);
    expect(minecraft.blockTypes.get(minecraft.locationKey(editedProbe))).toBe(
      "minecraft:cobblestone",
    );
    expect(minecraft.tickingAreas.size).toBe(0);
    await Promise.resolve();
  });

  it("places a large a3 landmark through its bounded 16-part catalog", async () => {
    const initial = createWorldState(2030);
    const islandVersions: Record<string, number> = {};

    for (const island of REQUIRED_ISLANDS) {
      islandVersions[island.id] = island.contentVersion;
    }

    const ready = {
      ...initial,
      generatedIslandIds: REQUIRED_ISLANDS.map((island) => island.id),
      islandVersions,
    };
    const landmark = planArchipelagoV3(ready.worldSeed).find(
      (island) => island.tier === "landmark",
    );

    expect(landmark).toBeDefined();
    const job = archipelagoGenerationJobForId(ready, landmark!.id);

    expect(job?.parts).toHaveLength(16);
    minecraft.parts = [...job!.parts!];

    const host = new MemoryHost();
    const repository = new WorldStateRepository(host, () => ready.worldSeed);
    repository.save(queueGeneration(ready, job!));

    resumeGeneration(repository, new Logger("multipart-test", () => {}));

    await vi.waitFor(
      () => {
        expect(repository.load().activeGeneration).toBeUndefined();
      },
      { timeout: 10_000 },
    );

    const completed = repository.load();
    expect(completed.generatedIslandIds).toContain(landmark!.id);
    expect(minecraft.placements).toHaveLength(16);
    expect(minecraft.tickingAreas.size).toBe(0);
    await Promise.resolve();
  });
  // F1 regression. Reproduces the state left behind when place() returns
  // without landing blocks: the cursor has advanced past parts 0-3 but none
  // of their blocks exist. Before the fix the retry skipped every part below
  // the cursor and the row verification was filtered to parts at or after it,
  // so the row verified an empty set, passed, and the island completed with a
  // permanent void. Now an empty probe on a checkpointed part is re-placed.
  it("re-places checkpointed parts whose blocks never landed", async () => {
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
    const landmark = planArchipelagoV3(ready.worldSeed).find(
      (island) => island.tier === "landmark",
    );

    expect(landmark).toBeDefined();
    const job = archipelagoGenerationJobForId(ready, landmark!.id);
    expect(job?.parts).toHaveLength(16);
    minecraft.parts = [...job!.parts!];

    const host = new MemoryHost();
    const repository = new WorldStateRepository(host, () => ready.worldSeed);
    // Cursor claims parts 0-3 are done. No probe was ever written, so every
    // one of them is empty: they were never actually placed.
    repository.save(
      advancePartCursor(queueGeneration(ready, job!), job!.id, 4),
    );

    resumeGeneration(repository, new Logger("multipart-test", () => {}));

    await vi.waitFor(
      () => {
        expect(repository.load().activeGeneration).toBeUndefined();
      },
      { timeout: 10_000 },
    );

    // All 16 parts must exist, including the four the cursor had written off.
    expect(minecraft.placements).toHaveLength(16);

    for (const part of job!.parts!) {
      const probe = minecraft.locationKey({
        x: part.origin.x + part.integrityBlock.offset.x,
        y: part.origin.y + part.integrityBlock.offset.y,
        z: part.origin.z + part.integrityBlock.offset.z,
      });
      expect(minecraft.blockTypes.get(probe)).toBe(part.integrityBlock.typeId);
    }

    expect(repository.load().generatedIslandIds).toContain(landmark!.id);
    expect(minecraft.tickingAreas.size).toBe(0);
    await Promise.resolve();
  });

  // F2 regression. A non-retryable error used to leave activeGeneration set
  // forever. Nothing except completeGeneration ever cleared it, so the queue
  // believed generation was still busy and started no further ambient or
  // required island for the life of the world, silently and with no way to
  // recover. An a3 id encodes only its site index, so any planner constant
  // change re-derives a queued job into a mismatch and triggers exactly this.
  it("abandons an unrecoverable job instead of freezing all generation", async () => {
    const initial = createWorldState(2032);
    const islandVersions: Record<string, number> = {};

    for (const island of REQUIRED_ISLANDS) {
      islandVersions[island.id] = island.contentVersion;
    }

    const ready = {
      ...initial,
      generatedIslandIds: REQUIRED_ISLANDS.map((island) => island.id),
      islandVersions,
    };
    const landmark = planArchipelagoV3(ready.worldSeed).find(
      (island) => island.tier === "landmark",
    );
    const job = archipelagoGenerationJobForId(ready, landmark!.id);
    expect(job).toBeDefined();

    // Simulate a planner constant change: the queued job no longer matches
    // what the current plan derives for this site.
    const stale = {
      ...job!,
      origin: { x: job!.origin.x + 512, y: job!.origin.y, z: job!.origin.z },
    };

    const host = new MemoryHost();
    const repository = new WorldStateRepository(host, () => ready.worldSeed);
    repository.save(queueGeneration(ready, stale));
    expect(repository.load().activeGeneration).toBeDefined();

    resumeGeneration(repository, new Logger("multipart-test", () => {}));

    await vi.waitFor(
      () => {
        expect(repository.load().activeGeneration).toBeUndefined();
      },
      { timeout: 10_000 },
    );

    // Abandoned, not completed: the island must not be recorded as generated.
    const after = repository.load();
    expect(after.activeGeneration).toBeUndefined();
    expect(after.generatedIslandIds).not.toContain(landmark!.id);
    await Promise.resolve();
  });
});
