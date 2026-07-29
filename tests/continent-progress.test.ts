import { describe, expect, it } from "vitest";

import {
  CONTINENT_PROGRESS_PROPERTY_KEY,
  ContinentProgressRepository,
  beginContinentChunkProgress,
  completeContinentChunkProgress,
  createContinentProgressState,
  parseContinentProgressState,
} from "../scripts/persistence/continent-progress";
import { DynamicPropertyHost } from "../scripts/persistence/repositories";

class MemoryHost implements DynamicPropertyHost {
  public readonly values = new Map<string, string>();

  public getDynamicProperty(identifier: string): string | undefined {
    return this.values.get(identifier);
  }

  public setDynamicProperty(identifier: string, value?: string): void {
    if (value === undefined) {
      this.values.delete(identifier);
    } else {
      this.values.set(identifier, value);
    }
  }
}

describe("formula continent progress persistence", () => {
  it("creates a separate fixed-schema property without changing world state", () => {
    const host = new MemoryHost();
    const repository = new ContinentProgressRepository(host, 2026);

    expect(repository.load()).toEqual(createContinentProgressState(2026));
    expect(host.values.has("skyknights:world_state")).toBe(false);
    expect(host.values.get(CONTINENT_PROGRESS_PROPERTY_KEY)).toBe(
      JSON.stringify(createContinentProgressState(2026)),
    );
  });

  it("round-trips canonical c1 progress in sorted order", () => {
    const host = new MemoryHost();
    const repository = new ContinentProgressRepository(host, 42);
    let state = repository.load();
    state = beginContinentChunkProgress(state, "c1_5", 1);
    state = completeContinentChunkProgress(state, "c1_5", 1, "BBBB");
    state = beginContinentChunkProgress(state, "c1_0", 2);
    state = completeContinentChunkProgress(state, "c1_0", 2, "AAAA");
    repository.save(state);

    expect(Object.keys(repository.load().chunks)).toEqual(["c1_0", "c1_5"]);
    expect(repository.load().chunks).toEqual({
      c1_0: "AAAA",
      c1_5: "BBBB",
    });
  });

  it("fails closed on mismatched, unknown, or malformed persisted state", () => {
    expect(() =>
      parseContinentProgressState(
        {
          schemaVersion: 1,
          worldSeed: 7,
          fieldVersion: 1,
          chunks: {},
        },
        8,
      ),
    ).toThrow(/different world seed/u);
    expect(() =>
      parseContinentProgressState(
        {
          schemaVersion: 2,
          worldSeed: 8,
          fieldVersion: 1,
          chunks: {},
        },
        8,
      ),
    ).toThrow(/Unsupported continent progress schema/u);
    expect(() =>
      parseContinentProgressState(
        {
          schemaVersion: 1,
          worldSeed: 8,
          fieldVersion: 1,
          chunks: { a2_p0_p0: "AAAA" },
        },
        8,
      ),
    ).toThrow(/Invalid continent progress entry/u);
  });

  it("persists one exact in-flight chunk and rejects out-of-order completion", () => {
    const state = createContinentProgressState(1);

    expect(() => beginContinentChunkProgress(state, "a2_p0_p0", 0)).toThrow(
      /Invalid formula continent id/u,
    );
    const active = beginContinentChunkProgress(state, "c1_0", 12);

    expect(active.activeChunk).toEqual({
      continentId: "c1_0",
      chunkIndex: 12,
    });
    expect(() => beginContinentChunkProgress(active, "c1_1", 4)).toThrow(
      /is active/u,
    );
    expect(() =>
      completeContinentChunkProgress(active, "c1_0", 11, "AAAA"),
    ).toThrow(/inactive continent chunk/u);
    expect(() =>
      completeContinentChunkProgress(active, "c1_0", 12, ""),
    ).toThrow(/must not be empty/u);

    const completed = completeContinentChunkProgress(
      active,
      "c1_0",
      12,
      "AAAA",
    );
    expect(completed.activeChunk).toBeUndefined();
    expect(completed.chunks.c1_0).toBe("AAAA");
  });
});
