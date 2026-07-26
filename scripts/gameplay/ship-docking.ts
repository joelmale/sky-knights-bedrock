import {
  Entity,
  EntityComponentTypes,
  EntityRideableComponent,
  EntityTameableComponent,
  Player,
  system,
  world,
} from "@minecraft/server";

import { DOCKYARD, IDENTIFIERS, STARTER_ISLAND } from "../config/constants";
import { Logger } from "../diagnostics/logger";
import { PlayerStateRepository } from "../persistence/repositories";
import { ShipFrame } from "../persistence/schema";
import {
  entityDockLocation,
  isShipOwner,
  loadShipState,
  saveShipState,
} from "./skiff";
import { horizontalDistanceSquared } from "./ship-rules";

export async function resolveOwnedShip(
  player: Player,
  loadLastKnownLocation: boolean,
  logger: Logger,
): Promise<Entity | undefined> {
  const repository = new PlayerStateRepository(player, STARTER_ISLAND.safeDock);
  const state = repository.load();
  const reference = state.ownedShip;

  if (reference?.entityId === undefined) {
    return adoptNearbyOwnedShip(player);
  }

  const loaded = getEntity(reference.entityId);

  if (loaded !== undefined) {
    return loaded;
  }

  if (!loadLastKnownLocation) {
    return undefined;
  }

  const manager = world.tickingAreaManager;
  const identifier = `skyknights_recall_${safeIdentifier(player.name)}`;
  const dimension = world.getDimension(reference.lastKnownLocation.dimensionId);
  const options = {
    dimension,
    from: {
      x: Math.floor(reference.lastKnownLocation.x) - 16,
      y: Math.floor(reference.lastKnownLocation.y) - 8,
      z: Math.floor(reference.lastKnownLocation.z) - 16,
    },
    to: {
      x: Math.floor(reference.lastKnownLocation.x) + 16,
      y: Math.floor(reference.lastKnownLocation.y) + 8,
      z: Math.floor(reference.lastKnownLocation.z) + 16,
    },
  };

  if (manager.hasTickingArea(identifier)) {
    manager.removeTickingArea(identifier);
  }

  if (!manager.hasCapacity(options)) {
    player.sendMessage(
      "§cThe ship's last location cannot be loaded while another generation job is using the available chunk capacity.§r",
    );
    return undefined;
  }

  try {
    await manager.createTickingArea(identifier, options);
    await system.waitTicks(1);
    const recovered = getEntity(reference.entityId);

    if (recovered !== undefined) {
      return recovered;
    }

    state.ownedShip = { ...reference, entityId: undefined };
    repository.save(state);
    logger.warn("Owned ship was absent at its last saved location.", {
      playerId: player.id,
      shipId: reference.shipId,
      location: reference.lastKnownLocation,
    });
    return undefined;
  } finally {
    if (manager.hasTickingArea(identifier)) {
      manager.removeTickingArea(identifier);
    }
  }
}

export function adoptNearbyOwnedShip(player: Player): Entity | undefined {
  const dimension = world.getDimension(STARTER_ISLAND.dimensionId);
  const repository = new PlayerStateRepository(player, STARTER_ISLAND.safeDock);
  const playerState = repository.load();

  for (const typeId of [IDENTIFIERS.skycutter, IDENTIFIERS.skiff]) {
    const candidates = dimension.getEntities({
      type: typeId,
      location: DOCKYARD.skycutterLaunch,
      maxDistance: DOCKYARD.serviceRadius * 2,
    });

    for (const candidate of candidates) {
      const shipState = loadShipState(candidate);

      if (shipState === undefined) {
        continue;
      }

      const canClaimLegacyShip =
        shipState.ownerName === undefined &&
        (playerState.ownedShip === undefined ||
          playerState.ownedShip.shipId === shipState.shipId);

      if (!isShipOwner(player, shipState) && !canClaimLegacyShip) {
        continue;
      }

      if (canClaimLegacyShip) {
        const tameable = candidate.getComponent(
          EntityComponentTypes.Tameable,
        ) as EntityTameableComponent | undefined;
        tameable?.tame(player);
        shipState.ownerPlayerId = player.id;
        shipState.ownerName = player.name;
        saveShipState(candidate, shipState);
        player.sendMessage(
          "§aThe Dockmaster restored ownership of your legacy ship record.§r",
        );
      }

      playerState.ownedShip = {
        entityId: candidate.id,
        shipId: shipState.shipId,
        frame: shipState.configuration.frame,
        lastKnownLocation: entityDockLocation(candidate),
        modules: { ...shipState.configuration.modules },
      };
      repository.save(playerState);
      return candidate;
    }
  }

  return undefined;
}

export async function dockOwnedShip(
  player: Player,
  logger: Logger,
): Promise<Entity | undefined> {
  const ship = await resolveOwnedShip(player, true, logger);

  if (ship === undefined) {
    return undefined;
  }

  const state = loadShipState(ship);

  if (state === undefined || !isShipOwner(player, state)) {
    return undefined;
  }

  const launch = launchForFrame(state.configuration.frame);
  const rideable = ship.getComponent(EntityComponentTypes.Rideable) as
    EntityRideableComponent | undefined;
  rideable?.ejectRiders();
  ship.teleport(launch, {
    dimension: world.getDimension(STARTER_ISLAND.dimensionId),
  });
  state.homeDock = {
    dimensionId: STARTER_ISLAND.dimensionId,
    ...launch,
  };
  state.docked = true;
  saveShipState(ship, state);

  const repository = new PlayerStateRepository(player, STARTER_ISLAND.safeDock);
  const playerState = repository.load();
  playerState.ownedShip = {
    entityId: ship.id,
    shipId: state.shipId,
    frame: state.configuration.frame,
    lastKnownLocation: entityDockLocation(ship),
    modules: { ...state.configuration.modules },
  };
  repository.save(playerState);
  logger.info("Owned ship docked.", {
    playerId: player.id,
    shipId: state.shipId,
  });
  return ship;
}

export function isAtDock(ship: Entity): boolean {
  return (
    ship.dimension.id === STARTER_ISLAND.dimensionId &&
    horizontalDistanceSquared(ship.location, DOCKYARD.skycutterLaunch) <=
      DOCKYARD.serviceRadius * DOCKYARD.serviceRadius &&
    Math.abs(ship.location.y - DOCKYARD.skycutterLaunch.y) <= 8
  );
}

function launchForFrame(frame: ShipFrame): {
  x: number;
  y: number;
  z: number;
} {
  return frame === "skycutter"
    ? DOCKYARD.skycutterLaunch
    : DOCKYARD.skiffLaunch;
}

function getEntity(entityId: string): Entity | undefined {
  try {
    const entity = world.getEntity(entityId);
    return entity?.isValid ? entity : undefined;
  } catch {
    return undefined;
  }
}

function safeIdentifier(value: string): string {
  return value.replace(/[^a-zA-Z0-9_]/gu, "_").slice(0, 40);
}
