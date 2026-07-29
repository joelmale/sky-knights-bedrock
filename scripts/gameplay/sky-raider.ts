import {
  Entity,
  EntityComponentTypes,
  EntityInventoryComponent,
  ItemStack,
  Player,
  system,
  world,
} from "@minecraft/server";

import {
  IDENTIFIERS,
  SKY_RAIDER_ENCOUNTER,
  STARTER_ISLAND,
} from "../config/constants";
import { Logger } from "../diagnostics/logger";
import {
  PlayerStateRepository,
  WorldStateRepository,
} from "../persistence/repositories";
import { DockLocation } from "../persistence/schema";
import { mountedSkycutter, lastCannonAttacker } from "./ship-combat";
import { hasAetherCannon } from "./ship-modules";
import { loadShipState, saveShipState } from "./skiff";

const RAIDER_TAG = "skyknights.encounter.ashwing_raider";

export function registerSkyRaiderEvents(
  repository: WorldStateRepository,
  logger: Logger,
): void {
  world.afterEvents.entityDie.subscribe(
    ({ deadEntity, damageSource }) => {
      const location = entityLocation(deadEntity);
      const attackerName =
        lastCannonAttacker(deadEntity) ??
        (damageSource.damagingEntity instanceof Player
          ? damageSource.damagingEntity.name
          : undefined);

      system.run(() => {
        completeSkyRaiderEncounter(repository, location, attackerName, logger);
      });
    },
    { entityTypes: [IDENTIFIERS.skyRaider] },
  );
}

export function runSkyRaiderSweep(
  repository: WorldStateRepository,
  logger: Logger,
): void {
  const state = repository.load();

  if (state.skyRaiderEncounter.status === "defeated") {
    return;
  }

  if (state.skyRaiderEncounter.status === "active") {
    const raider = validEntity(state.skyRaiderEncounter.entityId);

    if (raider !== undefined) {
      const location = entityLocation(raider);

      if (raider.location.y < 64) {
        raider.teleport(
          {
            x: location.x,
            y: SKY_RAIDER_ENCOUNTER.patrolCenter.y,
            z: location.z,
          },
          {
            dimension: world.getDimension(SKY_RAIDER_ENCOUNTER.dimensionId),
          },
        );
      }

      state.skyRaiderEncounter.lastKnownLocation = entityLocation(raider);
      repository.save(state);
      return;
    }

    const location =
      state.skyRaiderEncounter.lastKnownLocation ?? encounterPatrolLocation();
    const nearbyPlayer = eligiblePlayers().find(
      (player) =>
        player.dimension.id === location.dimensionId &&
        distanceSquared(player.location, location) <=
          SKY_RAIDER_ENCOUNTER.rewardDistance *
            SKY_RAIDER_ENCOUNTER.rewardDistance,
    );

    if (nearbyPlayer !== undefined) {
      const raider = spawnRaider(location);
      state.skyRaiderEncounter.entityId = raider.id;
      state.skyRaiderEncounter.lastKnownLocation = entityLocation(raider);
      repository.save(state);
      nearbyPlayer.sendMessage(
        "§6The Ashwing Raider has returned to the patrol!§r",
      );
      logger.warn("Missing active Ashwing Raider respawned.", {
        entityId: raider.id,
      });
    }

    return;
  }

  const player = eligiblePlayers().find(isReadyToLaunchEncounter);

  if (player !== undefined) {
    spawnSkyRaiderForPlayer(player, repository, logger);
  }
}

export function spawnSkyRaiderForPlayer(
  player: Player,
  repository: WorldStateRepository,
  logger: Logger,
  force = false,
  requestedLocation?: DockLocation,
): Entity | undefined {
  const worldState = repository.load();
  const existing = validEntity(worldState.skyRaiderEncounter.entityId);

  if (existing !== undefined && !force) {
    player.sendMessage("§eThe Ashwing Raider is already active.§r");
    return existing;
  }

  if (existing !== undefined) {
    existing.remove();
  }

  if (!force && !isReadyToLaunchEncounter(player)) {
    return undefined;
  }

  if (force) {
    worldState.skyRaiderEncounter = { status: "dormant" };
  }

  const direction = horizontalDirection(player.getViewDirection());
  const location: DockLocation = requestedLocation ?? {
    dimensionId: player.dimension.id,
    x:
      player.location.x +
      direction.x * SKY_RAIDER_ENCOUNTER.spawnDistanceFromPlayer,
    y: Math.max(player.location.y + 8, 166),
    z:
      player.location.z +
      direction.z * SKY_RAIDER_ENCOUNTER.spawnDistanceFromPlayer,
  };
  const raider = spawnRaider(location);
  worldState.skyRaiderEncounter = {
    status: "active",
    entityId: raider.id,
    lastKnownLocation: entityLocation(raider),
  };
  repository.save(worldState);
  world.sendMessage(
    "§6Ashwing Raider sighted! Use the Cannon Control while aboard the Skycutter.§r",
  );
  logger.info("Ashwing Raider encounter launched.", {
    entityId: raider.id,
    playerId: player.id,
    location,
    forced: force,
  });
  return raider;
}

function completeSkyRaiderEncounter(
  repository: WorldStateRepository,
  location: DockLocation,
  attackerName: string | undefined,
  logger: Logger,
): void {
  const worldState = repository.load();

  if (worldState.skyRaiderEncounter.status === "defeated") {
    return;
  }

  worldState.skyRaiderEncounter = {
    status: "defeated",
    lastKnownLocation: location,
  };
  repository.save(worldState);
  const nearbyPlayers = world
    .getAllPlayers()
    .filter(
      (player) =>
        player.dimension.id === location.dimensionId &&
        distanceSquared(player.location, location) <=
          SKY_RAIDER_ENCOUNTER.rewardDistance *
            SKY_RAIDER_ENCOUNTER.rewardDistance,
    );
  const objectivePlayers = nearbyPlayers.filter((player) => {
    const state = new PlayerStateRepository(
      player,
      STARTER_ISLAND.safeDock,
    ).load();
    return (
      state.objective === "defeat_sky_raider" || player.name === attackerName
    );
  });
  const recipients =
    objectivePlayers.length > 0 ? objectivePlayers : nearbyPlayers;

  if (recipients.length === 0) {
    world
      .getDimension(location.dimensionId)
      .spawnItem(new ItemStack(IDENTIFIERS.raiderCore), location);
  }

  for (const player of recipients) {
    giveReward(player, location);
    const playerRepository = new PlayerStateRepository(
      player,
      STARTER_ISLAND.safeDock,
    );
    const playerState = playerRepository.load();

    if (playerState.objective === "defeat_sky_raider") {
      playerState.objective = "return_raider_core";
      playerRepository.save(playerState);
    }

    const ship = mountedSkycutter(player);
    const shipState = ship === undefined ? undefined : loadShipState(ship);

    if (ship !== undefined && shipState !== undefined) {
      shipState.combat.raidersDefeated += 1;
      saveShipState(ship, shipState);
    }

    player.sendMessage(
      "§aAshwing Raider defeated. Return its Raider Core to Dockmaster Elian.§r",
    );
  }

  logger.info("Ashwing Raider encounter completed.", {
    attackerName,
    recipients: recipients.map((player) => player.name),
  });
}

function giveReward(player: Player, fallback: DockLocation): void {
  const inventory = player.getComponent(EntityComponentTypes.Inventory) as
    EntityInventoryComponent | undefined;
  const stack = new ItemStack(IDENTIFIERS.raiderCore);
  const remainder = inventory?.container?.addItem(stack);

  if (remainder !== undefined || inventory?.container === undefined) {
    player.dimension.spawnItem(
      remainder ?? stack,
      inventory?.container === undefined ? fallback : player.location,
    );
  }
}

function eligiblePlayers(): Player[] {
  return world.getAllPlayers().filter((player) => {
    const state = new PlayerStateRepository(
      player,
      STARTER_ISLAND.safeDock,
    ).load();
    return state.objective === "defeat_sky_raider";
  });
}

function isReadyToLaunchEncounter(player: Player): boolean {
  if (player.dimension.id !== SKY_RAIDER_ENCOUNTER.dimensionId) {
    return false;
  }

  const ship = mountedSkycutter(player);
  const state = ship === undefined ? undefined : loadShipState(ship);

  return (
    state !== undefined &&
    hasAetherCannon(state.configuration.modules) &&
    horizontalDistanceSquared(player.location, STARTER_ISLAND.safeDock) >
      SKY_RAIDER_ENCOUNTER.activationDistanceFromDock *
        SKY_RAIDER_ENCOUNTER.activationDistanceFromDock
  );
}

function spawnRaider(location: DockLocation): Entity {
  const dimension = world.getDimension(location.dimensionId);
  const raider = dimension.spawnEntity(
    IDENTIFIERS.skyRaider,
    {
      x: location.x,
      y: location.y,
      z: location.z,
    },
    { initialPersistence: true },
  );
  raider.nameTag = "Ashwing Raider";
  raider.addTag(RAIDER_TAG);
  return raider;
}

function validEntity(entityId: string | undefined): Entity | undefined {
  if (entityId === undefined) {
    return undefined;
  }

  try {
    const entity = world.getEntity(entityId);
    return entity?.isValid ? entity : undefined;
  } catch {
    return undefined;
  }
}

function entityLocation(entity: Entity): DockLocation {
  return {
    dimensionId: entity.dimension.id,
    x: entity.location.x,
    y: entity.location.y,
    z: entity.location.z,
  };
}

function encounterPatrolLocation(): DockLocation {
  return {
    dimensionId: SKY_RAIDER_ENCOUNTER.dimensionId,
    ...SKY_RAIDER_ENCOUNTER.patrolCenter,
  };
}

function horizontalDirection(direction: { x: number; z: number }): {
  x: number;
  z: number;
} {
  const length = Math.hypot(direction.x, direction.z);
  return length < 0.001
    ? { x: 1, z: 0 }
    : { x: direction.x / length, z: direction.z / length };
}

function horizontalDistanceSquared(
  first: { x: number; z: number },
  second: { x: number; z: number },
): number {
  const dx = first.x - second.x;
  const dz = first.z - second.z;
  return dx * dx + dz * dz;
}

function distanceSquared(
  first: { x: number; y: number; z: number },
  second: { x: number; y: number; z: number },
): number {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  const dz = first.z - second.z;
  return dx * dx + dy * dy + dz * dz;
}
