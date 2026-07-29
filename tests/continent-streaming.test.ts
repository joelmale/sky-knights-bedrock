import { describe, expect, it } from "vitest";

import {
  CONTINENT_FILL_BLOCK_CAP,
  CONTINENT_STREAMING_SITE_COUNT,
  completeContinentChunk,
  continentStreamingChunkAt,
  continentStreamingId,
  createContinentChunkBitset,
  decodeContinentChunkBitset,
  deriveContinentStreamingSites,
  encodeContinentChunkBitset,
  isContinentStreamingComplete,
  nextContinentStreamingChunk,
  parseContinentStreamingId,
} from "../scripts/generation/continent-streaming";

const SEED = 0x5c07f1ed;
const OPTIONS = { legacyLayoutVersion: 2, span: 600 };

function firstSite() {
  return deriveContinentStreamingSites(SEED, OPTIONS)[0];
}

describe("formula continent namespace", () => {
  it("uses canonical c1 IDs and never accepts legacy namespaces", () => {
    for (let index = 0; index < CONTINENT_STREAMING_SITE_COUNT; index += 1) {
      expect(continentStreamingId(index)).toBe(`c1_${index}`);
      expect(parseContinentStreamingId(`c1_${index}`)).toBe(index);
    }

    expect(parseContinentStreamingId("a2_p24_p0")).toBeUndefined();
    expect(parseContinentStreamingId("a3_0")).toBeUndefined();
    expect(parseContinentStreamingId("a4_0")).toBeUndefined();
    expect(parseContinentStreamingId("c1_00")).toBeUndefined();
    expect(parseContinentStreamingId("c1_6")).toBeUndefined();
  });

  it("uses only the six legacy sites and suppresses existing a2 continent sites", () => {
    const all = deriveContinentStreamingSites(SEED, OPTIONS);
    const suppressed = deriveContinentStreamingSites(SEED, {
      ...OPTIONS,
      existingLegacySiteIndices: [1, 4],
    });

    expect(all).toHaveLength(CONTINENT_STREAMING_SITE_COUNT);
    expect(all.map((site) => site.siteIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(suppressed.map((site) => site.siteIndex)).toEqual([0, 2, 3, 5]);
    expect(suppressed.map((site) => site.id)).toEqual([
      "c1_0",
      "c1_2",
      "c1_3",
      "c1_5",
    ]);
    expect(() =>
      deriveContinentStreamingSites(SEED, { ...OPTIONS, span: 601 }),
    ).toThrow(RangeError);
  });
});

describe("fixed chunk bitsets", () => {
  it("round-trips fixed-size progress and rejects corrupt data fail-closed", () => {
    const site = firstSite();
    let progress = createContinentChunkBitset(site);
    progress = completeContinentChunk(site, progress, 0);
    progress = completeContinentChunk(
      site,
      progress,
      site.chunkBounds.count - 1,
    );
    const encoded = encodeContinentChunkBitset(site, progress);

    expect(decodeContinentChunkBitset(site, encoded)).toEqual(progress);
    expect(decodeContinentChunkBitset(site, encoded.slice(1))).toBeUndefined();
    expect(
      decodeContinentChunkBitset(site, `${encoded.slice(0, -1)}!`),
    ).toBeUndefined();
    expect(decodeContinentChunkBitset(site, "AAAA")).toBeUndefined();

    const corrupt = new Uint8Array(progress);
    corrupt[corrupt.length - 1] |= 0x80;
    expect(() => encodeContinentChunkBitset(site, corrupt)).toThrow(RangeError);
  });
});

describe("chunk scheduling", () => {
  it("selects incomplete chunks deterministically, prioritizing the observer", () => {
    const site = firstSite();
    const progress = createContinentChunkBitset(site);
    const nearEast = {
      x: site.chunkBounds.maxChunkX * 16 + 8,
      z: site.chunkBounds.minChunkZ * 16 + 8,
    };
    const first = nextContinentStreamingChunk(site, progress, nearEast)!;
    const repeated = nextContinentStreamingChunk(site, progress, nearEast)!;

    expect(repeated).toEqual(first);
    expect(continentStreamingChunkAt(site, first.chunkIndex)).toEqual(first);
    expect(() => continentStreamingChunkAt(site, -1)).toThrow(RangeError);
    expect(() =>
      continentStreamingChunkAt(site, site.chunkBounds.count),
    ).toThrow(RangeError);
    expect(first.chunkX).toBe(site.chunkBounds.maxChunkX);
    expect(first.chunkZ).toBe(site.chunkBounds.minChunkZ);

    expect(
      nextContinentStreamingChunk(site, progress, {
        x: nearEast.x + 0.75,
        z: nearEast.z - 0.25,
      }),
    ).toEqual(first);

    const completed = completeContinentChunk(site, progress, first.chunkIndex);
    expect(
      nextContinentStreamingChunk(site, completed, nearEast)?.chunkIndex,
    ).not.toBe(first.chunkIndex);
  });

  it("returns one bounded chunk plan whose volumes can each be filled directly", () => {
    const site = firstSite();
    const task = nextContinentStreamingChunk(
      site,
      createContinentChunkBitset(site),
      { x: site.field.centerX, z: site.field.centerZ },
    )!;

    expect(task.chunkX).toBeGreaterThanOrEqual(site.chunkBounds.minChunkX);
    expect(task.chunkX).toBeLessThanOrEqual(site.chunkBounds.maxChunkX);
    expect(task.chunkZ).toBeGreaterThanOrEqual(site.chunkBounds.minChunkZ);
    expect(task.chunkZ).toBeLessThanOrEqual(site.chunkBounds.maxChunkZ);
    expect(task.plan.blocks).toBeLessThanOrEqual(CONTINENT_FILL_BLOCK_CAP);
    expect(task.volumes).toEqual(task.plan.volumes);
    for (const volume of task.volumes) {
      expect(volume.blocks).toBeLessThanOrEqual(CONTINENT_FILL_BLOCK_CAP);
      expect(volume.from.x).toBeGreaterThanOrEqual(task.chunkX * 16);
      expect(volume.to.x).toBeLessThan(task.chunkX * 16 + 16);
      expect(volume.from.z).toBeGreaterThanOrEqual(task.chunkZ * 16);
      expect(volume.to.z).toBeLessThan(task.chunkZ * 16 + 16);
    }
  });

  it("reports completion only after every fixed chunk index is acknowledged", () => {
    const site = firstSite();
    let progress = createContinentChunkBitset(site);

    expect(isContinentStreamingComplete(site, progress)).toBe(false);
    for (let index = 0; index < site.chunkBounds.count; index += 1) {
      progress = completeContinentChunk(site, progress, index);
    }

    expect(isContinentStreamingComplete(site, progress)).toBe(true);
    expect(
      nextContinentStreamingChunk(site, progress, { x: 0, z: 0 }),
    ).toBeUndefined();
  });
});
