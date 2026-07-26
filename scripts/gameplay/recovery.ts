import { Entity, Player, world } from "@minecraft/server";

import {
  IDENTIFIERS,
  STARTER_ISLAND,
  VOID_RESCUE_Y,
} from "../config/constants";
import { Logger } from "../diagnostics/logger";
import {
  PlayerStateRepository,
  ShipStateRepository,
} from "../persistence/repositories";
import { DockLocation } from "../persistence/schema";

function teleportToDock(entity: Entity, dock: DockLocation): void {
  const dimension = world.getDimension(dock.dimensionId);
  entity.teleport(
    {
      x: dock.x,
      y: dock.y,
      z: dock.z,
    },
    { dimension },
  );
}

export function recoverPlayer(player: Player, logger: Logger): void {
  const repository = new PlayerStateRepository(player, STARTER_ISLAND.safeDock);
  const state = repository.load();
  teleportToDock(player, state.lastSafeDock);
  player.addEffect("resistance", 60, {
    amplifier: 4,
    showParticles: false,
  });
  logger.warn("Player recovered to the last safe dock.", {
    playerId: player.id,
    dock: state.lastSafeDock,
  });
}

export function runRecoverySweep(logger: Logger): void {
  for (const player of world.getAllPlayers()) {
    const state = new PlayerStateRepository(
      player,
      STARTER_ISLAND.safeDock,
    ).load();

    if (state.recoveryEnabled && player.location.y < VOID_RESCUE_Y) {
      recoverPlayer(player, logger);
    }
  }

  for (const dimensionId of [
    "minecraft:overworld",
    "minecraft:nether",
    "minecraft:the_end",
  ]) {
    const dimension = world.getDimension(dimensionId);

    for (const typeId of [IDENTIFIERS.skiff, IDENTIFIERS.skycutter]) {
      for (const ship of dimension.getEntities({ type: typeId })) {
        if (ship.location.y >= VOID_RESCUE_Y) {
          continue;
        }

        const frame =
          ship.typeId === IDENTIFIERS.skycutter ? "skycutter" : "skiff";
        const repository = new ShipStateRepository(
          ship,
          `${frame}-${ship.id}`,
          STARTER_ISLAND.safeDock,
          frame,
        );
        const state = repository.load();
        teleportToDock(ship, state.homeDock);
        state.docked = true;
        repository.save(state);
        logger.warn("Ship recovered to its home dock.", {
          shipId: state.shipId,
          frame,
          dock: state.homeDock,
        });
      }
    }
  }
}
