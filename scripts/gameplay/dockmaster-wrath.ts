import { world } from "@minecraft/server";
import type { Entity } from "@minecraft/server";

import { DOCKYARD } from "../config/constants";
import { Logger } from "../diagnostics/logger";
import { PlayerStateRepository } from "../persistence/repositories";
import { STARTER_ISLAND } from "../config/constants";
import type { DockmasterMood } from "./dockyard-materials";

/**
 * Dockmaster mood lives in its own world dynamic property rather than in the
 * world state document, so this slice adds no schema version and cannot
 * conflict with the archipelago planner's persistence work.
 */
const MOOD_KEY = "skyknights:dockmaster_mood";
const WRATH_TAG = "skyknights.dockmaster_wrathful";
const WRATH_NAME = "Elian, Forsaken";
const STEWARD_NAME = "Dockmaster Elian";

/** How far the steward rises before it turns. Purely presentational. */
const ASCENT_BLOCKS = 4;

export function dockmasterMood(): DockmasterMood {
  return world.getDynamicProperty(MOOD_KEY) === "wrathful"
    ? "wrathful"
    : "steward";
}

export function setDockmasterMood(mood: DockmasterMood): void {
  world.setDynamicProperty(MOOD_KEY, mood);
}

/**
 * True once any player has taken delivery of a ship.
 *
 * Computed live from player state instead of a persisted flag: the gate only
 * has to be right while a player is online, and a derived answer cannot drift
 * out of sync with the saves it describes.
 */
export function firstShipBuilt(): boolean {
  for (const player of world.getAllPlayers()) {
    try {
      const state = new PlayerStateRepository(
        player,
        STARTER_ISLAND.safeDock,
      ).load();

      if (state.ownedShip !== undefined) {
        return true;
      }
    } catch {
      // A player whose state cannot be read yet simply does not open the gate.
    }
  }

  return false;
}

/** Re-applies the steward component group to a Dockmaster that predates it. */
export function restoreSteward(entity: Entity): void {
  entity.nameTag = STEWARD_NAME;
  entity.removeTag(WRATH_TAG);
  entity.triggerEvent("skyknights:become_steward");
}

/**
 * Turns the steward. Idempotent: a Dockmaster already carrying the wrath tag
 * is left alone so a repeated sweep cannot re-announce or re-teleport it.
 */
export function provokeDockmaster(entity: Entity, logger: Logger): boolean {
  if (entity.hasTag(WRATH_TAG)) {
    return false;
  }

  entity.teleport({
    x: DOCKYARD.dockmaster.x,
    y: DOCKYARD.dockmaster.y + ASCENT_BLOCKS,
    z: DOCKYARD.dockmaster.z,
  });
  entity.nameTag = WRATH_NAME;
  entity.addTag(WRATH_TAG);
  entity.triggerEvent("skyknights:become_wrathful");
  setDockmasterMood("wrathful");
  world.sendMessage(
    "§4The dock falls away. Elian rises from the wreckage, and he is no longer a shipwright.§r",
  );
  logger.warn("Dockmaster provoked: the dock deck was destroyed.", {
    entityId: entity.id,
  });
  return true;
}
