import {
  EntityComponentTypes,
  EntityInventoryComponent,
  Player,
  system,
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
      "Gather wood and iron on this island, then use a crafting table to make 1 Ship Core, 2 Canvas Bundles, and 1 Thruster Module.",
    assemble_skiff:
      "Carry the parts to Dockmaster Elian on the east dock and choose Assemble Starter Skiff.",
    recover_aether_crystal:
      "Board your skiff and fly EAST to Ember Outpost. Take the Aether Crystal from its ruin chest.",
    return_crystal:
      "Fly home and give the Aether Crystal to Dockmaster Elian on the east dock.",
    assemble_skycutter:
      "Craft a Reinforced Hull, Cargo Hold, and Navigator Module, then ask Elian to assemble the Skycutter.",
    reach_frostspire:
      "The Skycutter flies farther than the skiff. Fly EAST past Ember Outpost to reach Frostspire.",
    return_frost_cargo:
      "Load Froststeel into the Skycutter's cargo hold and bring it home to Dockmaster Elian.",
    craft_combat_refit:
      "Use Froststeel to craft an Aether Cannon, plus any advanced hull, engine, or cargo modules you want.",
    install_combat_refit:
      "Park the Skycutter at the home dock and ask Elian to install the Aether Cannon in its Utility slot.",
    defeat_sky_raider:
      "Load Aether Charges, launch the Skycutter, and shoot down the Ashwing Raider with the Cannon Control.",
    return_raider_core:
      "Bring the Raider Core back to Dockmaster Elian to claim the Shield Projector.",
    combat_complete:
      "All current objectives are complete. Keep refitting the Skycutter and exploring.",
  };
  return text[objective];
}

/** A short label for the title card shown when an objective changes. */
export function objectiveHeadline(objective: TutorialObjective): string {
  const headline: Record<TutorialObjective, string> = {
    gather_ship_parts: "Gather ship parts",
    assemble_skiff: "Visit the Dockmaster",
    recover_aether_crystal: "Fly to Ember Outpost",
    return_crystal: "Return the Aether Crystal",
    assemble_skycutter: "Build the Skycutter",
    reach_frostspire: "Reach Frostspire",
    return_frost_cargo: "Deliver the Froststeel",
    craft_combat_refit: "Craft the Aether Cannon",
    install_combat_refit: "Refit at the dock",
    defeat_sky_raider: "Defeat the Ashwing Raider",
    return_raider_core: "Return the Raider Core",
    combat_complete: "Expedition complete",
  };
  return headline[objective];
}

/**
 * Announce the current objective.
 *
 * Chat alone was the previous behaviour and it scrolls away permanently, so an
 * objective change now also shows a title card and an action-bar line. Call
 * with `changed = false` for an on-demand recall, which skips the title card.
 */
export function announceObjective(
  player: Player,
  objective: TutorialObjective,
  changed = true,
): void {
  if (changed) {
    player.onScreenDisplay.setTitle("§6New Objective§r", {
      subtitle: objectiveHeadline(objective),
      fadeInDuration: 5,
      stayDuration: 40,
      fadeOutDuration: 10,
    });
  }

  player.onScreenDisplay.setActionBar(`§e${objectiveHeadline(objective)}§r`);
  player.sendMessage(`§6Objective:§r ${objectiveText(objective)}`);
}

/**
 * First-run introduction.
 *
 * The previous onboarding was two chat lines that named an internal slice
 * ("Crystal-to-Cutter expedition") and never explained the void, the dock, the
 * Dockmaster, or how to recall the objective. This paces a short orientation
 * over a few seconds so a fresh player knows where they are and what to do.
 */
export function playIntroduction(
  player: Player,
  objective: TutorialObjective,
): void {
  player.onScreenDisplay.setTitle("§bSky Knights§r", {
    subtitle: "§7Verdant Isle§r",
    fadeInDuration: 10,
    stayDuration: 50,
    fadeOutDuration: 20,
  });

  const beats: { delay: number; message: string }[] = [
    {
      delay: 40,
      message:
        "§bSky Knights§r You are stranded on a floating island, high above the void.",
    },
    {
      delay: 100,
      message:
        "§7Falling is not the end.§r If you drop into the void you are carried back to the dock, so explore without fear of losing everything.",
    },
    {
      delay: 170,
      message:
        "§6Dockmaster Elian§r waits on the dock to the §least§r. Interact with him at any time to hear your current objective or build a ship.",
    },
    {
      delay: 240,
      message:
        "Your goal: gather materials, build an airship, and reach the other islands scattered across the sky.",
    },
  ];

  for (const beat of beats) {
    system.runTimeout(() => {
      if (player.isValid) {
        player.sendMessage(beat.message);
      }
    }, beat.delay);
  }

  system.runTimeout(() => {
    if (player.isValid) {
      announceObjective(player, objective);
      player.sendMessage(
        "§8Tip: run §7/skyknights:objective§8 at any time to see this again.§r",
      );
    }
  }, 300);
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
    player.sendMessage("§aAether Crystal recovered.§r");
    announceObjective(player, state.objective);
  }

  if (
    state.objective === "gather_ship_parts" &&
    containsItem(inventory.container, IDENTIFIERS.shipCore) &&
    countItem(inventory.container, IDENTIFIERS.canvasBundle) >= 2 &&
    containsItem(inventory.container, IDENTIFIERS.thrusterModule)
  ) {
    state.objective = "assemble_skiff";
    repository.save(state);
    player.sendMessage("§aStarter ship components complete.§r");
    announceObjective(player, state.objective);
  }

  if (
    state.objective === "craft_combat_refit" &&
    containsItem(inventory.container, IDENTIFIERS.aetherCannon)
  ) {
    state.objective = "install_combat_refit";
    repository.save(state);
    player.sendMessage("§aAether Cannon crafted.§r");
    announceObjective(player, state.objective);
  }

  if (
    state.objective === "defeat_sky_raider" &&
    containsItem(inventory.container, IDENTIFIERS.raiderCore)
  ) {
    state.objective = "return_raider_core";
    repository.save(state);
    player.sendMessage("§aRaider Core secured.§r");
    announceObjective(player, state.objective);
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
