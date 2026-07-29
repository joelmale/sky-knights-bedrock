import { describe, expect, it } from "vitest";

import {
  compactWorldDocument,
  decodeBase64,
  encodeBase64,
  expandWorldDocument,
} from "../scripts/persistence/compact";

function document(ids: string[], version = 3) {
  const islandVersions: Record<string, number> = {};

  for (const id of ids) {
    islandVersions[id] = version;
  }

  return {
    schemaVersion: 5,
    generatedIslandIds: ids,
    islandVersions,
  };
}

describe("world document compaction", () => {
  it("round-trips base64 for every byte value", () => {
    for (const length of [0, 1, 2, 3, 4, 5, 255, 321]) {
      const bytes = new Uint8Array(length);

      for (let index = 0; index < length; index += 1) {
        bytes[index] = (index * 7 + 13) % 256;
      }

      expect(
        [...decodeBase64(encodeBase64(bytes))],
        `length ${length}`,
      ).toEqual([...bytes]);
    }
  });

  it("restores exactly the island set it compacted", () => {
    const ids = ["a3_0", "a3_1", "a3_zz", "a3_1z6", "a3_5"];
    const compacted = compactWorldDocument(document(ids)) as Record<
      string,
      unknown
    >;

    expect(compacted.a3).toBeDefined();
    expect(compacted.generatedIslandIds).toEqual([]);
    expect(compacted.islandVersions).toEqual({});

    const restored = expandWorldDocument(compacted) as Record<string, unknown>;

    expect([...(restored.generatedIslandIds as string[])].sort()).toEqual(
      [...ids].sort(),
    );
    expect(restored.islandVersions).toEqual(document(ids).islandVersions);
    expect(restored.a3).toBeUndefined();
  });

  it("keeps a3 and a4 histories in independent bitsets", () => {
    const ids = ["a3_0", "a3_2", "a4_1", "a4_zz"];
    const source = document(ids);
    source.islandVersions.a4_1 = 4;
    source.islandVersions.a4_zz = 4;
    const compacted = compactWorldDocument(source) as Record<string, unknown>;

    expect(compacted.a3).toBeDefined();
    expect(compacted.a4).toBeDefined();
    expect(compacted.generatedIslandIds).toEqual([]);
    expect(compacted.islandVersions).toEqual({});

    const restored = expandWorldDocument(compacted) as Record<string, unknown>;
    expect([...(restored.generatedIslandIds as string[])].sort()).toEqual(
      [...ids].sort(),
    );
    expect(restored.islandVersions).toEqual(source.islandVersions);
    expect(restored.a3).toBeUndefined();
    expect(restored.a4).toBeUndefined();
  });

  it("leaves authored, a1 and a2 ids as strings", () => {
    const ids = ["starter_island", "a1_p3_n2", "a2_p11_p19", "a3_7"];
    const compacted = compactWorldDocument(document(ids)) as Record<
      string,
      unknown
    >;

    expect(compacted.generatedIslandIds).toEqual([
      "starter_island",
      "a1_p3_n2",
      "a2_p11_p19",
    ]);

    const restored = expandWorldDocument(compacted) as Record<string, unknown>;
    expect([...(restored.generatedIslandIds as string[])].sort()).toEqual(
      [...ids].sort(),
    );
  });

  // The bitset carries one shared content version. Mixed versions cannot be
  // expressed, so compaction must decline rather than lose information.
  it("declines to compact when a3 content versions differ", () => {
    const source = document(["a3_1", "a3_2"]);
    source.islandVersions.a3_2 = 4;

    expect(compactWorldDocument(source)).toBe(source);
  });

  it("can compact a4 even when mixed a3 history must stay expanded", () => {
    const source = document(["a3_1", "a3_2", "a4_3"]);
    source.islandVersions.a3_2 = 4;
    source.islandVersions.a4_3 = 4;
    const compacted = compactWorldDocument(source) as Record<string, unknown>;

    expect(compacted.a3).toBeUndefined();
    expect(compacted.a4).toBeDefined();
    expect(compacted.generatedIslandIds).toEqual(["a3_1", "a3_2"]);
    expect(compacted.islandVersions).toEqual({ a3_1: 3, a3_2: 4 });
    expect(expandWorldDocument(compacted)).toEqual(source);
  });

  it("passes through a document that was never compacted", () => {
    const source = document(["starter_island"]);
    expect(expandWorldDocument(source)).toBe(source);
  });

  // The measured reason this exists: 20 bytes per island as strings against a
  // fixed cost for the bitset.
  it("stores a full 1,500-island world in a fraction of the string form", () => {
    const ids = Array.from(
      { length: 1500 },
      (_, index) => `a3_${(index + 1000).toString(36)}`,
    );
    const plain = JSON.stringify(document(ids)).length;
    const compacted = JSON.stringify(
      compactWorldDocument(document(ids)),
    ).length;

    expect(plain).toBeGreaterThan(29_000);
    expect(compacted).toBeLessThan(1_000);
    expect(compacted * 25).toBeLessThan(plain);
  });
});
