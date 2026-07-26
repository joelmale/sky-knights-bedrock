export const IDENTIFIERS = {
  skiff: "skyknights:skiff",
  skycutter: "skyknights:skycutter",
  dockmaster: "skyknights:dockmaster",
  starterIsland: "skyknights:starter_island",
  emberOutpost: "skyknights:ember_outpost",
  frostspire: "skyknights:frostspire",
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
} as const;

export const STARTER_ISLAND = {
  id: "starter_island",
  contentVersion: 3,
  dimensionId: "minecraft:overworld",
  structureId: IDENTIFIERS.starterIsland,
  origin: { x: -12, y: 149, z: -10 },
  size: { x: 31, y: 16, z: 23 },
  integrityBlocks: [
    { offset: { x: 12, y: 0, z: 10 }, typeId: "minecraft:stone" },
    { offset: { x: 1, y: 11, z: 10 }, typeId: "minecraft:grass_block" },
    { offset: { x: 23, y: 11, z: 10 }, typeId: "minecraft:grass_block" },
    { offset: { x: 12, y: 11, z: 1 }, typeId: "minecraft:grass_block" },
    { offset: { x: 12, y: 11, z: 19 }, typeId: "minecraft:grass_block" },
    { offset: { x: 30, y: 11, z: 10 }, typeId: "minecraft:oak_planks" },
  ],
  safeDock: {
    dimensionId: "minecraft:overworld",
    x: 9.5,
    y: 161,
    z: 0.5,
  },
} as const;

export const EMBER_OUTPOST = {
  id: "ember_outpost",
  contentVersion: 3,
  dimensionId: "minecraft:overworld",
  structureId: IDENTIFIERS.emberOutpost,
  origin: { x: 72, y: 151, z: -10 },
  size: { x: 25, y: 14, z: 21 },
  integrityBlocks: [
    { offset: { x: 12, y: 0, z: 10 }, typeId: "minecraft:blackstone" },
    {
      offset: { x: 0, y: 9, z: 10 },
      typeId: "minecraft:polished_blackstone_bricks",
    },
    { offset: { x: 23, y: 9, z: 10 }, typeId: "minecraft:netherrack" },
    { offset: { x: 12, y: 9, z: 1 }, typeId: "minecraft:netherrack" },
    { offset: { x: 12, y: 9, z: 19 }, typeId: "minecraft:netherrack" },
  ],
  lootChest: { x: 84, y: 161, z: 0 },
  encounterSpawn: { x: 84.5, y: 161, z: 4.5 },
} as const;

export const FROSTSPIRE = {
  id: "frostspire",
  contentVersion: 1,
  dimensionId: "minecraft:overworld",
  structureId: IDENTIFIERS.frostspire,
  origin: { x: 240, y: 150, z: -11 },
  size: { x: 27, y: 15, z: 23 },
  integrityBlocks: [
    { offset: { x: 13, y: 0, z: 11 }, typeId: "minecraft:stone" },
    {
      offset: { x: 0, y: 10, z: 11 },
      typeId: "minecraft:spruce_planks",
    },
    { offset: { x: 25, y: 10, z: 11 }, typeId: "minecraft:snow_block" },
    { offset: { x: 13, y: 10, z: 1 }, typeId: "minecraft:snow_block" },
    { offset: { x: 13, y: 10, z: 21 }, typeId: "minecraft:snow_block" },
  ],
  lootChest: { x: 253, y: 161, z: 0 },
  encounterSpawn: { x: 253.5, y: 161, z: 4.5 },
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
export const WORLD_STATE_SEED_SALT = "skyknights:world-state:v3";
