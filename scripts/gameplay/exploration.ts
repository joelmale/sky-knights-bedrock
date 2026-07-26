import { Player, world } from "@minecraft/server";

import { EMBER_OUTPOST, FROSTSPIRE } from "../config/constants";
import { PlayerStateRepository } from "../persistence/repositories";

const DISCOVERY_DISTANCE_SQUARED = 24 * 24;

export function runDestinationDiscoverySweep(): void {
  for (const player of world.getAllPlayers()) {
    discoverEmberOutpost(player);
    discoverFrostspire(player);
  }
}

function discoverFrostspire(player: Player): void {
  if (player.dimension.id !== FROSTSPIRE.dimensionId) {
    return;
  }

  const dx = player.location.x - FROSTSPIRE.lootChest.x;
  const dy = player.location.y - FROSTSPIRE.lootChest.y;
  const dz = player.location.z - FROSTSPIRE.lootChest.z;

  if (dx * dx + dy * dy + dz * dz > DISCOVERY_DISTANCE_SQUARED) {
    return;
  }

  const repository = new PlayerStateRepository(player, {
    dimensionId: FROSTSPIRE.dimensionId,
    x: FROSTSPIRE.origin.x + 1.5,
    y: 161,
    z: FROSTSPIRE.origin.z + 11.5,
  });
  const state = repository.load();

  if (state.discoveredIslandIds.includes(FROSTSPIRE.id)) {
    return;
  }

  state.discoveredIslandIds.push(FROSTSPIRE.id);

  if (state.objective === "reach_frostspire") {
    state.objective = "return_frost_cargo";
  }

  repository.save(state);
  player.sendMessage("§bFrostspire discovered.§r");
  player.sendMessage(
    "Defeat the Frostspire Warden and load Froststeel into the Skycutter cargo hold.",
  );
}

function discoverEmberOutpost(player: Player): void {
  if (player.dimension.id !== EMBER_OUTPOST.dimensionId) {
    return;
  }

  const dx = player.location.x - EMBER_OUTPOST.lootChest.x;
  const dy = player.location.y - EMBER_OUTPOST.lootChest.y;
  const dz = player.location.z - EMBER_OUTPOST.lootChest.z;

  if (dx * dx + dy * dy + dz * dz > DISCOVERY_DISTANCE_SQUARED) {
    return;
  }

  const repository = new PlayerStateRepository(player, {
    dimensionId: EMBER_OUTPOST.dimensionId,
    x: EMBER_OUTPOST.origin.x + 1.5,
    y: 161,
    z: EMBER_OUTPOST.origin.z + 10.5,
  });
  const state = repository.load();

  if (state.discoveredIslandIds.includes(EMBER_OUTPOST.id)) {
    return;
  }

  state.discoveredIslandIds.push(EMBER_OUTPOST.id);
  repository.save(state);
  player.sendMessage("§6Ember Outpost discovered.§r");
  player.sendMessage(
    "Defeat the guardian and recover the Aether Crystal from the ruin chest.",
  );
}
