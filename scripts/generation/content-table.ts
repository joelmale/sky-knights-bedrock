// Declarative, per-island guaranteed content. This module is deliberately
// separate from content.ts so the safety contract can be unit-tested without
// @minecraft/server.

import {
  IslandAnchors,
  islandDefinition,
  isIslandGameplayReady,
} from "../config/islands";
import { BlockVector, addBlockVectors } from "./bounds";

export type IslandContentAnchor =
  "safeDock" | "lootChest" | "encounterSpawn" | BlockVector;

export interface GuaranteedLootItem {
  slot: number;
  itemId: string;
  count: number;
}

export interface LootChestContent {
  anchor: IslandContentAnchor;
  idempotencySlot: number;
  idempotencyItemId: string;
  items: readonly GuaranteedLootItem[];
}

export interface TaggedEntityContent {
  entityId: string;
  nameTag?: string;
  tag: string;
  anchor: IslandContentAnchor;
  discoveryRadius: number;
}

export interface IslandContentDefinition {
  id: string;
  lootChest?: LootChestContent;
  encounters?: readonly TaggedEntityContent[];
  npcs?: readonly TaggedEntityContent[];
}

const AETHER_CRYSTAL = "skyknights:aether_crystal";
const FROSTSTEEL_INGOT = "skyknights:froststeel_ingot";

/**
 * Only islands whose registry explicitly says `gameplayActivation: "ready"`
 * can appear here. New Phase 3 islands are structure-only until the custom
 * entity/item assets they need are genuinely packaged and registered.
 */
export const ISLAND_CONTENT_TABLE: readonly IslandContentDefinition[] = [
  {
    id: "ember_outpost",
    lootChest: {
      anchor: "lootChest",
      idempotencySlot: 0,
      idempotencyItemId: AETHER_CRYSTAL,
      items: [
        { slot: 0, itemId: AETHER_CRYSTAL, count: 1 },
        { slot: 1, itemId: "minecraft:emerald", count: 3 },
        { slot: 2, itemId: "minecraft:iron_ingot", count: 24 },
        { slot: 3, itemId: "minecraft:cooked_beef", count: 8 },
        { slot: 4, itemId: "minecraft:redstone", count: 8 },
      ],
    },
    encounters: [
      {
        entityId: "minecraft:husk",
        nameTag: "Ember Outpost Guardian",
        tag: "skyknights.ember_guard",
        anchor: "encounterSpawn",
        discoveryRadius: 12,
      },
    ],
  },
  {
    id: "frostspire",
    lootChest: {
      anchor: "lootChest",
      idempotencySlot: 0,
      idempotencyItemId: FROSTSTEEL_INGOT,
      items: [
        { slot: 0, itemId: FROSTSTEEL_INGOT, count: 16 },
        { slot: 1, itemId: "minecraft:diamond", count: 2 },
        { slot: 2, itemId: "minecraft:arrow", count: 24 },
        { slot: 3, itemId: "minecraft:cooked_salmon", count: 8 },
      ],
    },
    encounters: [
      {
        entityId: "minecraft:stray",
        nameTag: "Frostspire Warden",
        tag: "skyknights.frost_guard",
        anchor: "encounterSpawn",
        discoveryRadius: 12,
      },
    ],
  },
];

export function islandContentDefinition(
  id: string,
): IslandContentDefinition | undefined {
  let definition;

  try {
    definition = islandDefinition(id);
  } catch {
    return undefined;
  }

  return isIslandGameplayReady(definition)
    ? ISLAND_CONTENT_TABLE.find((entry) => entry.id === id)
    : undefined;
}

export function resolveAnchorLocation(
  origin: BlockVector,
  anchors: IslandAnchors,
  anchor: IslandContentAnchor,
): BlockVector | undefined {
  if (typeof anchor !== "string") {
    return addBlockVectors(origin, anchor);
  }

  const offset = anchors[anchor];
  return offset === undefined ? undefined : addBlockVectors(origin, offset);
}

export function resolveIslandOrigin(
  islandId: string,
  origin: BlockVector | undefined,
): BlockVector {
  if (origin !== undefined) {
    return origin;
  }

  const pinnedOrigin = islandDefinition(islandId).pinnedOrigin;
  if (pinnedOrigin === undefined) {
    throw new Error(
      `${islandId} has no pinned origin; pass its generated origin explicitly.`,
    );
  }

  return pinnedOrigin;
}

export function shouldStockLootChest(
  idempotencySlotTypeId: string | undefined,
  content: Pick<LootChestContent, "idempotencyItemId">,
): boolean {
  return idempotencySlotTypeId !== content.idempotencyItemId;
}

export function shouldSpawnTaggedEntity(existingTaggedCount: number): boolean {
  return existingTaggedCount === 0;
}
