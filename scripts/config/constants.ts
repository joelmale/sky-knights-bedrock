import {
  ISLAND_STRUCTURE_IDS,
  IslandDefinition,
  islandDefinition,
} from "./islands";

export const IDENTIFIERS = {
  skiff: "skyknights:skiff",
  skycutter: "skyknights:skycutter",
  dockmaster: "skyknights:dockmaster",
  // Keep legacy consumers aligned with the authoritative island registry.
  starterIsland: ISLAND_STRUCTURE_IDS.starter_island,
  emberOutpost: ISLAND_STRUCTURE_IDS.ember_outpost,
  frostspire: ISLAND_STRUCTURE_IDS.frostspire,
  skyRealm: "skyknights:sky_realm",
  shipCore: "skyknights:ship_core",
  canvasBundle: "skyknights:canvas_bundle",
  thrusterModule: "skyknights:thruster_module",
  aetherCrystal: "skyknights:aether_crystal",
  reinforcedHull: "skyknights:reinforced_hull",
  aetherEngine: "skyknights:aether_engine",
  cargoHold: "skyknights:cargo_hold",
  navigatorModule: "skyknights:navigator_module",
  repairKit: "skyknights:repair_kit",
  froststeelIngot: "skyknights:froststeel_ingot",
  armoredHull: "skyknights:armored_hull",
  frostfireEngine: "skyknights:frostfire_engine",
  expandedCargoHold: "skyknights:expanded_cargo_hold",
  aetherCannon: "skyknights:aether_cannon",
  shieldProjector: "skyknights:shield_projector",
  cannonControl: "skyknights:cannon_control",
  aetherCharge: "skyknights:aether_charge",
  raiderCore: "skyknights:raider_core",
  skyRaider: "skyknights:sky_raider",
} as const;

function pinnedIsland(id: string): {
  definition: IslandDefinition;
  origin: NonNullable<IslandDefinition["pinnedOrigin"]>;
} {
  const definition = islandDefinition(id);

  if (definition.pinnedOrigin === undefined) {
    throw new Error(`Legacy island ${id} must have a pinned origin.`);
  }

  return { definition, origin: definition.pinnedOrigin };
}

function requiredAnchor(
  definition: IslandDefinition,
  anchor: "lootChest" | "encounterSpawn",
) {
  const offset = definition.anchors[anchor];

  if (offset === undefined) {
    throw new Error(`Legacy island ${definition.id} must have ${anchor}.`);
  }

  const origin = definition.pinnedOrigin;

  if (origin === undefined) {
    throw new Error(
      `Legacy island ${definition.id} must have a pinned origin.`,
    );
  }

  return {
    x: origin.x + offset.x,
    y: origin.y + offset.y,
    z: origin.z + offset.z,
  };
}

const starter = pinnedIsland("starter_island");
const ember = pinnedIsland("ember_outpost");
const frost = pinnedIsland("frostspire");

export const STARTER_ISLAND = {
  id: starter.definition.id,
  contentVersion: starter.definition.contentVersion,
  dimensionId: starter.definition.dimensionId,
  structureId: starter.definition.structureId,
  origin: starter.origin,
  size: starter.definition.size,
  integrityBlocks: starter.definition.integrityBlocks,
  safeDock: {
    dimensionId: starter.definition.dimensionId,
    x: starter.origin.x + starter.definition.anchors.safeDock.x,
    y: starter.origin.y + starter.definition.anchors.safeDock.y,
    z: starter.origin.z + starter.definition.anchors.safeDock.z,
  },
} as const;

export const EMBER_OUTPOST = {
  id: ember.definition.id,
  contentVersion: ember.definition.contentVersion,
  dimensionId: ember.definition.dimensionId,
  structureId: ember.definition.structureId,
  origin: ember.origin,
  size: ember.definition.size,
  integrityBlocks: ember.definition.integrityBlocks,
  lootChest: requiredAnchor(ember.definition, "lootChest"),
  encounterSpawn: requiredAnchor(ember.definition, "encounterSpawn"),
} as const;

export const FROSTSPIRE = {
  id: frost.definition.id,
  contentVersion: frost.definition.contentVersion,
  dimensionId: frost.definition.dimensionId,
  structureId: frost.definition.structureId,
  origin: frost.origin,
  size: frost.definition.size,
  integrityBlocks: frost.definition.integrityBlocks,
  lootChest: requiredAnchor(frost.definition, "lootChest"),
  encounterSpawn: requiredAnchor(frost.definition, "encounterSpawn"),
} as const;

export const REQUIRED_ISLANDS = [
  STARTER_ISLAND,
  EMBER_OUTPOST,
  FROSTSPIRE,
] as const;

export const SKYCUTTER_LOADOUT = {
  hull: IDENTIFIERS.reinforcedHull,
  engine: IDENTIFIERS.aetherEngine,
  cargo: IDENTIFIERS.cargoHold,
  utility: IDENTIFIERS.navigatorModule,
} as const;

export const SKY_RAIDER_ENCOUNTER = {
  dimensionId: "minecraft:overworld",
  patrolCenter: { x: 174, y: 172, z: 28 },
  activationDistanceFromDock: 60,
  spawnDistanceFromPlayer: 28,
  rewardDistance: 72,
} as const;

export const COMBAT = {
  cannonRange: 64,
  cannonDamage: 24,
  cannonCooldownTicks: 20,
  armoredHullDamageMultiplier: 0.8,
  shieldDamageMultiplier: 0.55,
} as const;

export const DOCKYARD = {
  dockmaster: {
    x: 12.5,
    y: 161,
    z: 0.5,
  },
  skiffLaunch: {
    x: 19.5,
    y: 161,
    z: 0.5,
  },
  skycutterLaunch: {
    x: 20.5,
    y: 161,
    z: 0.5,
  },
  serviceRadius: 18,
  assemblyRequirements: [
    { itemId: IDENTIFIERS.shipCore, count: 1 },
    { itemId: IDENTIFIERS.canvasBundle, count: 2 },
    { itemId: IDENTIFIERS.thrusterModule, count: 1 },
  ],
  skycutterRequirements: [
    { itemId: IDENTIFIERS.reinforcedHull, count: 1 },
    { itemId: IDENTIFIERS.aetherEngine, count: 1 },
    { itemId: IDENTIFIERS.cargoHold, count: 1 },
    { itemId: IDENTIFIERS.navigatorModule, count: 1 },
  ],
} as const;

export const VOID_RESCUE_Y = 64;
export const RECOVERY_INTERVAL_TICKS = 10;
export const BASIC_SHIP_RANGE = 150;
export const BASIC_SHIP_WARNING_RANGE = 130;
export const WORLD_STATE_SEED_SALT = "skyknights:world-state:v4";
