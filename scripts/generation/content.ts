import {
  BlockComponentTypes,
  BlockInventoryComponent,
  Dimension,
  ItemStack,
} from "@minecraft/server";

import { EMBER_OUTPOST, FROSTSPIRE, IDENTIFIERS } from "../config/constants";
import { Logger } from "../diagnostics/logger";

const EMBER_GUARD_TAG = "skyknights.ember_guard";
const FROST_GUARD_TAG = "skyknights.frost_guard";

export function prepareIslandContent(
  islandId: string,
  dimension: Dimension,
  logger: Logger,
): void {
  if (islandId === EMBER_OUTPOST.id) {
    prepareEmberLoot(dimension, logger);
    prepareEmberEncounter(dimension, logger);
  }

  if (islandId === FROSTSPIRE.id) {
    prepareFrostspireLoot(dimension, logger);
    prepareFrostspireEncounter(dimension, logger);
  }
}

function prepareEmberLoot(dimension: Dimension, logger: Logger): void {
  const block = dimension.getBlock(EMBER_OUTPOST.lootChest);

  if (block === undefined) {
    throw new Error("Ember Outpost loot chest block is unavailable.");
  }

  block.setType("minecraft:chest");
  const inventory = block.getComponent(BlockComponentTypes.Inventory) as
    BlockInventoryComponent | undefined;
  const container = inventory?.container;

  if (container === undefined) {
    throw new Error("Ember Outpost loot chest has no inventory.");
  }

  if (container.getItem(0)?.typeId === IDENTIFIERS.aetherCrystal) {
    return;
  }

  container.clearAll();
  container.setItem(0, new ItemStack(IDENTIFIERS.aetherCrystal));
  container.setItem(1, new ItemStack("minecraft:emerald", 3));
  container.setItem(2, new ItemStack("minecraft:iron_ingot", 24));
  container.setItem(3, new ItemStack("minecraft:cooked_beef", 8));
  container.setItem(4, new ItemStack("minecraft:redstone", 8));
  logger.info("Ember Outpost guaranteed loot prepared.", {
    location: EMBER_OUTPOST.lootChest,
  });
}

function prepareEmberEncounter(dimension: Dimension, logger: Logger): void {
  const existing = dimension.getEntities({
    location: EMBER_OUTPOST.encounterSpawn,
    maxDistance: 12,
    tags: [EMBER_GUARD_TAG],
  });

  if (existing.length > 0) {
    return;
  }

  const guard = dimension.spawnEntity(
    "minecraft:husk",
    EMBER_OUTPOST.encounterSpawn,
    { initialPersistence: true },
  );
  guard.nameTag = "Ember Outpost Guardian";
  guard.addTag(EMBER_GUARD_TAG);
  logger.info("Ember Outpost encounter prepared.", {
    entityId: guard.id,
  });
}

function prepareFrostspireLoot(dimension: Dimension, logger: Logger): void {
  const block = dimension.getBlock(FROSTSPIRE.lootChest);

  if (block === undefined) {
    throw new Error("Frostspire loot chest block is unavailable.");
  }

  block.setType("minecraft:chest");
  const inventory = block.getComponent(BlockComponentTypes.Inventory) as
    BlockInventoryComponent | undefined;
  const container = inventory?.container;

  if (container === undefined) {
    throw new Error("Frostspire loot chest has no inventory.");
  }

  if (container.getItem(0)?.typeId === IDENTIFIERS.froststeelIngot) {
    return;
  }

  container.clearAll();
  container.setItem(0, new ItemStack(IDENTIFIERS.froststeelIngot, 16));
  container.setItem(1, new ItemStack("minecraft:diamond", 2));
  container.setItem(2, new ItemStack("minecraft:arrow", 24));
  container.setItem(3, new ItemStack("minecraft:cooked_salmon", 8));
  logger.info("Frostspire guaranteed cargo prepared.", {
    location: FROSTSPIRE.lootChest,
  });
}

function prepareFrostspireEncounter(
  dimension: Dimension,
  logger: Logger,
): void {
  const existing = dimension.getEntities({
    location: FROSTSPIRE.encounterSpawn,
    maxDistance: 12,
    tags: [FROST_GUARD_TAG],
  });

  if (existing.length > 0) {
    return;
  }

  const guard = dimension.spawnEntity(
    "minecraft:stray",
    FROSTSPIRE.encounterSpawn,
    { initialPersistence: true },
  );
  guard.nameTag = "Frostspire Warden";
  guard.addTag(FROST_GUARD_TAG);
  logger.info("Frostspire encounter prepared.", {
    entityId: guard.id,
  });
}
