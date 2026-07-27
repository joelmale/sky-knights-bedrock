import {
  SKYCRAFT_COMPONENT_IDS,
  SKYCRAFT_IDS,
  SkycraftComponentId,
} from "./config";
import { BlueprintBlock, CertificationId } from "./types";

export const SKYCRAFT_BLOCK_IDS = SKYCRAFT_COMPONENT_IDS;
export type SkycraftBlockId = SkycraftComponentId;
export type ReferenceBlueprintId =
  | "minnow"
  | "dart"
  | "cargo_punt"
  | "cloudwhale"
  | "aether_disc"
  | "frostwing"
  | "surveyor"
  | "grand_cruiser";

export interface ReferenceBlueprint {
  id: ReferenceBlueprintId;
  name: string;
  certification: CertificationId;
  dimensions: { x: number; y: number; z: number };
  blocks: Readonly<Partial<Record<SkycraftBlockId, number>>>;
  structuralBlocks: number;
  massLimit: number;
  seats: number;
  cargoSlots: number;
  utilityHardpoints: number;
}

export interface ReferenceMaterial {
  itemId: string;
  count: number;
}

function blueprint(value: ReferenceBlueprint): ReferenceBlueprint {
  return {
    ...value,
    dimensions: { ...value.dimensions },
    blocks: { ...value.blocks },
  };
}

/**
 * Docked reference ships are editable starting points, not immutable prefabs.
 * The list is declaration-ordered and never derived from object enumeration.
 */
export const REFERENCE_BLUEPRINTS: readonly ReferenceBlueprint[] = [
  blueprint({
    id: "minnow",
    name: "Minnow",
    certification: "apprentice_raft",
    dimensions: { x: 7, y: 5, z: 7 },
    blocks: {
      "skyknights:basic_helm": 1,
      "skyknights:ship_core_block": 1,
      "skyknights:lift_sail": 1,
      "skyknights:coal_thruster": 1,
    },
    structuralBlocks: 12,
    massLimit: 24,
    seats: 1,
    cargoSlots: 0,
    utilityHardpoints: 0,
  }),
  blueprint({
    id: "dart",
    name: "Dart",
    certification: "ember_skiff",
    dimensions: { x: 11, y: 7, z: 9 },
    blocks: {
      "skyknights:reinforced_helm": 1,
      "skyknights:ship_core_block": 1,
      "skyknights:lift_sail": 4,
      "skyknights:aether_thruster": 2,
      "skyknights:braced_frame": 6,
      "skyknights:rudder": 1,
      "skyknights:crew_seat": 3,
    },
    structuralBlocks: 20,
    massLimit: 56,
    seats: 4,
    cargoSlots: 6,
    utilityHardpoints: 1,
  }),
  blueprint({
    id: "cargo_punt",
    name: "Cargo Punt",
    certification: "ember_skiff",
    dimensions: { x: 11, y: 7, z: 9 },
    blocks: {
      "skyknights:reinforced_helm": 1,
      "skyknights:ship_core_block": 1,
      "skyknights:lift_sail": 4,
      "skyknights:aether_thruster": 1,
      "skyknights:braced_frame": 4,
      "skyknights:rudder": 1,
      "skyknights:cargo_rack": 1,
      "skyknights:crew_seat": 2,
    },
    structuralBlocks: 12,
    massLimit: 56,
    seats: 2,
    cargoSlots: 6,
    utilityHardpoints: 1,
  }),
  blueprint({
    id: "cloudwhale",
    name: "Cloudwhale",
    certification: "specialist_airframe",
    dimensions: { x: 15, y: 9, z: 11 },
    blocks: {
      "skyknights:reinforced_helm": 1,
      "skyknights:ship_core_block": 1,
      "skyknights:airbag": 12,
      "skyknights:dirigible_propeller": 2,
      "skyknights:braced_frame": 8,
      "skyknights:stabilizer": 1,
      "skyknights:cargo_rack": 4,
      "skyknights:crew_seat": 5,
    },
    structuralBlocks: 32,
    massLimit: 112,
    seats: 6,
    cargoSlots: 24,
    utilityHardpoints: 2,
  }),
  blueprint({
    id: "aether_disc",
    name: "Aether Disc",
    certification: "specialist_airframe",
    dimensions: { x: 15, y: 9, z: 11 },
    blocks: {
      "skyknights:reinforced_helm": 1,
      "skyknights:ship_core_block": 1,
      "skyknights:aether_lift_cell": 8,
      "skyknights:aether_thruster": 2,
      "skyknights:braced_frame": 6,
      "skyknights:stabilizer": 2,
      "skyknights:crew_seat": 4,
      "skyknights:shield_hardpoint": 1,
    },
    structuralBlocks: 20,
    massLimit: 112,
    seats: 4,
    cargoSlots: 9,
    utilityHardpoints: 2,
  }),
  blueprint({
    id: "frostwing",
    name: "Frostwing",
    certification: "specialist_airframe",
    dimensions: { x: 15, y: 9, z: 11 },
    blocks: {
      "skyknights:reinforced_helm": 1,
      "skyknights:ship_core_block": 1,
      "skyknights:aether_lift_cell": 8,
      "skyknights:frostfire_thruster": 2,
      "skyknights:braced_frame": 6,
      "skyknights:stabilizer": 2,
      "skyknights:crew_seat": 5,
      "skyknights:cannon_hardpoint": 1,
    },
    structuralBlocks: 20,
    massLimit: 144,
    seats: 6,
    cargoSlots: 18,
    utilityHardpoints: 3,
  }),
  blueprint({
    id: "surveyor",
    name: "Surveyor",
    certification: "expedition_skycraft",
    dimensions: { x: 19, y: 11, z: 13 },
    blocks: {
      "skyknights:reinforced_helm": 1,
      "skyknights:ship_core_block": 1,
      "skyknights:airbag": 13,
      "skyknights:dirigible_propeller": 2,
      "skyknights:braced_frame": 16,
      "skyknights:stabilizer": 2,
      "skyknights:cargo_rack": 5,
      "skyknights:repair_station": 1,
      "skyknights:crew_seat": 6,
    },
    structuralBlocks: 58,
    massLimit: 160,
    seats: 6,
    cargoSlots: 27,
    utilityHardpoints: 3,
  }),
  blueprint({
    id: "grand_cruiser",
    name: "Grand Cruiser",
    certification: "masterwork_skycraft",
    dimensions: { x: 23, y: 13, z: 15 },
    blocks: {
      "skyknights:reinforced_helm": 1,
      "skyknights:ship_core_block": 1,
      "skyknights:aether_lift_cell": 11,
      "skyknights:frostfire_thruster": 3,
      "skyknights:braced_frame": 12,
      "skyknights:stabilizer": 3,
      "skyknights:cargo_rack": 4,
      "skyknights:repair_station": 1,
      "skyknights:crew_seat": 7,
      "skyknights:cannon_hardpoint": 1,
      "skyknights:shield_hardpoint": 1,
    },
    structuralBlocks: 30,
    massLimit: 240,
    seats: 8,
    cargoSlots: 24,
    utilityHardpoints: 5,
  }),
] as const;

export function referenceBlueprint(
  id: ReferenceBlueprintId,
): ReferenceBlueprint {
  const found = REFERENCE_BLUEPRINTS.find((candidate) => candidate.id === id);

  if (found === undefined) {
    throw new Error(`Unknown Skycraft reference blueprint: ${id}`);
  }

  return blueprint(found);
}

export function blueprintComponentCount(
  blueprint: Pick<ReferenceBlueprint, "blocks">,
): number {
  return SKYCRAFT_BLOCK_IDS.reduce(
    (total, id) => total + (blueprint.blocks[id] ?? 0),
    0,
  );
}

function layoutPositions(
  dimensions: ReferenceBlueprint["dimensions"],
  count: number,
): Array<{ x: number; y: number; z: number }> {
  const halfX = Math.floor(dimensions.x / 2);
  const halfZ = Math.floor(dimensions.z / 2);
  const positions: Array<{ x: number; y: number; z: number }> = [];

  for (let z = -halfZ; z <= halfZ; z += 1) {
    for (let x = -halfX; x <= halfX; x += 1) {
      positions.push({ x, y: 0, z });
    }
  }

  return positions
    .sort(
      (left, right) =>
        Math.abs(left.x) +
          Math.abs(left.z) -
          (Math.abs(right.x) + Math.abs(right.z)) ||
        left.z - right.z ||
        left.x - right.x,
    )
    .slice(0, count);
}

function statesFor(typeId: string, ordinal: number): BlueprintBlock["states"] {
  if (
    typeId === SKYCRAFT_IDS.basicHelm ||
    typeId === SKYCRAFT_IDS.reinforcedHelm ||
    typeId === SKYCRAFT_IDS.rudder ||
    typeId === SKYCRAFT_IDS.crewSeat ||
    typeId === SKYCRAFT_IDS.cannonHardpoint
  ) {
    return { "minecraft:cardinal_direction": "north" };
  }

  if (
    typeId === SKYCRAFT_IDS.coalThruster ||
    typeId === SKYCRAFT_IDS.dirigiblePropeller ||
    typeId === SKYCRAFT_IDS.aetherThruster ||
    typeId === SKYCRAFT_IDS.frostfireThruster
  ) {
    // North is forward, so south is aft. Alternate extra engines between
    // downward lift and aft propulsion.
    return {
      "minecraft:cardinal_direction": ordinal % 2 === 0 ? "south" : "north",
      "minecraft:facing_direction": ordinal % 2 === 0 ? 3 : 0,
    };
  }

  return {};
}

/**
 * Canonical coordinate fixture used by host/BDS tests and construction
 * orders. It is intentionally a compact connected teaching deck; the authored
 * flight proxy provides the recognizable class silhouette in flight.
 */
export function referenceLayout(
  reference: ReferenceBlueprint,
): readonly BlueprintBlock[] {
  const componentIds: string[] = [];

  for (const id of SKYCRAFT_BLOCK_IDS) {
    const count = reference.blocks[id] ?? 0;
    for (let index = 0; index < count; index += 1) {
      componentIds.push(id);
    }
  }

  const total = componentIds.length + reference.structuralBlocks;
  const positions = layoutPositions(reference.dimensions, total);

  if (positions.length !== total) {
    throw new Error(`${reference.id} does not fit its declared footprint.`);
  }

  let engineOrdinal = 0;
  return positions
    .map((position, index): BlueprintBlock => {
      const typeId = componentIds[index] ?? "minecraft:oak_planks";
      const states = statesFor(typeId, engineOrdinal);
      if (
        typeId === SKYCRAFT_IDS.coalThruster ||
        typeId === SKYCRAFT_IDS.dirigiblePropeller ||
        typeId === SKYCRAFT_IDS.aetherThruster ||
        typeId === SKYCRAFT_IDS.frostfireThruster
      ) {
        engineOrdinal += 1;
      }
      return { ...position, typeId, states };
    })
    .sort(
      (left, right) => left.x - right.x || left.y - right.y || left.z - right.z,
    );
}

export function referenceMaterials(
  reference: ReferenceBlueprint,
): readonly ReferenceMaterial[] {
  const result: ReferenceMaterial[] = [
    { itemId: "minecraft:oak_planks", count: reference.structuralBlocks },
  ];

  for (const id of SKYCRAFT_BLOCK_IDS) {
    const count = reference.blocks[id] ?? 0;
    if (count > 0) {
      result.push({ itemId: id, count });
    }
  }

  return result.sort((left, right) => left.itemId.localeCompare(right.itemId));
}
