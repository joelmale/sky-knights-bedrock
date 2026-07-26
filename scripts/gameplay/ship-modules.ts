import { COMBAT, IDENTIFIERS } from "../config/constants";
import { ShipModuleSlot, ShipModuleSlots } from "../persistence/schema";

export interface ShipModuleDefinition {
  itemId: string;
  slot: ShipModuleSlot;
  displayName: string;
  description: string;
  applyEvent: string;
  entityTag: string;
}

export const SHIP_MODULE_DEFINITIONS: readonly ShipModuleDefinition[] = [
  {
    itemId: IDENTIFIERS.reinforcedHull,
    slot: "hull",
    displayName: "Reinforced Hull",
    description: "Standard 120-point hull.",
    applyEvent: "skyknights:apply_reinforced_hull",
    entityTag: "skyknights.module.hull.reinforced",
  },
  {
    itemId: IDENTIFIERS.armoredHull,
    slot: "hull",
    displayName: "Armored Hull",
    description: "180-point hull with 20% damage reduction.",
    applyEvent: "skyknights:apply_armored_hull",
    entityTag: "skyknights.module.hull.armored",
  },
  {
    itemId: IDENTIFIERS.aetherEngine,
    slot: "engine",
    displayName: "Aether Engine",
    description: "Standard long-range flight.",
    applyEvent: "skyknights:apply_aether_engine",
    entityTag: "skyknights.module.engine.aether",
  },
  {
    itemId: IDENTIFIERS.frostfireEngine,
    slot: "engine",
    displayName: "Frostfire Engine",
    description: "Long-range flight with higher cruising speed.",
    applyEvent: "skyknights:apply_frostfire_engine",
    entityTag: "skyknights.module.engine.frostfire",
  },
  {
    itemId: IDENTIFIERS.cargoHold,
    slot: "cargo",
    displayName: "Cargo Hold",
    description: "Standard 18-slot cargo inventory.",
    applyEvent: "skyknights:apply_cargo_hold",
    entityTag: "skyknights.module.cargo.standard",
  },
  {
    itemId: IDENTIFIERS.expandedCargoHold,
    slot: "cargo",
    displayName: "Expanded Cargo Hold",
    description: "Expanded 27-slot cargo inventory.",
    applyEvent: "skyknights:apply_expanded_cargo_hold",
    entityTag: "skyknights.module.cargo.expanded",
  },
  {
    itemId: IDENTIFIERS.navigatorModule,
    slot: "utility",
    displayName: "Navigator Module",
    description: "Standard expedition navigation equipment.",
    applyEvent: "skyknights:apply_navigator_module",
    entityTag: "skyknights.module.utility.navigator",
  },
  {
    itemId: IDENTIFIERS.aetherCannon,
    slot: "utility",
    displayName: "Aether Cannon",
    description: "Enables 64-block aimed fire using Aether Charges.",
    applyEvent: "skyknights:apply_aether_cannon",
    entityTag: "skyknights.module.utility.cannon",
  },
  {
    itemId: IDENTIFIERS.shieldProjector,
    slot: "utility",
    displayName: "Shield Projector",
    description: "Reduces incoming damage by 45%.",
    applyEvent: "skyknights:apply_shield_projector",
    entityTag: "skyknights.module.utility.shield",
  },
] as const;

const DEFAULT_EVENTS: Readonly<Record<ShipModuleSlot, string>> = {
  hull: "skyknights:clear_hull_module",
  engine: "skyknights:clear_engine_module",
  cargo: "skyknights:clear_cargo_module",
  utility: "skyknights:clear_utility_module",
};

export function shipModuleDefinition(
  itemId: string | undefined,
): ShipModuleDefinition | undefined {
  return SHIP_MODULE_DEFINITIONS.find(
    (definition) => definition.itemId === itemId,
  );
}

export function modulesForSlot(
  slot: ShipModuleSlot,
): readonly ShipModuleDefinition[] {
  return SHIP_MODULE_DEFINITIONS.filter(
    (definition) => definition.slot === slot,
  );
}

export function shipModuleName(itemId: string | undefined): string {
  if (itemId === undefined) {
    return "Empty";
  }

  return shipModuleDefinition(itemId)?.displayName ?? itemId;
}

export function moduleApplyEvent(
  slot: ShipModuleSlot,
  itemId: string | undefined,
): string {
  const definition = shipModuleDefinition(itemId);
  return definition?.slot === slot
    ? definition.applyEvent
    : DEFAULT_EVENTS[slot];
}

export function moduleTagsForSlot(slot: ShipModuleSlot): readonly string[] {
  return modulesForSlot(slot).map((definition) => definition.entityTag);
}

export function installedModuleTag(
  slot: ShipModuleSlot,
  itemId: string | undefined,
): string | undefined {
  const definition = shipModuleDefinition(itemId);
  return definition?.slot === slot ? definition.entityTag : undefined;
}

export function hasExtendedRangeModule(modules: ShipModuleSlots): boolean {
  return (
    modules.engine === IDENTIFIERS.aetherEngine ||
    modules.engine === IDENTIFIERS.frostfireEngine
  );
}

export function hasAetherCannon(modules: ShipModuleSlots): boolean {
  return modules.utility === IDENTIFIERS.aetherCannon;
}

export function hasExpandedCargo(modules: ShipModuleSlots): boolean {
  return modules.cargo === IDENTIFIERS.expandedCargoHold;
}

export function shipDamageMultiplier(modules: ShipModuleSlots): number {
  let multiplier = 1;

  if (modules.hull === IDENTIFIERS.armoredHull) {
    multiplier *= COMBAT.armoredHullDamageMultiplier;
  }

  if (modules.utility === IDENTIFIERS.shieldProjector) {
    multiplier *= COMBAT.shieldDamageMultiplier;
  }

  return multiplier;
}
