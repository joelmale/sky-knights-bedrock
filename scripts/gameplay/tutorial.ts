import {
  EntityComponentTypes,
  EntityInventoryComponent,
  Player,
  world,
} from "@minecraft/server";

import { IDENTIFIERS, STARTER_ISLAND } from "../config/constants";
import { PlayerStateRepository } from "../persistence/repositories";
import { TutorialObjective } from "../persistence/schema";

export function runTutorialSweep(): void {
  for (const player of world.getAllPlayers()) {
    updateInventoryObjective(player);
  }
}

export function objectiveText(objective: TutorialObjective): string {
  const text: Record<TutorialObjective, string> = {
    gather_ship_parts:
      "Gather materials and craft a Ship Core, two Canvas Bundles, and a Thruster Module.",
    assemble_skiff:
      "Bring the starter components to Dockmaster Elian and assemble a skiff.",
    recover_aether_crystal:
      "Fly east to the Ember Outpost and recover its Aether Crystal.",
    return_crystal: "Return the Aether Crystal to Dockmaster Elian.",
    assemble_skycutter:
      "Craft the Hull, Cargo, and Navigator modules, then assemble the Skycutter.",
    reach_frostspire:
      "Use the Aether Engine to fly east beyond the old range limit to Frostspire.",
    return_frost_cargo:
      "Load Froststeel into the Skycutter cargo hold and return it to the Dockmaster.",
    complete:
      "Crystal-to-Cutter expedition complete. Continue exploring and improving the fleet.",
  };
  return text[objective];
}

function updateInventoryObjective(player: Player): void {
  const repository = new PlayerStateRepository(player, STARTER_ISLAND.safeDock);
  const state = repository.load();
  const inventory = player.getComponent(EntityComponentTypes.Inventory) as
    EntityInventoryComponent | undefined;

  if (inventory?.container === undefined) {
    return;
  }

  if (
    state.objective === "recover_aether_crystal" &&
    containsItem(inventory.container, IDENTIFIERS.aetherCrystal)
  ) {
    state.objective = "return_crystal";
    repository.save(state);
    player.sendMessage(
      "§aAether Crystal recovered. Return it to Dockmaster Elian.§r",
    );
  }

  if (
    state.objective === "gather_ship_parts" &&
    containsItem(inventory.container, IDENTIFIERS.shipCore) &&
    countItem(inventory.container, IDENTIFIERS.canvasBundle) >= 2 &&
    containsItem(inventory.container, IDENTIFIERS.thrusterModule)
  ) {
    state.objective = "assemble_skiff";
    repository.save(state);
    player.sendMessage(
      "§aStarter ship components complete. Bring them to Dockmaster Elian.§r",
    );
  }
}

function containsItem(
  container: EntityInventoryComponent["container"],
  itemId: string,
): boolean {
  return countItem(container, itemId) > 0;
}

function countItem(
  container: EntityInventoryComponent["container"],
  itemId: string,
): number {
  let count = 0;

  for (let slot = 0; slot < container.size; slot += 1) {
    const stack = container.getItem(slot);

    if (stack?.typeId === itemId) {
      count += stack.amount;
    }
  }

  return count;
}
