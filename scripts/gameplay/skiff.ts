import {
  Entity,
  EntityComponentTypes,
  EntityTameableComponent,
  Player,
  system,
  Vector3,
  world,
} from "@minecraft/server";

import {
  IDENTIFIERS,
  SKYCUTTER_LOADOUT,
  STARTER_ISLAND,
} from "../config/constants";
import { Logger } from "../diagnostics/logger";
import {
  PlayerStateRepository,
  ShipStateRepository,
} from "../persistence/repositories";
import {
  DockLocation,
  ShipFrame,
  ShipModuleSlot,
  ShipModuleSlots,
  ShipState,
} from "../persistence/schema";
import {
  installedModuleTag,
  moduleApplyEvent,
  moduleTagsForSlot,
} from "./ship-modules";
import { getSkiffSpawnLocation } from "./skiff-placement";

const DEFAULT_SKIFF_MODULES: ShipModuleSlots = {
  hull: "canvas_hull",
  engine: "starter_thruster",
};

export const NON_PRIMARY_SHIP_TAG = "skyknights.ship.non_primary";

export function isPrimaryShipEntity(entity: Entity): boolean {
  return !entity.hasTag(NON_PRIMARY_SHIP_TAG);
}

export interface ShipSpawnOptions {
  /**
   * Whether this craft becomes the player's canonical recall/tutorial ship.
   * Developer inspection fleets retain entity ownership but opt out.
   */
  trackAsPrimary?: boolean;
}

export function spawnSkiffForPlayer(
  player: Player,
  logger: Logger,
  requestedLocation?: Vector3,
  modules: ShipModuleSlots = DEFAULT_SKIFF_MODULES,
  options: ShipSpawnOptions = {},
): Entity {
  const location =
    requestedLocation ??
    getSkiffSpawnLocation(player.location, player.getViewDirection());
  return spawnOwnedShip(
    player,
    "skiff",
    IDENTIFIERS.skiff,
    location,
    modules,
    logger,
    options,
  );
}

export function spawnSkycutterForPlayer(
  player: Player,
  logger: Logger,
  requestedLocation: Vector3,
  modules: ShipModuleSlots = SKYCUTTER_LOADOUT,
  options: ShipSpawnOptions = {},
): Entity {
  return spawnOwnedShip(
    player,
    "skycutter",
    IDENTIFIERS.skycutter,
    requestedLocation,
    modules,
    logger,
    options,
  );
}

export function initializeSpawnedShip(entity: Entity): void {
  const frame = shipFrameForEntity(entity);

  if (frame === undefined) {
    return;
  }

  const repository = new ShipStateRepository(
    entity,
    `${frame}-${entity.id}`,
    STARTER_ISLAND.safeDock,
    frame,
  );
  const state = repository.load();
  entity.addTag("skyknights.ship");
  entity.addTag(`skyknights.ship.${frame}`);

  if (frame === "skycutter") {
    applyShipConfiguration(entity, state.configuration.modules);
  }
}

export function loadShipState(entity: Entity): ShipState | undefined {
  const frame = shipFrameForEntity(entity);

  if (frame === undefined) {
    return undefined;
  }

  return new ShipStateRepository(
    entity,
    `${frame}-${entity.id}`,
    STARTER_ISLAND.safeDock,
    frame,
  ).load();
}

export function saveShipState(entity: Entity, state: ShipState): void {
  new ShipStateRepository(
    entity,
    state.shipId,
    state.homeDock,
    state.configuration.frame,
  ).save(state);
}

export function isShipOwner(player: Player, state: ShipState): boolean {
  return (
    state.ownerPlayerId === player.id ||
    (state.ownerName !== undefined && state.ownerName === player.name)
  );
}

export function applyShipConfiguration(
  entity: Entity,
  modules: ShipModuleSlots,
): void {
  for (const slot of ["hull", "engine", "cargo", "utility"] as const) {
    applyShipModule(entity, slot, modules[slot]);
  }
}

export function updateOwnedShipTracking(): void {
  const players = world.getAllPlayers();

  for (const dimensionId of [
    "minecraft:overworld",
    "minecraft:nether",
    "minecraft:the_end",
  ]) {
    const dimension = world.getDimension(dimensionId);

    for (const typeId of [IDENTIFIERS.skiff, IDENTIFIERS.skycutter]) {
      for (const entity of dimension.getEntities({ type: typeId })) {
        if (!isPrimaryShipEntity(entity)) {
          continue;
        }

        const shipState = loadShipState(entity);

        if (shipState === undefined) {
          continue;
        }

        const owner = players.find(
          (player) =>
            player.id === shipState.ownerPlayerId ||
            player.name === shipState.ownerName,
        );

        if (owner === undefined) {
          continue;
        }

        if (
          shipState.ownerPlayerId !== owner.id ||
          shipState.ownerName !== owner.name
        ) {
          shipState.ownerPlayerId = owner.id;
          shipState.ownerName = owner.name;
          saveShipState(entity, shipState);
        }

        const repository = new PlayerStateRepository(
          owner,
          STARTER_ISLAND.safeDock,
        );
        const playerState = repository.load();
        const nextReference = {
          entityId: entity.id,
          shipId: shipState.shipId,
          frame: shipState.configuration.frame,
          lastKnownLocation: entityDockLocation(entity),
          modules: { ...shipState.configuration.modules },
        };
        const previous = playerState.ownedShip;
        const moved =
          previous === undefined ||
          previous.entityId !== nextReference.entityId ||
          previous.frame !== nextReference.frame ||
          previous.lastKnownLocation.dimensionId !==
            nextReference.lastKnownLocation.dimensionId ||
          Math.abs(
            previous.lastKnownLocation.x - nextReference.lastKnownLocation.x,
          ) > 0.25 ||
          Math.abs(
            previous.lastKnownLocation.y - nextReference.lastKnownLocation.y,
          ) > 0.25 ||
          Math.abs(
            previous.lastKnownLocation.z - nextReference.lastKnownLocation.z,
          ) > 0.25;
        const modulesChanged =
          previous === undefined ||
          (["hull", "engine", "cargo", "utility"] as const).some(
            (slot) => previous.modules[slot] !== nextReference.modules[slot],
          );
        let objectiveChanged = false;

        if (
          nextReference.frame === "skiff" &&
          (playerState.objective === "gather_ship_parts" ||
            playerState.objective === "assemble_skiff")
        ) {
          playerState.objective = "recover_aether_crystal";
          objectiveChanged = true;
        }

        if (
          nextReference.frame === "skycutter" &&
          (playerState.objective === "assemble_skycutter" ||
            playerState.objective === "return_crystal")
        ) {
          playerState.skycutterUnlocked = true;
          playerState.objective = "reach_frostspire";
          objectiveChanged = true;
        }

        if (moved || modulesChanged || objectiveChanged) {
          playerState.ownedShip = nextReference;
          repository.save(playerState);
        }
      }
    }
  }
}

export function entityDockLocation(entity: Entity): DockLocation {
  return {
    dimensionId: entity.dimension.id,
    x: entity.location.x,
    y: entity.location.y,
    z: entity.location.z,
  };
}

function spawnOwnedShip(
  player: Player,
  frame: ShipFrame,
  typeId: string,
  location: Vector3,
  modules: ShipModuleSlots,
  logger: Logger,
  options: ShipSpawnOptions,
): Entity {
  const trackAsPrimary = options.trackAsPrimary !== false;
  const ship = player.dimension.spawnEntity(typeId, location, {
    initialPersistence: true,
  });

  if (!trackAsPrimary) {
    // Mark the entity before any repository/component work can throw so an
    // incomplete developer spawn can never be adopted as the canonical ship.
    ship.addTag(NON_PRIMARY_SHIP_TAG);
  }

  const playerRepository = trackAsPrimary
    ? new PlayerStateRepository(player, STARTER_ISLAND.safeDock)
    : undefined;
  const playerState = playerRepository?.load();
  const shipId = `${frame}-${system.currentTick}-${ship.id.slice(-8)}`;
  const repository = new ShipStateRepository(
    ship,
    shipId,
    entityDockLocation(ship),
    frame,
  );
  const state = repository.load();
  const tameable = ship.getComponent(EntityComponentTypes.Tameable) as
    EntityTameableComponent | undefined;

  tameable?.tame(player);
  state.ownerPlayerId = player.id;
  state.ownerName = player.name;
  state.homeDock = entityDockLocation(ship);
  state.docked = true;
  state.configuration.frame = frame;
  state.configuration.modules = { ...modules };
  repository.save(state);

  if (frame === "skycutter") {
    applyShipConfiguration(ship, state.configuration.modules);
  }
  ship.nameTag =
    frame === "skycutter" ? "Sky Knights Skycutter" : "Sky Knights Skiff";
  ship.addTag("skyknights.ship");
  ship.addTag(`skyknights.ship.${frame}`);

  if (playerRepository !== undefined && playerState !== undefined) {
    playerState.ownedShip = {
      entityId: ship.id,
      shipId,
      frame,
      lastKnownLocation: entityDockLocation(ship),
      modules: { ...modules },
    };
    playerRepository.save(playerState);
  }

  logger.info("Owned ship spawned.", {
    shipId,
    frame,
    ownerPlayerId: player.id,
    dimensionId: player.dimension.id,
    trackAsPrimary,
  });

  return ship;
}

function applyShipModule(
  entity: Entity,
  slot: ShipModuleSlot,
  itemId: string | undefined,
): void {
  entity.triggerEvent(moduleApplyEvent(slot, itemId));

  for (const tag of moduleTagsForSlot(slot)) {
    entity.removeTag(tag);
  }

  const activeTag = installedModuleTag(slot, itemId);

  if (activeTag !== undefined) {
    entity.addTag(activeTag);
  }
}

function shipFrameForEntity(entity: Entity): ShipFrame | undefined {
  if (entity.typeId === IDENTIFIERS.skiff) {
    return "skiff";
  }

  if (entity.typeId === IDENTIFIERS.skycutter) {
    return "skycutter";
  }

  return undefined;
}
