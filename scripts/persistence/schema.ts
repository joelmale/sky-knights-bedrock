export const CURRENT_WORLD_SCHEMA_VERSION = 4;
export const CURRENT_PLAYER_SCHEMA_VERSION = 3;
export const CURRENT_SHIP_SCHEMA_VERSION = 3;

export interface DockLocation {
  dimensionId: string;
  x: number;
  y: number;
  z: number;
}

export type GenerationStage = "queued" | "structure_placed";

export interface GenerationJob {
  id: string;
  contentVersion: number;
  structureId: string;
  dimensionId: string;
  origin: {
    x: number;
    y: number;
    z: number;
  };
  stage: GenerationStage;
  attempts: number;
}

interface WorldStateV1 {
  schemaVersion: 1;
  seed: number;
  generatedIslandIds: string[];
}

interface WorldStateV2 {
  schemaVersion: 2;
  seed: number;
  generatedIslandIds: string[];
  activeGeneration?: unknown;
  migrations: string[];
}

interface WorldStateV3 {
  schemaVersion: 3;
  seed: number;
  generatedIslandIds: string[];
  islandVersions: Record<string, number>;
  activeGeneration?: unknown;
  migrations: string[];
}

export type SkyRaiderEncounterStatus = "dormant" | "active" | "defeated";

export interface SkyRaiderEncounterState {
  status: SkyRaiderEncounterStatus;
  entityId?: string;
  lastKnownLocation?: DockLocation;
}

export interface WorldState {
  schemaVersion: typeof CURRENT_WORLD_SCHEMA_VERSION;
  seed: number;
  generatedIslandIds: string[];
  islandVersions: Record<string, number>;
  activeGeneration?: GenerationJob;
  skyRaiderEncounter: SkyRaiderEncounterState;
  migrations: string[];
}

export type TutorialObjective =
  | "gather_ship_parts"
  | "assemble_skiff"
  | "recover_aether_crystal"
  | "return_crystal"
  | "assemble_skycutter"
  | "reach_frostspire"
  | "return_frost_cargo"
  | "craft_combat_refit"
  | "install_combat_refit"
  | "defeat_sky_raider"
  | "return_raider_core"
  | "combat_complete";

export type ShipFrame = "skiff" | "skycutter";
export type ShipModuleSlot = "hull" | "engine" | "cargo" | "utility";
export type ShipModuleSlots = Partial<Record<ShipModuleSlot, string>>;

export interface OwnedShipReference {
  entityId?: string;
  shipId: string;
  frame: ShipFrame;
  lastKnownLocation: DockLocation;
  modules: ShipModuleSlots;
}

interface PlayerStateV1 {
  schemaVersion: 1;
  initialized: boolean;
  recoveryEnabled: boolean;
  discoveredIslandIds: string[];
  lastSafeDock: DockLocation;
}

interface PlayerStateV2 {
  schemaVersion: 2;
  initialized: boolean;
  recoveryEnabled: boolean;
  discoveredIslandIds: string[];
  lastSafeDock: DockLocation;
  skycutterUnlocked: boolean;
  objective: unknown;
  ownedShip?: unknown;
}

export interface PlayerState {
  schemaVersion: typeof CURRENT_PLAYER_SCHEMA_VERSION;
  initialized: boolean;
  recoveryEnabled: boolean;
  discoveredIslandIds: string[];
  lastSafeDock: DockLocation;
  skycutterUnlocked: boolean;
  objective: TutorialObjective;
  ownedShip?: OwnedShipReference;
}

interface ShipStateV1 {
  schemaVersion: 1;
  shipId: string;
  ownerPlayerId?: string;
  homeDock: DockLocation;
  configuration: {
    frame: "skiff";
    modules: string[];
  };
}

interface ShipStateV2 {
  schemaVersion: 2;
  shipId: string;
  ownerPlayerId?: string;
  ownerName?: string;
  homeDock: DockLocation;
  docked: boolean;
  configuration: {
    frame: ShipFrame;
    modules: ShipModuleSlots;
  };
}

export interface ShipCombatState {
  shotsFired: number;
  hits: number;
  raidersDefeated: number;
}

export interface ShipState {
  schemaVersion: typeof CURRENT_SHIP_SCHEMA_VERSION;
  shipId: string;
  ownerPlayerId?: string;
  ownerName?: string;
  homeDock: DockLocation;
  docked: boolean;
  combat: ShipCombatState;
  configuration: {
    frame: ShipFrame;
    modules: ShipModuleSlots;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, number> = {};

  for (const key in value) {
    const entry = value[key];

    if (typeof entry === "number" && Number.isFinite(entry)) {
      result[key] = Math.max(0, Math.trunc(entry));
    }
  }

  return result;
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function dockLocation(
  value: unknown,
  fallbackDock: DockLocation,
): DockLocation {
  if (!isRecord(value)) {
    return fallbackDock;
  }

  return {
    dimensionId:
      typeof value.dimensionId === "string"
        ? value.dimensionId
        : fallbackDock.dimensionId,
    x: finiteNumber(value.x, fallbackDock.x),
    y: finiteNumber(value.y, fallbackDock.y),
    z: finiteNumber(value.z, fallbackDock.z),
  };
}

function shipFrame(value: unknown, fallback: ShipFrame): ShipFrame {
  return value === "skycutter" || value === "skiff" ? value : fallback;
}

function shipModules(value: unknown): ShipModuleSlots {
  if (!isRecord(value)) {
    return {};
  }

  const modules: ShipModuleSlots = {};

  for (const slot of ["hull", "engine", "cargo", "utility"] as const) {
    if (typeof value[slot] === "string") {
      modules[slot] = value[slot];
    }
  }

  return modules;
}

function legacyShipModules(value: unknown): ShipModuleSlots {
  const modules = stringArray(value);
  const result: ShipModuleSlots = {};

  if (modules.includes("canvas_hull")) {
    result.hull = "canvas_hull";
  }

  if (modules.includes("starter_thruster")) {
    result.engine = "starter_thruster";
  }

  return result;
}

function tutorialObjective(
  value: unknown,
  discoveredIslandIds: readonly string[],
): TutorialObjective {
  if (
    value === "gather_ship_parts" ||
    value === "assemble_skiff" ||
    value === "recover_aether_crystal" ||
    value === "return_crystal" ||
    value === "assemble_skycutter" ||
    value === "reach_frostspire" ||
    value === "return_frost_cargo" ||
    value === "craft_combat_refit" ||
    value === "install_combat_refit" ||
    value === "defeat_sky_raider" ||
    value === "return_raider_core" ||
    value === "combat_complete"
  ) {
    return value;
  }

  if (value === "complete") {
    return "craft_combat_refit";
  }

  return discoveredIslandIds.includes("ember_outpost")
    ? "return_crystal"
    : "gather_ship_parts";
}

function ownedShip(
  value: unknown,
  fallbackDock: DockLocation,
): OwnedShipReference | undefined {
  if (!isRecord(value) || typeof value.shipId !== "string") {
    return undefined;
  }

  return {
    entityId: typeof value.entityId === "string" ? value.entityId : undefined,
    shipId: value.shipId,
    frame: shipFrame(value.frame, "skiff"),
    lastKnownLocation: dockLocation(value.lastKnownLocation, fallbackDock),
    modules: shipModules(value.modules),
  };
}

function skyRaiderEncounter(value: unknown): SkyRaiderEncounterState {
  if (!isRecord(value)) {
    return { status: "dormant" };
  }

  const status =
    value.status === "active" || value.status === "defeated"
      ? value.status
      : "dormant";
  const fallback = {
    dimensionId: "minecraft:overworld",
    x: 174,
    y: 172,
    z: 28,
  };

  return {
    status,
    entityId: typeof value.entityId === "string" ? value.entityId : undefined,
    lastKnownLocation:
      value.lastKnownLocation === undefined
        ? undefined
        : dockLocation(value.lastKnownLocation, fallback),
  };
}

function shipCombat(value: unknown): ShipCombatState {
  if (!isRecord(value)) {
    return {
      shotsFired: 0,
      hits: 0,
      raidersDefeated: 0,
    };
  }

  return {
    shotsFired: Math.max(0, Math.trunc(finiteNumber(value.shotsFired, 0))),
    hits: Math.max(0, Math.trunc(finiteNumber(value.hits, 0))),
    raidersDefeated: Math.max(
      0,
      Math.trunc(finiteNumber(value.raidersDefeated, 0)),
    ),
  };
}

function generationJob(value: unknown): GenerationJob | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const origin = value.origin;
  const stage = value.stage;

  if (
    typeof value.id !== "string" ||
    typeof value.structureId !== "string" ||
    typeof value.dimensionId !== "string" ||
    !isRecord(origin) ||
    (stage !== "queued" && stage !== "structure_placed")
  ) {
    return undefined;
  }

  return {
    id: value.id,
    contentVersion: Math.max(
      0,
      Math.trunc(finiteNumber(value.contentVersion, 0)),
    ),
    structureId: value.structureId,
    dimensionId: value.dimensionId,
    origin: {
      x: finiteNumber(origin.x, 0),
      y: finiteNumber(origin.y, 0),
      z: finiteNumber(origin.z, 0),
    },
    stage,
    attempts: Math.max(0, Math.trunc(finiteNumber(value.attempts, 0))),
  };
}

export function createWorldState(seed: number): WorldState {
  return {
    schemaVersion: CURRENT_WORLD_SCHEMA_VERSION,
    seed: seed >>> 0,
    generatedIslandIds: [],
    islandVersions: {},
    skyRaiderEncounter: { status: "dormant" },
    migrations: [],
  };
}

export function migrateWorldState(
  value: unknown,
  createSeed: () => number,
): WorldState {
  if (!isRecord(value)) {
    return createWorldState(createSeed());
  }

  if (value.schemaVersion === 1) {
    const legacy = value as unknown as WorldStateV1;

    return {
      schemaVersion: CURRENT_WORLD_SCHEMA_VERSION,
      seed: finiteNumber(legacy.seed, createSeed()) >>> 0,
      generatedIslandIds: stringArray(legacy.generatedIslandIds),
      islandVersions: {},
      skyRaiderEncounter: { status: "dormant" },
      migrations: ["world:v1->v2", "world:v2->v3", "world:v3->v4"],
    };
  }

  if (value.schemaVersion === 2) {
    const legacy = value as unknown as WorldStateV2;

    return {
      schemaVersion: CURRENT_WORLD_SCHEMA_VERSION,
      seed: finiteNumber(legacy.seed, createSeed()) >>> 0,
      generatedIslandIds: stringArray(legacy.generatedIslandIds),
      islandVersions: {},
      activeGeneration: generationJob(legacy.activeGeneration),
      skyRaiderEncounter: { status: "dormant" },
      migrations: [
        ...stringArray(legacy.migrations),
        "world:v2->v3",
        "world:v3->v4",
      ],
    };
  }

  if (value.schemaVersion === 3) {
    const legacy = value as unknown as WorldStateV3;

    return {
      schemaVersion: CURRENT_WORLD_SCHEMA_VERSION,
      seed: finiteNumber(legacy.seed, createSeed()) >>> 0,
      generatedIslandIds: stringArray(legacy.generatedIslandIds),
      islandVersions: numberRecord(legacy.islandVersions),
      activeGeneration: generationJob(legacy.activeGeneration),
      skyRaiderEncounter: { status: "dormant" },
      migrations: [...stringArray(legacy.migrations), "world:v3->v4"],
    };
  }

  if (value.schemaVersion !== CURRENT_WORLD_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported Sky Knights world schema: ${String(value.schemaVersion)}`,
    );
  }

  return {
    schemaVersion: CURRENT_WORLD_SCHEMA_VERSION,
    seed: finiteNumber(value.seed, createSeed()) >>> 0,
    generatedIslandIds: stringArray(value.generatedIslandIds),
    islandVersions: numberRecord(value.islandVersions),
    activeGeneration: generationJob(value.activeGeneration),
    skyRaiderEncounter: skyRaiderEncounter(value.skyRaiderEncounter),
    migrations: stringArray(value.migrations),
  };
}

export function createPlayerState(lastSafeDock: DockLocation): PlayerState {
  return {
    schemaVersion: CURRENT_PLAYER_SCHEMA_VERSION,
    initialized: false,
    recoveryEnabled: true,
    discoveredIslandIds: [],
    lastSafeDock,
    skycutterUnlocked: false,
    objective: "gather_ship_parts",
  };
}

export function parsePlayerState(
  value: unknown,
  fallbackDock: DockLocation,
): PlayerState {
  if (!isRecord(value)) {
    return createPlayerState(fallbackDock);
  }

  if (
    value.schemaVersion !== 1 &&
    value.schemaVersion !== 2 &&
    value.schemaVersion !== CURRENT_PLAYER_SCHEMA_VERSION
  ) {
    return createPlayerState(fallbackDock);
  }

  const legacy = value as unknown as PlayerStateV1 | PlayerStateV2;
  const dock = dockLocation(legacy.lastSafeDock, fallbackDock);
  const discoveredIslandIds = stringArray(legacy.discoveredIslandIds);

  return {
    schemaVersion: CURRENT_PLAYER_SCHEMA_VERSION,
    initialized: legacy.initialized === true,
    recoveryEnabled: legacy.recoveryEnabled !== false,
    discoveredIslandIds,
    lastSafeDock: dock,
    skycutterUnlocked: value.skycutterUnlocked === true,
    objective: tutorialObjective(value.objective, discoveredIslandIds),
    ownedShip: ownedShip(value.ownedShip, dock),
  };
}

export function parseShipState(
  value: unknown,
  fallbackId: string,
  fallbackDock: DockLocation,
  fallbackFrame: ShipFrame = "skiff",
): ShipState {
  if (!isRecord(value)) {
    return {
      schemaVersion: CURRENT_SHIP_SCHEMA_VERSION,
      shipId: fallbackId,
      homeDock: fallbackDock,
      docked: false,
      combat: shipCombat(undefined),
      configuration: {
        frame: fallbackFrame,
        modules: {},
      },
    };
  }

  if (value.schemaVersion === 1) {
    const legacy = value as unknown as ShipStateV1;

    return {
      schemaVersion: CURRENT_SHIP_SCHEMA_VERSION,
      shipId: typeof legacy.shipId === "string" ? legacy.shipId : fallbackId,
      ownerPlayerId:
        typeof legacy.ownerPlayerId === "string"
          ? legacy.ownerPlayerId
          : undefined,
      homeDock: dockLocation(legacy.homeDock, fallbackDock),
      docked: false,
      combat: shipCombat(undefined),
      configuration: {
        frame: "skiff",
        modules: legacyShipModules(legacy.configuration?.modules),
      },
    };
  }

  if (value.schemaVersion === 2) {
    const legacy = value as unknown as ShipStateV2;

    return {
      schemaVersion: CURRENT_SHIP_SCHEMA_VERSION,
      shipId: typeof legacy.shipId === "string" ? legacy.shipId : fallbackId,
      ownerPlayerId:
        typeof legacy.ownerPlayerId === "string"
          ? legacy.ownerPlayerId
          : undefined,
      ownerName:
        typeof legacy.ownerName === "string" ? legacy.ownerName : undefined,
      homeDock: dockLocation(legacy.homeDock, fallbackDock),
      docked: legacy.docked === true,
      combat: shipCombat(undefined),
      configuration: {
        frame: shipFrame(legacy.configuration?.frame, fallbackFrame),
        modules: shipModules(legacy.configuration?.modules),
      },
    };
  }

  if (value.schemaVersion !== CURRENT_SHIP_SCHEMA_VERSION) {
    return parseShipState(undefined, fallbackId, fallbackDock, fallbackFrame);
  }

  const configuration = isRecord(value.configuration)
    ? value.configuration
    : undefined;

  return {
    schemaVersion: CURRENT_SHIP_SCHEMA_VERSION,
    shipId: typeof value.shipId === "string" ? value.shipId : fallbackId,
    ownerPlayerId:
      typeof value.ownerPlayerId === "string" ? value.ownerPlayerId : undefined,
    ownerName:
      typeof value.ownerName === "string" ? value.ownerName : undefined,
    homeDock: dockLocation(value.homeDock, fallbackDock),
    docked: value.docked === true,
    combat: shipCombat(value.combat),
    configuration: {
      frame: shipFrame(configuration?.frame, fallbackFrame),
      modules: shipModules(configuration?.modules),
    },
  };
}
