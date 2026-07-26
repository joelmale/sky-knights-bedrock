import {
  Entity,
  EntityComponentTypes,
  EntityHealthComponent,
  EntityRideableComponent,
  Player,
  system,
  world,
} from "@minecraft/server";

import {
  BASIC_SHIP_RANGE,
  BASIC_SHIP_WARNING_RANGE,
  COMBAT,
  DOCKYARD,
  IDENTIFIERS,
  STARTER_ISLAND,
} from "../config/constants";
import { Logger } from "../diagnostics/logger";
import { PlayerStateRepository } from "../persistence/repositories";
import {
  isShipOwner,
  loadShipState,
  saveShipState,
  updateOwnedShipTracking,
} from "./skiff";
import { hasExtendedRange, horizontalDistanceSquared } from "./ship-rules";

const RANGE_WARNING_TAG = "skyknights.range_warning";

export function registerShipEvents(logger: Logger): void {
  world.beforeEvents.entityHurt.subscribe((event) => {
    if (!isShip(event.hurtEntity)) {
      return;
    }

    let multiplier = 1;

    if (event.hurtEntity.hasTag("skyknights.module.hull.armored")) {
      multiplier *= COMBAT.armoredHullDamageMultiplier;
    }

    if (event.hurtEntity.hasTag("skyknights.module.utility.shield")) {
      multiplier *= COMBAT.shieldDamageMultiplier;
    }

    if (multiplier < 1) {
      event.damage *= multiplier;
      const ship = event.hurtEntity;

      system.run(() => {
        if (ship.isValid) {
          ship.dimension.spawnParticle(
            "minecraft:critical_hit_emitter",
            ship.location,
          );
        }
      });
    }
  });

  world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
    if (!isShip(target)) {
      return;
    }

    system.run(() => enforcePilotOwnership(player, target));
  });

  world.afterEvents.entityHurt.subscribe(({ hurtEntity, damage }) => {
    if (!isShip(hurtEntity)) {
      return;
    }

    system.run(() => reportShipDamage(hurtEntity, damage));
  });

  world.afterEvents.entityDie.subscribe(({ deadEntity }) => {
    if (!isShip(deadEntity)) {
      return;
    }

    system.run(() => recordDestroyedShip(deadEntity, logger));
  });
}

export function runShipSystemsSweep(logger: Logger): void {
  for (const dimensionId of [
    "minecraft:overworld",
    "minecraft:nether",
    "minecraft:the_end",
  ]) {
    const dimension = world.getDimension(dimensionId);

    for (const typeId of [IDENTIFIERS.skiff, IDENTIFIERS.skycutter]) {
      for (const ship of dimension.getEntities({ type: typeId })) {
        enforceShipRange(ship, logger);
        updateDockedState(ship);
      }
    }
  }

  updateOwnedShipTracking();
}

function enforcePilotOwnership(player: Player, ship: Entity): void {
  const state = loadShipState(ship);
  const rideable = ship.getComponent(EntityComponentTypes.Rideable) as
    EntityRideableComponent | undefined;

  if (
    state === undefined ||
    rideable === undefined ||
    isShipOwner(player, state)
  ) {
    return;
  }

  const riders = rideable.getRiders();
  const ownerAboard = riders.some(
    (rider) => rider instanceof Player && isShipOwner(rider, state),
  );

  if (!ownerAboard && riders.some((rider) => rider.id === player.id)) {
    rideable.ejectRider(player);
    player.sendMessage(
      "§cOnly the ship owner can occupy the pilot seat. Board after the owner to use a passenger seat.§r",
    );
  }
}

function reportShipDamage(ship: Entity, damage: number): void {
  if (!ship.isValid) {
    return;
  }

  const health = ship.getComponent(EntityComponentTypes.Health) as
    EntityHealthComponent | undefined;
  const state = loadShipState(ship);

  if (health === undefined || state === undefined) {
    return;
  }

  const message =
    `§c${ship.nameTag || "Ship"} took ${Math.ceil(damage)} damage. ` +
    `${Math.ceil(health.currentValue)}/${Math.ceil(health.effectiveMax)} hull.§r`;
  const rideable = ship.getComponent(EntityComponentTypes.Rideable) as
    EntityRideableComponent | undefined;

  for (const rider of rideable?.getRiders() ?? []) {
    if (rider instanceof Player) {
      rider.onScreenDisplay.setActionBar(message);
    }
  }

  const owner = world
    .getAllPlayers()
    .find((player) => isShipOwner(player, state));

  if (owner !== undefined && !(rideable?.getRiders() ?? []).includes(owner)) {
    owner.sendMessage(message);
  }
}

function recordDestroyedShip(ship: Entity, logger: Logger): void {
  let state;

  try {
    state = loadShipState(ship);
  } catch {
    return;
  }

  if (state === undefined) {
    return;
  }

  const owner = world
    .getAllPlayers()
    .find((player) => isShipOwner(player, state));

  if (owner !== undefined) {
    const repository = new PlayerStateRepository(
      owner,
      STARTER_ISLAND.safeDock,
    );
    const playerState = repository.load();

    if (playerState.ownedShip?.shipId === state.shipId) {
      playerState.ownedShip = {
        ...playerState.ownedShip,
        entityId: undefined,
      };
      repository.save(playerState);
    }

    owner.sendMessage(
      "§cYour ship was destroyed. Dockmaster Elian can reconstruct it with one Repair Kit.§r",
    );
  }

  logger.warn("Owned ship destroyed.", {
    shipId: state.shipId,
    frame: state.configuration.frame,
    ownerName: state.ownerName,
  });
}

function enforceShipRange(ship: Entity, logger: Logger): void {
  const state = loadShipState(ship);

  if (
    state === undefined ||
    hasExtendedRange(state.configuration.modules) ||
    ship.dimension.id !== state.homeDock.dimensionId
  ) {
    ship.removeTag(RANGE_WARNING_TAG);
    return;
  }

  const distanceSquared = horizontalDistanceSquared(
    ship.location,
    state.homeDock,
  );

  if (distanceSquared > BASIC_SHIP_RANGE * BASIC_SHIP_RANGE) {
    const rideable = ship.getComponent(EntityComponentTypes.Rideable) as
      EntityRideableComponent | undefined;
    const riders = rideable?.getRiders() ?? [];
    ship.teleport(
      {
        x: state.homeDock.x,
        y: state.homeDock.y,
        z: state.homeDock.z,
      },
      { dimension: world.getDimension(state.homeDock.dimensionId) },
    );
    state.docked = true;
    saveShipState(ship, state);

    for (const rider of riders) {
      if (rider instanceof Player) {
        rider.sendMessage(
          "§eThe distant aether current repelled this craft. Install an Aether Engine to travel farther.§r",
        );
      }
    }

    logger.warn("Underpowered ship recovered at its range boundary.", {
      shipId: state.shipId,
      range: BASIC_SHIP_RANGE,
    });
    return;
  }

  if (
    distanceSquared > BASIC_SHIP_WARNING_RANGE * BASIC_SHIP_WARNING_RANGE &&
    !ship.hasTag(RANGE_WARNING_TAG)
  ) {
    ship.addTag(RANGE_WARNING_TAG);
    const rideable = ship.getComponent(EntityComponentTypes.Rideable) as
      EntityRideableComponent | undefined;

    for (const rider of rideable?.getRiders() ?? []) {
      if (rider instanceof Player) {
        rider.sendMessage(
          "§eThis craft is nearing its safe aether range. Turn back or install an Aether Engine.§r",
        );
      }
    }
  } else if (
    distanceSquared <=
    BASIC_SHIP_WARNING_RANGE * BASIC_SHIP_WARNING_RANGE
  ) {
    ship.removeTag(RANGE_WARNING_TAG);
  }
}

function updateDockedState(ship: Entity): void {
  const state = loadShipState(ship);

  if (state === undefined) {
    return;
  }

  const docked =
    ship.dimension.id === STARTER_ISLAND.dimensionId &&
    horizontalDistanceSquared(ship.location, DOCKYARD.skycutterLaunch) <=
      DOCKYARD.serviceRadius * DOCKYARD.serviceRadius &&
    Math.abs(ship.location.y - DOCKYARD.skycutterLaunch.y) <= 8;

  if (state.docked !== docked) {
    state.docked = docked;
    saveShipState(ship, state);
  }
}

function isShip(entity: Entity): boolean {
  return (
    entity.typeId === IDENTIFIERS.skiff ||
    entity.typeId === IDENTIFIERS.skycutter
  );
}
