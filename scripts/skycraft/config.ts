import {
  Certification,
  CertificationId,
  ComponentKind,
  Direction,
} from "./types";

export const SKYCRAFT_CERTIFICATIONS: Readonly<
  Record<Certification["id"], Certification>
> = {
  apprentice_raft: {
    id: "apprentice_raft",
    berthSize: { x: 7, y: 5, z: 7 },
    blockCap: 24,
    massCapSubunits: 64,
    engineCap: 1,
    seatCap: 2,
    hardpointCap: 0,
    provisional: true,
  },
  ember_skiff: {
    id: "ember_skiff",
    berthSize: { x: 11, y: 7, z: 9 },
    blockCap: 56,
    massCapSubunits: 144,
    engineCap: 2,
    seatCap: 4,
    hardpointCap: 2,
    provisional: true,
  },
  specialist_airframe: {
    id: "specialist_airframe",
    berthSize: { x: 15, y: 9, z: 11 },
    blockCap: 96,
    massCapSubunits: 288,
    engineCap: 3,
    seatCap: 6,
    hardpointCap: 3,
    provisional: true,
  },
  expedition_skycraft: {
    id: "expedition_skycraft",
    berthSize: { x: 19, y: 11, z: 13 },
    blockCap: 160,
    massCapSubunits: 560,
    engineCap: 4,
    seatCap: 8,
    hardpointCap: 4,
    provisional: true,
  },
  masterwork_skycraft: {
    id: "masterwork_skycraft",
    berthSize: { x: 23, y: 13, z: 15 },
    blockCap: 240,
    massCapSubunits: 960,
    engineCap: 4,
    seatCap: 8,
    hardpointCap: 5,
    provisional: true,
  },
};

/**
 * Canonical IDs for the placed Skycraft component family. These are additive
 * IDs; the shipped item IDs in config/constants.ts remain untouched.
 */
export const SKYCRAFT_IDS = {
  basicHelm: "skyknights:basic_helm",
  reinforcedHelm: "skyknights:reinforced_helm",
  core: "skyknights:ship_core_block",
  liftSail: "skyknights:lift_sail",
  coalThruster: "skyknights:coal_thruster",
  bracedFrame: "skyknights:braced_frame",
  rudder: "skyknights:rudder",
  airbag: "skyknights:airbag",
  dirigiblePropeller: "skyknights:dirigible_propeller",
  aetherLiftCell: "skyknights:aether_lift_cell",
  aetherThruster: "skyknights:aether_thruster",
  frostfireThruster: "skyknights:frostfire_thruster",
  stabilizer: "skyknights:stabilizer",
  cargoRack: "skyknights:cargo_rack",
  crewSeat: "skyknights:crew_seat",
  repairStation: "skyknights:repair_station",
  cannonHardpoint: "skyknights:cannon_hardpoint",
  shieldHardpoint: "skyknights:shield_hardpoint",
  flightEntity: "skyknights:airship_flight",
} as const;

export type SkycraftComponentId = (typeof SKYCRAFT_IDS)[keyof Omit<
  typeof SKYCRAFT_IDS,
  "flightEntity"
>];

export const SKYCRAFT_COMPONENT_IDS: readonly SkycraftComponentId[] = [
  SKYCRAFT_IDS.basicHelm,
  SKYCRAFT_IDS.reinforcedHelm,
  SKYCRAFT_IDS.core,
  SKYCRAFT_IDS.liftSail,
  SKYCRAFT_IDS.coalThruster,
  SKYCRAFT_IDS.bracedFrame,
  SKYCRAFT_IDS.rudder,
  SKYCRAFT_IDS.airbag,
  SKYCRAFT_IDS.dirigiblePropeller,
  SKYCRAFT_IDS.aetherLiftCell,
  SKYCRAFT_IDS.aetherThruster,
  SKYCRAFT_IDS.frostfireThruster,
  SKYCRAFT_IDS.stabilizer,
  SKYCRAFT_IDS.cargoRack,
  SKYCRAFT_IDS.crewSeat,
  SKYCRAFT_IDS.repairStation,
  SKYCRAFT_IDS.cannonHardpoint,
  SKYCRAFT_IDS.shieldHardpoint,
];

export const SKYCRAFT_HELM_IDS: ReadonlySet<string> = new Set([
  SKYCRAFT_IDS.basicHelm,
  SKYCRAFT_IDS.reinforcedHelm,
]);

export interface SkycraftComponentSpec {
  kind: ComponentKind;
  massSubunits: number;
  passiveLiftSubunits?: number;
  liftSubunits?: number;
  thrust?: number;
  braking?: number;
  control?: number;
  hull?: number;
  cargoReserveSubunits?: number;
  cargoSlots?: number;
}

export const SKYCRAFT_COMPONENTS: Readonly<
  Record<SkycraftComponentId, SkycraftComponentSpec>
> = {
  [SKYCRAFT_IDS.basicHelm]: { kind: "helm", massSubunits: 4, control: 4 },
  [SKYCRAFT_IDS.reinforcedHelm]: {
    kind: "helm",
    massSubunits: 6,
    control: 6,
  },
  [SKYCRAFT_IDS.core]: { kind: "core", massSubunits: 6, hull: 12 },
  [SKYCRAFT_IDS.liftSail]: {
    kind: "lift",
    massSubunits: 4,
    liftSubunits: 40,
  },
  [SKYCRAFT_IDS.coalThruster]: {
    kind: "engine",
    massSubunits: 10,
    passiveLiftSubunits: 48,
    liftSubunits: 20,
    thrust: 16,
    braking: 12,
    control: 8,
  },
  [SKYCRAFT_IDS.bracedFrame]: {
    kind: "armor",
    massSubunits: 3,
    hull: 8,
  },
  [SKYCRAFT_IDS.rudder]: {
    kind: "control",
    massSubunits: 3,
    control: 8,
  },
  [SKYCRAFT_IDS.airbag]: {
    kind: "lift",
    massSubunits: 4,
    liftSubunits: 34,
  },
  [SKYCRAFT_IDS.dirigiblePropeller]: {
    kind: "engine",
    massSubunits: 8,
    thrust: 18,
    braking: 8,
    control: 4,
  },
  [SKYCRAFT_IDS.aetherLiftCell]: {
    kind: "lift",
    massSubunits: 12,
    liftSubunits: 48,
  },
  [SKYCRAFT_IDS.aetherThruster]: {
    kind: "engine",
    massSubunits: 14,
    liftSubunits: 16,
    thrust: 24,
    braking: 18,
    control: 10,
  },
  [SKYCRAFT_IDS.frostfireThruster]: {
    kind: "engine",
    massSubunits: 18,
    liftSubunits: 18,
    thrust: 32,
    braking: 22,
    control: 12,
  },
  [SKYCRAFT_IDS.stabilizer]: {
    kind: "control",
    massSubunits: 5,
    control: 12,
  },
  [SKYCRAFT_IDS.cargoRack]: {
    kind: "cargo",
    massSubunits: 4,
    cargoReserveSubunits: 12,
    cargoSlots: 6,
  },
  [SKYCRAFT_IDS.crewSeat]: { kind: "seat", massSubunits: 2 },
  [SKYCRAFT_IDS.repairStation]: {
    kind: "repair",
    massSubunits: 7,
  },
  [SKYCRAFT_IDS.cannonHardpoint]: {
    kind: "hardpoint",
    massSubunits: 8,
  },
  [SKYCRAFT_IDS.shieldHardpoint]: {
    kind: "hardpoint",
    massSubunits: 10,
  },
};

export const SKYCRAFT_LIMITS = {
  blueprintByteCap: 16_384,
  componentCap: 64,
  activeCraftCap: 4,
  personalBlueprintCap: 12,
} as const;

const CERTIFICATION_RANK: Readonly<Record<CertificationId, number>> = {
  apprentice_raft: 0,
  ember_skiff: 1,
  specialist_airframe: 2,
  expedition_skycraft: 3,
  masterwork_skycraft: 4,
};

const COMPONENT_MINIMUM_CERTIFICATION: Readonly<
  Partial<Record<SkycraftComponentId, CertificationId>>
> = {
  [SKYCRAFT_IDS.reinforcedHelm]: "ember_skiff",
  [SKYCRAFT_IDS.bracedFrame]: "ember_skiff",
  [SKYCRAFT_IDS.rudder]: "ember_skiff",
  [SKYCRAFT_IDS.aetherThruster]: "ember_skiff",
  [SKYCRAFT_IDS.cargoRack]: "ember_skiff",
  [SKYCRAFT_IDS.airbag]: "specialist_airframe",
  [SKYCRAFT_IDS.dirigiblePropeller]: "specialist_airframe",
  [SKYCRAFT_IDS.aetherLiftCell]: "specialist_airframe",
  [SKYCRAFT_IDS.frostfireThruster]: "specialist_airframe",
  [SKYCRAFT_IDS.stabilizer]: "specialist_airframe",
  [SKYCRAFT_IDS.cannonHardpoint]: "specialist_airframe",
  [SKYCRAFT_IDS.shieldHardpoint]: "specialist_airframe",
  [SKYCRAFT_IDS.repairStation]: "expedition_skycraft",
};

export function componentAvailableAtCertification(
  typeId: string,
  certificationId: CertificationId,
): boolean {
  const minimum =
    COMPONENT_MINIMUM_CERTIFICATION[typeId as SkycraftComponentId] ??
    "apprentice_raft";
  return CERTIFICATION_RANK[certificationId] >= CERTIFICATION_RANK[minimum];
}

const WOOD_FAMILIES = [
  "oak",
  "spruce",
  "birch",
  "jungle",
  "acacia",
  "dark_oak",
  "mangrove",
  "cherry",
  "pale_oak",
] as const;
const WOOD_BLOCKS: string[] = [];

for (const family of WOOD_FAMILIES) {
  WOOD_BLOCKS.push(
    `minecraft:${family}_log`,
    `minecraft:stripped_${family}_log`,
    `minecraft:${family}_wood`,
    `minecraft:stripped_${family}_wood`,
    `minecraft:${family}_planks`,
    `minecraft:${family}_slab`,
    `minecraft:${family}_stairs`,
    `minecraft:${family}_fence`,
    `minecraft:${family}_fence_gate`,
    `minecraft:${family}_trapdoor`,
  );
}

export const ALLOWED_SKYCRAFT_BLOCKS: ReadonlySet<string> = new Set([
  ...WOOD_BLOCKS,
  "minecraft:white_wool",
  ...SKYCRAFT_COMPONENT_IDS,
]);

export const FORBIDDEN_BLOCKS: ReadonlySet<string> = new Set([
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:lava",
  "minecraft:flowing_lava",
  "minecraft:fire",
  "minecraft:soul_fire",
  "minecraft:tnt",
  "minecraft:chest",
  "minecraft:barrel",
  "minecraft:bed",
  "minecraft:portal",
  "minecraft:end_portal",
  "minecraft:sand",
  "minecraft:gravel",
]);

export const DIRECTION_VECTORS: Readonly<
  Record<Direction, { x: number; y: number; z: number }>
> = {
  north: { x: 0, y: 0, z: -1 },
  south: { x: 0, y: 0, z: 1 },
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  up: { x: 0, y: 1, z: 0 },
  down: { x: 0, y: -1, z: 0 },
};

export function blockMassSubunits(typeId: string): number {
  const component = SKYCRAFT_COMPONENTS[typeId as SkycraftComponentId];

  if (component !== undefined) {
    return component.massSubunits;
  }

  if (typeId.endsWith("_slab") || typeId.endsWith("_stairs")) {
    return 1;
  }

  if (
    typeId.endsWith("_fence") ||
    typeId.endsWith("_fence_gate") ||
    typeId.endsWith("_trapdoor") ||
    typeId === "minecraft:white_wool"
  ) {
    return 1;
  }

  if (typeId.endsWith("_planks")) {
    return 2;
  }

  if (typeId.endsWith("_log") || typeId.endsWith("_wood")) {
    return 3;
  }

  return 0;
}
