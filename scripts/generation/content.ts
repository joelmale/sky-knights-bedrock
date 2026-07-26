// Table-driven guaranteed island content: guaranteed loot, guard encounters,
// and NPCs. Behavior for the shipped islands (ember_outpost, frostspire) is
// byte-for-byte equivalent to the previous hardcoded if/else implementation;
// the table itself lives in `content-table.ts` so it can be unit tested
// without the @minecraft/server runtime.

import { ItemStack } from "@minecraft/server";
import type { BlockInventoryComponent, Dimension } from "@minecraft/server";

import { IslandAnchors, islandDefinition } from "../config/islands";
import { Logger } from "../diagnostics/logger";
import { BlockVector } from "./bounds";
import {
  IslandContentAnchor,
  LootChestContent,
  TaggedEntityContent,
  islandContentDefinition,
  resolveAnchorLocation,
  resolveIslandOrigin,
  shouldSpawnTaggedEntity,
  shouldStockLootChest,
} from "./content-table";

/**
 * Prepares an island's guaranteed loot, encounters, and NPCs. Re-running
 * preserves a chest that still carries its marker item and never duplicates a
 * tagged encounter/NPC. A deliberately emptied guaranteed chest is restored
 * if a content repair or version upgrade runs.
 *
 * `origin` is required for seeded (non-pinned) islands; pinned islands fall
 * back to their shipped origin automatically.
 */
export function prepareIslandContent(
  islandId: string,
  dimension: Dimension,
  logger: Logger,
  origin?: BlockVector,
): void {
  const content = islandContentDefinition(islandId);

  if (content === undefined) {
    return;
  }

  const resolvedOrigin = resolveIslandOrigin(islandId, origin);
  const anchors = islandDefinition(islandId).anchors;

  if (content.lootChest !== undefined) {
    prepareLootChest(
      islandId,
      content.lootChest,
      resolvedOrigin,
      anchors,
      dimension,
      logger,
    );
  }

  for (const encounter of content.encounters ?? []) {
    prepareTaggedEntity(
      islandId,
      encounter,
      resolvedOrigin,
      anchors,
      dimension,
      logger,
    );
  }

  for (const npc of content.npcs ?? []) {
    prepareTaggedEntity(
      islandId,
      npc,
      resolvedOrigin,
      anchors,
      dimension,
      logger,
    );
  }
}

function anchorLocationOrThrow(
  islandId: string,
  origin: BlockVector,
  anchors: IslandAnchors,
  anchor: IslandContentAnchor,
): BlockVector {
  const location = resolveAnchorLocation(origin, anchors, anchor);

  if (location === undefined) {
    throw new Error(`${islandId} has no ${anchor} anchor.`);
  }

  return location;
}

function prepareLootChest(
  islandId: string,
  content: LootChestContent,
  origin: BlockVector,
  anchors: IslandAnchors,
  dimension: Dimension,
  logger: Logger,
): void {
  const location = anchorLocationOrThrow(
    islandId,
    origin,
    anchors,
    content.anchor,
  );
  const block = dimension.getBlock(location);

  if (block === undefined) {
    throw new Error(`${islandId} loot chest block is unavailable.`);
  }

  if (block.typeId !== "minecraft:chest") {
    block.setType("minecraft:chest");
  }
  const inventory = block.getComponent("minecraft:inventory") as
    BlockInventoryComponent | undefined;
  const container = inventory?.container;

  if (container === undefined) {
    throw new Error(`${islandId} loot chest has no inventory.`);
  }

  const idempotencyItem = container.getItem(content.idempotencySlot);

  if (!shouldStockLootChest(idempotencyItem?.typeId, content)) {
    return;
  }

  container.clearAll();

  for (const item of content.items) {
    container.setItem(item.slot, new ItemStack(item.itemId, item.count));
  }

  logger.info(`${islandId} guaranteed loot prepared.`, { location });
}

function prepareTaggedEntity(
  islandId: string,
  content: TaggedEntityContent,
  origin: BlockVector,
  anchors: IslandAnchors,
  dimension: Dimension,
  logger: Logger,
): void {
  const location = anchorLocationOrThrow(
    islandId,
    origin,
    anchors,
    content.anchor,
  );
  const existing = dimension.getEntities({
    location,
    maxDistance: content.discoveryRadius,
    tags: [content.tag],
  });

  if (!shouldSpawnTaggedEntity(existing.length)) {
    return;
  }

  const entity = dimension.spawnEntity(content.entityId, location, {
    initialPersistence: true,
  });

  if (content.nameTag !== undefined) {
    entity.nameTag = content.nameTag;
  }

  entity.addTag(content.tag);
  logger.info(`${islandId} ${content.tag} prepared.`, { entityId: entity.id });
}
