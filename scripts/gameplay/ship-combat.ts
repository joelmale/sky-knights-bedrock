import {
  Container,
  Entity,
  EntityComponentTypes,
  EntityDamageCause,
  EntityInventoryComponent,
  EntityProjectileComponent,
  EntityRideableComponent,
  ItemComponentRegistry,
  Player,
  system,
} from "@minecraft/server";

import { COMBAT, IDENTIFIERS } from "../config/constants";
import { Logger } from "../diagnostics/logger";
import { hasAetherCannon } from "./ship-modules";
import { isShipOwner, loadShipState, saveShipState } from "./skiff";

const nextCannonTick = new Map<string, number>();
const LAST_ATTACKER_PROPERTY = "skyknights:last_cannon_attacker";

export function registerCombatItemComponents(
  registry: ItemComponentRegistry,
  logger: Logger,
): void {
  registry.registerCustomComponent("skyknights:fire_cannon", {
    onUse: ({ source }) => {
      system.run(() => {
        try {
          fireAetherCannon(source, logger);
        } catch (error) {
          logger.error("Aether Cannon fire failed.", {
            playerId: source.id,
            error: error instanceof Error ? error.message : String(error),
          });
          source.sendMessage(
            "§cThe Aether Cannon misfired. Check the Content Log.§r",
          );
        }
      });
    },
  });
}

export function fireAetherCannon(player: Player, logger: Logger): boolean {
  const ship = mountedSkycutter(player);

  if (ship === undefined) {
    player.onScreenDisplay.setActionBar(
      "§eBoard a cannon-equipped Skycutter to use this control.§r",
    );
    return false;
  }

  const state = loadShipState(ship);

  if (state === undefined || !hasAetherCannon(state.configuration.modules)) {
    player.onScreenDisplay.setActionBar(
      "§eInstall an Aether Cannon in the Utility slot first.§r",
    );
    return false;
  }

  const rideable = ship.getComponent(EntityComponentTypes.Rideable) as
    EntityRideableComponent | undefined;
  const ownerAboard = rideable
    ?.getRiders()
    .some((rider) => rider instanceof Player && isShipOwner(rider, state));

  if (!ownerAboard) {
    player.onScreenDisplay.setActionBar(
      "§cThe owner must be aboard before a gunner can fire.§r",
    );
    return false;
  }

  const allowedTick = nextCannonTick.get(player.id) ?? 0;

  if (system.currentTick < allowedTick) {
    return false;
  }

  const shipInventory = ship.getComponent(EntityComponentTypes.Inventory) as
    EntityInventoryComponent | undefined;
  const playerInventory = player.getComponent(
    EntityComponentTypes.Inventory,
  ) as EntityInventoryComponent | undefined;
  const ammoContainer =
    containerWithItem(shipInventory?.container, IDENTIFIERS.aetherCharge) ??
    containerWithItem(playerInventory?.container, IDENTIFIERS.aetherCharge);

  if (ammoContainer === undefined) {
    player.onScreenDisplay.setActionBar(
      "§cLoad Aether Charges into ship cargo or your inventory.§r",
    );
    return false;
  }

  consumeOne(ammoContainer, IDENTIFIERS.aetherCharge);
  nextCannonTick.set(
    player.id,
    system.currentTick + COMBAT.cannonCooldownTicks,
  );

  const origin = player.getHeadLocation();
  const direction = player.getViewDirection();
  spawnCannonVisual(player, origin, direction);
  const hit = player.dimension
    .getEntitiesFromRay(origin, direction, {
      maxDistance: COMBAT.cannonRange,
    })
    .find((candidate) => candidate.entity.typeId === IDENTIFIERS.skyRaider);

  state.combat.shotsFired += 1;

  if (hit !== undefined) {
    hit.entity.setDynamicProperty(LAST_ATTACKER_PROPERTY, player.name);
    hit.entity.applyDamage(COMBAT.cannonDamage, {
      cause: EntityDamageCause.projectile,
      damagingEntity: player,
    });
    state.combat.hits += 1;
    player.onScreenDisplay.setActionBar(
      `§bAether hit: ${COMBAT.cannonDamage} hull damage.§r`,
    );
  } else {
    player.onScreenDisplay.setActionBar("§7Aether shot missed.§r");
  }

  saveShipState(ship, state);
  logger.info("Aether Cannon fired.", {
    shipId: state.shipId,
    playerId: player.id,
    hit: hit?.entity.id,
    shotsFired: state.combat.shotsFired,
  });
  return true;
}

export function lastCannonAttacker(entity: Entity): string | undefined {
  const value = entity.getDynamicProperty(LAST_ATTACKER_PROPERTY);
  return typeof value === "string" ? value : undefined;
}

export function mountedSkycutter(player: Player): Entity | undefined {
  const candidates = player.dimension.getEntities({
    type: IDENTIFIERS.skycutter,
    location: player.location,
    maxDistance: 8,
  });

  return candidates.find((candidate) => {
    const rideable = candidate.getComponent(EntityComponentTypes.Rideable) as
      EntityRideableComponent | undefined;
    return rideable?.getRiders().some((rider) => rider.id === player.id);
  });
}

function spawnCannonVisual(
  player: Player,
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
): void {
  const projectileLocation = {
    x: origin.x + direction.x * 2,
    y: origin.y + direction.y * 2,
    z: origin.z + direction.z * 2,
  };
  const projectile = player.dimension.spawnEntity(
    "minecraft:snowball",
    projectileLocation,
  );
  const component = projectile.getComponent(EntityComponentTypes.Projectile) as
    EntityProjectileComponent | undefined;

  if (component !== undefined) {
    component.owner = player;
    component.gravity = 0;
    component.shoot({
      x: direction.x * 2.4,
      y: direction.y * 2.4,
      z: direction.z * 2.4,
    });
  }

  player.dimension.playSound("random.explode", projectileLocation, {
    pitch: 1.8,
    volume: 0.55,
  });
}

function containerWithItem(
  container: Container | undefined,
  itemId: string,
): Container | undefined {
  if (container === undefined) {
    return undefined;
  }

  for (let slot = 0; slot < container.size; slot += 1) {
    if (container.getItem(slot)?.typeId === itemId) {
      return container;
    }
  }

  return undefined;
}

function consumeOne(container: Container, itemId: string): void {
  for (let slot = 0; slot < container.size; slot += 1) {
    const stack = container.getItem(slot);

    if (stack?.typeId !== itemId) {
      continue;
    }

    if (stack.amount === 1) {
      container.setItem(slot);
    } else {
      stack.amount -= 1;
      container.setItem(slot, stack);
    }

    return;
  }

  throw new Error(`Missing expected ammunition ${itemId}.`);
}
