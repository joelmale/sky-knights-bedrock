import { EntityComponentTypes, Player, system, world } from "@minecraft/server";

import { IDENTIFIERS } from "../config/constants";
import { Logger } from "../diagnostics/logger";

const CAMERA_SWEEP_INTERVAL_TICKS = 5;
const THIRD_PERSON_CAMERA_PRESET = "minecraft:third_person";
const PROTOTYPE_CRAFT_TYPES: ReadonlySet<string> = new Set([
  IDENTIFIERS.aetherOutrigger,
  IDENTIFIERS.steampunkBlimp,
]);

type RidingQuery =
  { status: "known"; prototypeCraft: boolean } | { status: "unavailable" };

export interface PrototypeCameraAssistState {
  phase: "enabling" | "active" | "clearing";
  enableErrorLogged: boolean;
  clearErrorLogged: boolean;
}

/**
 * Activates a mount-scoped third-person assist when a player boards either
 * large prototype craft. The active preset locks that perspective until it is
 * cleared on dismount, but the sweep does not redundantly reapply it.
 */
export function initializePrototypeCraftCameraAssist(logger: Logger): void {
  const playerStates = new Map<string, PrototypeCameraAssistState>();

  world.afterEvents.playerLeave.subscribe(({ playerId }) => {
    playerStates.delete(playerId);
  });

  system.runInterval(() => {
    runPrototypeCraftCameraAssistSweep(playerStates, logger);
  }, CAMERA_SWEEP_INTERVAL_TICKS);
}

export function runPrototypeCraftCameraAssistSweep(
  playerStates: Map<string, PrototypeCameraAssistState>,
  logger: Logger,
): void {
  let players: Player[];

  try {
    players = world.getAllPlayers();
  } catch (error) {
    logger.warn("Could not query players for prototype craft camera assist.", {
      error: errorMessage(error),
    });
    return;
  }

  const onlinePlayerIds = new Set<string>();

  for (const player of players) {
    onlinePlayerIds.add(player.id);
    const query = queryPrototypeCraftRide(player, logger);

    if (query.status === "unavailable") {
      continue;
    }

    const state = playerStates.get(player.id);

    if (query.prototypeCraft) {
      if (state?.phase === "active") {
        continue;
      }

      const enablingState = state ?? {
        phase: "enabling",
        enableErrorLogged: false,
        clearErrorLogged: false,
      };
      enablingState.phase = "enabling";
      enablingState.clearErrorLogged = false;
      playerStates.set(player.id, enablingState);

      try {
        player.camera.setCamera(THIRD_PERSON_CAMERA_PRESET);
        enablingState.phase = "active";
        enablingState.enableErrorLogged = false;
      } catch (error) {
        if (!enablingState.enableErrorLogged) {
          enablingState.enableErrorLogged = true;
          logger.warn("Could not enable prototype craft camera assist.", {
            playerId: player.id,
            error: errorMessage(error),
          });
        }
      }
      continue;
    }

    if (state === undefined) {
      continue;
    }

    state.phase = "clearing";
    state.enableErrorLogged = false;

    try {
      player.camera.clear();
      playerStates.delete(player.id);
    } catch (error) {
      if (!state.clearErrorLogged) {
        state.clearErrorLogged = true;
        logger.warn("Could not clear prototype craft camera assist.", {
          playerId: player.id,
          error: errorMessage(error),
        });
      }
    }
  }

  for (const playerId of playerStates.keys()) {
    if (!onlinePlayerIds.has(playerId)) {
      playerStates.delete(playerId);
    }
  }
}

function queryPrototypeCraftRide(player: Player, logger: Logger): RidingQuery {
  try {
    const riding = player.getComponent(EntityComponentTypes.Riding);
    return {
      status: "known",
      prototypeCraft:
        riding !== undefined &&
        PROTOTYPE_CRAFT_TYPES.has(riding.entityRidingOn.typeId),
    };
  } catch (error) {
    logger.warn("Could not query a player's mounted entity.", {
      playerId: player.id,
      error: errorMessage(error),
    });
    return { status: "unavailable" };
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
