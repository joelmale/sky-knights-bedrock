import { IslandPlacementMode } from "../config/islands";
import {
  DEFAULT_WORLD_PROFILE_ID,
  deriveWorldSeed,
  worldProfile,
} from "../config/profiles";
import { BlockVector, StructureBounds } from "../generation/bounds";

export const CURRENT_WORLD_SCHEMA_VERSION = 5;
export const CURRENT_PLAYER_SCHEMA_VERSION = 3;
export const CURRENT_SHIP_SCHEMA_VERSION = 3;

export interface DockLocation {
  dimensionId: string;
  x: number;
  y: number;
  z: number;
}

export type GenerationStage = "queued" | "structure_placed";

export interface GenerationPart {
  structureId: string;
  origin: BlockVector;
  rotation: "None" | "Rotate90" | "Rotate180" | "Rotate270";
  row: number;
  integrityBlock: {
    offset: BlockVector;
    typeId: string;
  };
}

export interface GenerationJob {
  id: string;
  contentVersion: number;
  structureId: string;
  dimensionId: string;
  origin: BlockVector;
  stage: GenerationStage;
  attempts: number;
  /** Undefined preserves the legacy single-structure placement path. */
  parts?: readonly GenerationPart[];
  /** The next multipart structure index to place. */
  partCursor?: number;
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

/**
 * Where a planned island physically lives and how much space it reserved.
 *
 * `scripts/config/islands.ts` plans this from `(worldSeed, layoutVersion)`; the
 * world document remembers the result so a later `layoutVersion` bump can only
 * relocate terrain through an explicit, logged decision instead of silently
 * moving an island a player already visited.
 */
export interface IslandLayoutRecord {
  id: string;
  structureId: string;
  dimensionId: string;
  placement: IslandPlacementMode;
  origin: BlockVector;
  size: BlockVector;
  /** Structure bounds expanded by the layout registry's reserved padding. */
  reserved: StructureBounds;
  /**
   * ADR-007: once a player has edited authored terrain the island is never
   * regenerated merely because its content version changed. Sticky by design —
   * re-recording a layout can set the flag but never clears it.
   */
  playerModified: boolean;
}

interface WorldStateV4 {
  schemaVersion: 4;
  seed: number;
  generatedIslandIds: string[];
  islandVersions: Record<string, number>;
  activeGeneration?: GenerationJob;
  skyRaiderEncounter: SkyRaiderEncounterState;
  migrations: string[];
}

export interface WorldState {
  schemaVersion: typeof CURRENT_WORLD_SCHEMA_VERSION;
  /**
   * The raw world seed as first rolled. Preserved verbatim across every
   * migration; existing gameplay code keeps reading it.
   */
  seed: number;
  /**
   * The layout seed handed to the island registry. Derived from `seed` and the
   * profile salt, so an upgraded world keeps a stable realm.
   */
  worldSeed: number;
  worldProfile: string;
  /** Layout planner version `islandLayout` was planned at. */
  layoutVersion: number;
  generatedIslandIds: string[];
  islandVersions: Record<string, number>;
  /** Per-island layout and reservation records, keyed and written sorted by id. */
  islandLayout: Record<string, IslandLayoutRecord>;
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

/**
 * The stored seed, or a freshly rolled one. `createSeed` is invoked lazily so a
 * world that already carries a seed never rolls a throwaway replacement while
 * migrating.
 */
function persistedSeed(value: unknown, createSeed: () => number): number {
  return (
    (typeof value === "number" && Number.isFinite(value)
      ? value
      : createSeed()) >>> 0
  );
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

const ZERO_VECTOR: BlockVector = { x: 0, y: 0, z: 0 };
const UNIT_VECTOR: BlockVector = { x: 1, y: 1, z: 1 };

function blockVector(value: unknown, fallback: BlockVector): BlockVector {
  if (!isRecord(value)) {
    return { x: fallback.x, y: fallback.y, z: fallback.z };
  }

  return {
    x: Math.trunc(finiteNumber(value.x, fallback.x)),
    y: Math.trunc(finiteNumber(value.y, fallback.y)),
    z: Math.trunc(finiteNumber(value.z, fallback.z)),
  };
}

function reservedBounds(
  value: unknown,
  origin: BlockVector,
  size: BlockVector,
): StructureBounds {
  const fallback: StructureBounds = {
    from: { x: origin.x, y: origin.y, z: origin.z },
    to: {
      x: origin.x + size.x - 1,
      y: origin.y + size.y - 1,
      z: origin.z + size.z - 1,
    },
  };

  if (!isRecord(value)) {
    return fallback;
  }

  return {
    from: blockVector(value.from, fallback.from),
    to: blockVector(value.to, fallback.to),
  };
}

function parseIslandLayoutRecord(
  id: string,
  value: unknown,
): IslandLayoutRecord | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const origin = blockVector(value.origin, ZERO_VECTOR);
  const size = blockVector(value.size, UNIT_VECTOR);

  return {
    id,
    structureId:
      typeof value.structureId === "string"
        ? value.structureId
        : `skyknights:${id}`,
    dimensionId:
      typeof value.dimensionId === "string"
        ? value.dimensionId
        : "minecraft:overworld",
    placement: value.placement === "pinned" ? "pinned" : "seeded",
    origin,
    size,
    reserved: reservedBounds(value.reserved, origin, size),
    playerModified: value.playerModified === true,
  };
}

/** Rebuilds the map with sorted keys so serialization is byte-stable. */
function sortedLayoutRecords(
  records: Record<string, IslandLayoutRecord>,
): Record<string, IslandLayoutRecord> {
  const result: Record<string, IslandLayoutRecord> = {};

  for (const id of Object.keys(records).sort()) {
    result[id] = records[id];
  }

  return result;
}

function islandLayoutRecords(
  value: unknown,
): Record<string, IslandLayoutRecord> {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, IslandLayoutRecord> = {};

  for (const id of Object.keys(value).sort()) {
    const record = parseIslandLayoutRecord(id, value[id]);

    if (record !== undefined) {
      result[id] = record;
    }
  }

  return result;
}

function parsedBlockVector(value: unknown): BlockVector | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const coordinates = [value.x, value.y, value.z];

  if (
    !coordinates.every(
      (coordinate) =>
        typeof coordinate === "number" && Number.isFinite(coordinate),
    )
  ) {
    return undefined;
  }

  return {
    x: value.x as number,
    y: value.y as number,
    z: value.z as number,
  };
}

function generationPart(value: unknown): GenerationPart | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const origin = parsedBlockVector(value.origin);
  const integrityBlock = value.integrityBlock;
  const row = value.row;

  if (
    typeof value.structureId !== "string" ||
    origin === undefined ||
    (value.rotation !== "None" &&
      value.rotation !== "Rotate90" &&
      value.rotation !== "Rotate180" &&
      value.rotation !== "Rotate270") ||
    typeof row !== "number" ||
    !Number.isSafeInteger(row) ||
    row < 0 ||
    !isRecord(integrityBlock) ||
    typeof integrityBlock.typeId !== "string"
  ) {
    return undefined;
  }

  const offset = parsedBlockVector(integrityBlock.offset);

  if (offset === undefined) {
    return undefined;
  }

  return {
    structureId: value.structureId,
    origin,
    rotation: value.rotation,
    row,
    integrityBlock: {
      offset,
      typeId: integrityBlock.typeId,
    },
  };
}

function generationParts(
  value: unknown,
): readonly GenerationPart[] | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const parts: GenerationPart[] = [];

  for (const entry of value) {
    const part = generationPart(entry);

    if (part === undefined) {
      return undefined;
    }

    parts.push(part);
  }

  return parts;
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

  const hasParts = value.parts !== undefined;
  const parts = hasParts ? generationParts(value.parts) : undefined;

  if (hasParts && parts === undefined) {
    return undefined;
  }

  const partCursor = value.partCursor;

  if (partCursor !== undefined) {
    if (
      parts === undefined ||
      typeof partCursor !== "number" ||
      !Number.isSafeInteger(partCursor) ||
      partCursor < 0 ||
      partCursor > parts.length
    ) {
      return undefined;
    }
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
    ...(parts === undefined
      ? {}
      : {
          parts,
          ...(partCursor === undefined ? {} : { partCursor }),
        }),
  };
}

export function createWorldState(
  seed: number,
  profileId: string = DEFAULT_WORLD_PROFILE_ID,
): WorldState {
  const profile = worldProfile(profileId);
  const base = seed >>> 0;

  return {
    schemaVersion: CURRENT_WORLD_SCHEMA_VERSION,
    seed: base,
    worldSeed: deriveWorldSeed(base, profile.id),
    worldProfile: profile.id,
    layoutVersion: profile.layoutVersion,
    generatedIslandIds: [],
    islandVersions: {},
    islandLayout: {},
    skyRaiderEncounter: { status: "dormant" },
    migrations: [],
  };
}

/**
 * Schema 4 -> 5.
 *
 * Non-destructive and idempotent: every schema-4 field is carried across
 * untouched, the new fields are derived from data the document already has, and
 * the island layout starts empty so the layout registry records the placements
 * it plans on the next load. Nothing here can drop a generated island id, an
 * island content version, an in-flight generation job, or the shared encounter.
 */
function upgradeWorldStateV4(
  legacy: WorldStateV4,
  profileId: string,
): WorldState {
  const profile = worldProfile(profileId);

  return {
    schemaVersion: CURRENT_WORLD_SCHEMA_VERSION,
    seed: legacy.seed,
    worldSeed: deriveWorldSeed(legacy.seed, profile.id),
    worldProfile: profile.id,
    layoutVersion: profile.layoutVersion,
    generatedIslandIds: legacy.generatedIslandIds,
    islandVersions: legacy.islandVersions,
    islandLayout: {},
    activeGeneration: legacy.activeGeneration,
    skyRaiderEncounter: legacy.skyRaiderEncounter,
    migrations: [...legacy.migrations, "world:v4->v5"],
  };
}

export function migrateWorldState(
  value: unknown,
  createSeed: () => number,
  profileId: string = DEFAULT_WORLD_PROFILE_ID,
): WorldState {
  if (!isRecord(value)) {
    return createWorldState(createSeed(), profileId);
  }

  if (value.schemaVersion === 1) {
    const legacy = value as unknown as WorldStateV1;

    return upgradeWorldStateV4(
      {
        schemaVersion: 4,
        seed: persistedSeed(legacy.seed, createSeed),
        generatedIslandIds: stringArray(legacy.generatedIslandIds),
        islandVersions: {},
        skyRaiderEncounter: { status: "dormant" },
        migrations: ["world:v1->v2", "world:v2->v3", "world:v3->v4"],
      },
      profileId,
    );
  }

  if (value.schemaVersion === 2) {
    const legacy = value as unknown as WorldStateV2;

    return upgradeWorldStateV4(
      {
        schemaVersion: 4,
        seed: persistedSeed(legacy.seed, createSeed),
        generatedIslandIds: stringArray(legacy.generatedIslandIds),
        islandVersions: {},
        activeGeneration: generationJob(legacy.activeGeneration),
        skyRaiderEncounter: { status: "dormant" },
        migrations: [
          ...stringArray(legacy.migrations),
          "world:v2->v3",
          "world:v3->v4",
        ],
      },
      profileId,
    );
  }

  if (value.schemaVersion === 3) {
    const legacy = value as unknown as WorldStateV3;

    return upgradeWorldStateV4(
      {
        schemaVersion: 4,
        seed: persistedSeed(legacy.seed, createSeed),
        generatedIslandIds: stringArray(legacy.generatedIslandIds),
        islandVersions: numberRecord(legacy.islandVersions),
        activeGeneration: generationJob(legacy.activeGeneration),
        skyRaiderEncounter: { status: "dormant" },
        migrations: [...stringArray(legacy.migrations), "world:v3->v4"],
      },
      profileId,
    );
  }

  if (value.schemaVersion === 4) {
    return upgradeWorldStateV4(
      {
        schemaVersion: 4,
        seed: persistedSeed(value.seed, createSeed),
        generatedIslandIds: stringArray(value.generatedIslandIds),
        islandVersions: numberRecord(value.islandVersions),
        activeGeneration: generationJob(value.activeGeneration),
        skyRaiderEncounter: skyRaiderEncounter(value.skyRaiderEncounter),
        migrations: stringArray(value.migrations),
      },
      profileId,
    );
  }

  if (value.schemaVersion !== CURRENT_WORLD_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported Sky Knights world schema: ${String(value.schemaVersion)}`,
    );
  }

  const seed = persistedSeed(value.seed, createSeed);
  // The stored profile wins; an id this build no longer ships falls back to the
  // default without disturbing the realm the world was already generated with.
  const profile = worldProfile(value.worldProfile);
  const storedWorldSeed = value.worldSeed;

  return {
    schemaVersion: CURRENT_WORLD_SCHEMA_VERSION,
    seed,
    worldSeed:
      typeof storedWorldSeed === "number" && Number.isFinite(storedWorldSeed)
        ? storedWorldSeed >>> 0
        : deriveWorldSeed(seed, profile.id),
    worldProfile: profile.id,
    layoutVersion: Math.max(
      0,
      Math.trunc(finiteNumber(value.layoutVersion, profile.layoutVersion)),
    ),
    generatedIslandIds: stringArray(value.generatedIslandIds),
    islandVersions: numberRecord(value.islandVersions),
    islandLayout: islandLayoutRecords(value.islandLayout),
    activeGeneration: generationJob(value.activeGeneration),
    skyRaiderEncounter: skyRaiderEncounter(value.skyRaiderEncounter),
    migrations: stringArray(value.migrations),
  };
}

/** The recorded layout for an island, or `undefined` if none is planned yet. */
export function islandLayoutRecord(
  state: WorldState,
  islandId: string,
): IslandLayoutRecord | undefined {
  return state.islandLayout[islandId];
}

/**
 * Merges planned layout records into the world document. Existing
 * `playerModified` flags survive re-planning; the flag is never cleared here.
 */
export function recordIslandLayout(
  state: WorldState,
  records: readonly IslandLayoutRecord[],
): WorldState {
  if (records.length === 0) {
    return state;
  }

  const merged: Record<string, IslandLayoutRecord> = { ...state.islandLayout };
  let changed = false;

  for (const record of records) {
    const existing: IslandLayoutRecord | undefined = merged[record.id];

    // A persisted origin is the source of truth for a live world. In
    // particular, a planner-version upgrade must not quietly move an island
    // a player has already reached (and potentially edited). New records are
    // still normalized and saved deterministically; existing ones are never
    // rewritten by an automatic plan.
    if (existing !== undefined) {
      continue;
    }

    merged[record.id] = record;
    changed = true;
  }

  if (!changed) {
    return state;
  }

  return {
    ...state,
    islandLayout: sortedLayoutRecords(merged),
  };
}

/**
 * Marks an island as player-modified so no content-version bump can regenerate
 * it (ADR-007). A no-op when the island has no record or is already marked.
 */
export function markIslandPlayerModified(
  state: WorldState,
  islandId: string,
): WorldState {
  const existing: IslandLayoutRecord | undefined = state.islandLayout[islandId];

  if (existing === undefined || existing.playerModified) {
    return state;
  }

  return {
    ...state,
    islandLayout: sortedLayoutRecords({
      ...state.islandLayout,
      [islandId]: { ...existing, playerModified: true },
    }),
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
