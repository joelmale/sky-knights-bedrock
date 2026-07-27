import { describe, expect, it } from "vitest";

import { islandDefinition } from "../scripts/config/islands";
import {
  ISLAND_CONTENT_TABLE,
  islandContentDefinition,
  resolveAnchorLocation,
  resolveIslandOrigin,
  shouldSpawnTaggedEntity,
  shouldStockLootChest,
} from "../scripts/generation/content-table";

describe("island content table", () => {
  it("contains only gameplay-ready island content, sorted by id", () => {
    const ids = ISLAND_CONTENT_TABLE.map((entry) => entry.id);

    expect(ids).toEqual([
      "aether_sanctum",
      "ashfall_crater",
      "ember_outpost",
      "frostspire",
      "glacier_vault",
      "sunspire_reach",
      "verdant_hollow",
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no entry for contentless or unknown islands", () => {
    expect(islandContentDefinition("starter_island")).toBeUndefined();
    expect(islandContentDefinition("unknown_island")).toBeUndefined();
    expect(islandContentDefinition("sunspire_reach")).toBeDefined();
    expect(islandContentDefinition("verdant_hollow")).toBeDefined();
    expect(islandContentDefinition("glacier_vault")).toBeDefined();
    expect(islandContentDefinition("ashfall_crater")).toBeDefined();
    expect(islandContentDefinition("aether_sanctum")).toBeDefined();
  });

  it("keeps ember_outpost's guaranteed loot byte-for-byte equivalent to the shipped chest", () => {
    const content = islandContentDefinition("ember_outpost");

    expect(content?.lootChest).toEqual({
      anchor: "lootChest",
      idempotencySlot: 0,
      idempotencyItemId: "skyknights:aether_crystal",
      items: [
        { slot: 0, itemId: "skyknights:aether_crystal", count: 1 },
        { slot: 1, itemId: "minecraft:emerald", count: 3 },
        { slot: 2, itemId: "minecraft:iron_ingot", count: 24 },
        { slot: 3, itemId: "minecraft:cooked_beef", count: 8 },
        { slot: 4, itemId: "minecraft:redstone", count: 8 },
      ],
    });
    expect(content?.encounters).toEqual([
      {
        entityId: "minecraft:husk",
        nameTag: "Ember Outpost Guardian",
        tag: "skyknights.ember_guard",
        anchor: "encounterSpawn",
        discoveryRadius: 12,
      },
    ]);
  });

  it("keeps frostspire's guaranteed cargo byte-for-byte equivalent to the shipped chest", () => {
    const content = islandContentDefinition("frostspire");

    expect(content?.lootChest).toEqual({
      anchor: "lootChest",
      idempotencySlot: 0,
      idempotencyItemId: "skyknights:froststeel_ingot",
      items: [
        { slot: 0, itemId: "skyknights:froststeel_ingot", count: 16 },
        { slot: 1, itemId: "minecraft:diamond", count: 2 },
        { slot: 2, itemId: "minecraft:arrow", count: 24 },
        { slot: 3, itemId: "minecraft:cooked_salmon", count: 8 },
      ],
    });
    expect(content?.encounters).toEqual([
      {
        entityId: "minecraft:stray",
        nameTag: "Frostspire Warden",
        tag: "skyknights.frost_guard",
        anchor: "encounterSpawn",
        discoveryRadius: 12,
      },
    ]);
  });
});

describe("loot chest idempotency", () => {
  it("stocks only when the idempotency slot lacks the marker item", () => {
    const content = { idempotencyItemId: "skyknights:aether_crystal" };

    expect(shouldStockLootChest(undefined, content)).toBe(true);
    expect(shouldStockLootChest("minecraft:air", content)).toBe(true);
    expect(shouldStockLootChest("skyknights:aether_crystal", content)).toBe(
      false,
    );
  });
});

describe("tagged entity idempotency", () => {
  it("spawns only when no matching tagged entity already exists", () => {
    expect(shouldSpawnTaggedEntity(0)).toBe(true);
    expect(shouldSpawnTaggedEntity(1)).toBe(false);
    expect(shouldSpawnTaggedEntity(2)).toBe(false);
  });
});

describe("anchor resolution", () => {
  const origin = { x: 72, y: 151, z: -10 };
  const anchors = islandDefinition("ember_outpost").anchors;

  it("resolves a named anchor relative to the origin", () => {
    expect(resolveAnchorLocation(origin, anchors, "lootChest")).toEqual({
      x: 84,
      y: 161,
      z: 0,
    });
    expect(resolveAnchorLocation(origin, anchors, "encounterSpawn")).toEqual({
      x: 84.5,
      y: 161,
      z: 4.5,
    });
  });

  it("returns undefined for an anchor the island has no field for", () => {
    const starter = islandDefinition("starter_island").anchors;
    expect(resolveAnchorLocation(origin, starter, "lootChest")).toBeUndefined();
  });

  it("resolves a raw offset anchor relative to the origin", () => {
    expect(
      resolveAnchorLocation(origin, anchors, { x: 1, y: 2, z: 3 }),
    ).toEqual({
      x: 73,
      y: 153,
      z: -7,
    });
  });
});

describe("island origin resolution", () => {
  it("falls back to the shipped pinned origin for pinned islands", () => {
    expect(resolveIslandOrigin("ember_outpost", undefined)).toEqual({
      x: 72,
      y: 151,
      z: -10,
    });
  });

  it("prefers an explicitly supplied origin over the pinned one", () => {
    expect(resolveIslandOrigin("ember_outpost", { x: 1, y: 2, z: 3 })).toEqual({
      x: 1,
      y: 2,
      z: 3,
    });
  });

  it("throws for a seeded island with no explicit origin", () => {
    expect(() => resolveIslandOrigin("sunspire_reach", undefined)).toThrow(
      /sunspire_reach/,
    );
  });
});
