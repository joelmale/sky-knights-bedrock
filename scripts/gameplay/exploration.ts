import {
  EntityComponentTypes,
  EntityInventoryComponent,
  Player,
  world,
} from "@minecraft/server";

import { ISLAND_DEFINITIONS, IslandDefinition } from "../config/islands";
import { STARTER_ISLAND } from "../config/constants";
import { Logger } from "../diagnostics/logger";
import { prepareDestinationGeneration } from "../generation/service";
import {
  PlayerStateRepository,
  WorldStateRepository,
} from "../persistence/repositories";

const DISCOVERY_DISTANCE_SQUARED = 24 * 24;
const GENERATION_DISTANCE_SQUARED = 96 * 96;

export function runDestinationDiscoverySweep(
  worldRepository: WorldStateRepository,
  logger: Logger,
): void {
  const worldState = worldRepository.load();

  for (const player of world.getAllPlayers()) {
    for (const definition of ISLAND_DEFINITIONS) {
      if (definition.id === STARTER_ISLAND.id) {
        continue;
      }

      const layout = worldState.islandLayout[definition.id];
      if (
        layout === undefined ||
        player.dimension.id !== definition.dimensionId
      ) {
        continue;
      }

      const safeDock = {
        x: layout.origin.x + definition.anchors.safeDock.x,
        y: layout.origin.y + definition.anchors.safeDock.y,
        z: layout.origin.z + definition.anchors.safeDock.z,
      };
      const distanceSquared = squaredDistance(player.location, safeDock);

      if (
        distanceSquared <= GENERATION_DISTANCE_SQUARED &&
        !worldState.generatedIslandIds.includes(definition.id) &&
        canPrepareDestination(player, definition)
      ) {
        prepareDestinationGeneration(
          worldRepository,
          logger.child(definition.id),
          definition.id,
        );
      }

      if (
        distanceSquared <= DISCOVERY_DISTANCE_SQUARED &&
        worldState.generatedIslandIds.includes(definition.id)
      ) {
        discoverIsland(player, definition, safeDock);
      }
    }
  }
}

function canPrepareDestination(
  player: Player,
  definition: IslandDefinition,
): boolean {
  if (definition.id !== "aether_sanctum") {
    return true;
  }

  const inventory = player.getComponent(EntityComponentTypes.Inventory) as
    EntityInventoryComponent | undefined;
  const container = inventory?.container;
  let relics = 0;

  if (container !== undefined) {
    for (let slot = 0; slot < container.size; slot += 1) {
      const stack = container.getItem(slot);
      if (stack?.typeId === "skyknights:relic_shard") {
        relics += stack.amount;
      }
    }
  }

  return relics >= 2;
}

function discoverIsland(
  player: Player,
  definition: IslandDefinition,
  safeDock: { x: number; y: number; z: number },
): void {
  const repository = new PlayerStateRepository(player, {
    dimensionId: definition.dimensionId,
    ...safeDock,
  });
  const state = repository.load();

  if (state.discoveredIslandIds.includes(definition.id)) {
    return;
  }

  state.discoveredIslandIds.push(definition.id);
  state.discoveredIslandIds.sort();

  if (
    definition.id === "frostspire" &&
    state.objective === "reach_frostspire"
  ) {
    state.objective = "return_frost_cargo";
  }

  repository.save(state);
  player.sendMessage(`§b${displayIsland(definition.id)} discovered.§r`);

  if (definition.id === "ember_outpost") {
    player.sendMessage(
      "Defeat the guardian and recover the Aether Crystal from the ruin chest.",
    );
  } else if (definition.id === "frostspire") {
    player.sendMessage(
      "Defeat the Frostspire Warden and recover Froststeel from the tower.",
    );
  } else if (
    definition.id === "glacier_vault" ||
    definition.id === "ashfall_crater"
  ) {
    player.sendMessage(
      "Recover this site's Relic Shard; both shards open the Aether Sanctum route.",
    );
  } else if (definition.id === "aether_sanctum") {
    player.sendMessage(
      "The Sanctum cache contains the Aether Core for Masterwork certification.",
    );
  }
}

function squaredDistance(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return dx * dx + dy * dy + dz * dz;
}

function displayIsland(id: string): string {
  return id
    .split("_")
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
