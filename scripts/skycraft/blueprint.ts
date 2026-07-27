import {
  SKYCRAFT_COMPONENTS,
  SKYCRAFT_HELM_IDS,
  SKYCRAFT_IDS,
  SkycraftComponentId,
} from "./config";
import {
  AirshipBlueprint,
  BlueprintBlock,
  BlueprintComponent,
  ComponentKind,
  Direction,
  DockBerth,
  RelativeBlock,
  SKYCRAFT_BLUEPRINT_SCHEMA_VERSION,
} from "./types";

const COMPONENT_KINDS: ReadonlySet<ComponentKind> = new Set([
  "helm",
  "core",
  "engine",
  "lift",
  "seat",
  "cargo",
  "hardpoint",
  "control",
  "armor",
  "repair",
]);
const DIRECTIONS: ReadonlySet<Direction> = new Set([
  "north",
  "south",
  "east",
  "west",
  "up",
  "down",
]);

function comparePosition(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
): number {
  return left.x - right.x || left.y - right.y || left.z - right.z;
}

function canonicalStates(
  states: Readonly<Record<string, string | number | boolean>>,
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};

  for (const key of Object.keys(states).sort()) {
    result[key] = states[key];
  }

  return result;
}

function canonicalBlock<T extends RelativeBlock>(block: T): T {
  return { ...block, states: canonicalStates(block.states) };
}

export function canonicalBlueprint(
  blueprint: AirshipBlueprint,
): AirshipBlueprint {
  return {
    ...blueprint,
    berth: {
      ...blueprint.berth,
      origin: { ...blueprint.berth.origin },
      size: { ...blueprint.berth.size },
    },
    helm: canonicalBlock(blueprint.helm),
    blocks: [...blueprint.blocks].map(canonicalBlock).sort(comparePosition),
    components: [...blueprint.components]
      .map(canonicalBlock)
      .sort(
        (left, right) =>
          comparePosition(left, right) || left.kind.localeCompare(right.kind),
      ),
  };
}

export function canonicalBlueprintJson(blueprint: AirshipBlueprint): string {
  return JSON.stringify(canonicalBlueprint(blueprint));
}

/**
 * Blueprint identifiers and approved states are ASCII by contract, so string
 * length is also its UTF-8 storage length. Names live outside this document.
 */
export function blueprintByteSize(blueprint: AirshipBlueprint): number {
  return canonicalBlueprintJson(blueprint).length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value)
  );
}

function validPosition(value: unknown): boolean {
  return (
    isRecord(value) &&
    finiteInteger(value.x) &&
    finiteInteger(value.y) &&
    finiteInteger(value.z)
  );
}

function validStates(
  value: unknown,
): value is Record<string, string | number | boolean> {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) => {
      const state = value[key];
      return (
        key.length > 0 &&
        (typeof state === "string" ||
          typeof state === "number" ||
          typeof state === "boolean") &&
        (typeof state !== "number" || Number.isFinite(state))
      );
    })
  );
}

function validBlock(value: unknown): value is BlueprintBlock {
  return (
    validPosition(value) &&
    isRecord(value) &&
    typeof value.typeId === "string" &&
    value.typeId.length > 0 &&
    validStates(value.states)
  );
}

function validComponent(value: unknown): value is BlueprintComponent {
  if (!validBlock(value) || !isRecord(value)) {
    return false;
  }

  const kind = value.kind;
  const facing = value.facing;
  const spec = SKYCRAFT_COMPONENTS[value.typeId as SkycraftComponentId];

  return (
    typeof kind === "string" &&
    COMPONENT_KINDS.has(kind as ComponentKind) &&
    spec?.kind === kind &&
    (facing === undefined ||
      (typeof facing === "string" && DIRECTIONS.has(facing as Direction)))
  );
}

function validBerth(value: unknown): value is DockBerth {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.dimensionId !== "string" ||
    !validPosition(value.origin) ||
    !validPosition(value.size) ||
    typeof value.orientation !== "string" ||
    !DIRECTIONS.has(value.orientation as Direction)
  ) {
    return false;
  }

  const size = value.size as unknown as { x: number; y: number; z: number };
  return (
    size.x > 0 &&
    size.y > 0 &&
    size.z > 0 &&
    size.x <= 23 &&
    size.y <= 13 &&
    size.z <= 15
  );
}

function positionKey(position: { x: number; y: number; z: number }): string {
  return `${position.x},${position.y},${position.z}`;
}

function statesEqual(
  left: Readonly<Record<string, string | number | boolean>>,
  right: Readonly<Record<string, string | number | boolean>>,
): boolean {
  return (
    JSON.stringify(canonicalStates(left)) ===
    JSON.stringify(canonicalStates(right))
  );
}

function facingFromStates(
  states: Readonly<Record<string, string | number | boolean>>,
): Direction | undefined {
  const value =
    states["minecraft:facing_direction"] ??
    states.facing_direction ??
    states["minecraft:cardinal_direction"] ??
    states.cardinal_direction;
  if (
    value === "north" ||
    value === "south" ||
    value === "east" ||
    value === "west" ||
    value === "up" ||
    value === "down"
  ) {
    return value;
  }
  return value === 0
    ? "down"
    : value === 1
      ? "up"
      : value === 2
        ? "north"
        : value === 3
          ? "south"
          : value === 4
            ? "west"
            : value === 5
              ? "east"
              : undefined;
}

export function parseBlueprintV1(value: unknown): AirshipBlueprint | undefined {
  if (
    !isRecord(value) ||
    value.schemaVersion !== SKYCRAFT_BLUEPRINT_SCHEMA_VERSION ||
    typeof value.airshipId !== "string" ||
    value.airshipId.length === 0 ||
    !finiteInteger(value.revision) ||
    value.revision < 1 ||
    !validBerth(value.berth) ||
    !validBlock(value.helm) ||
    !Array.isArray(value.blocks) ||
    !Array.isArray(value.components) ||
    !value.blocks.every(validBlock) ||
    !value.components.every(validComponent) ||
    !finiteInteger(value.engineeringVersion) ||
    value.engineeringVersion < 1
  ) {
    return undefined;
  }

  const blueprint = canonicalBlueprint(value as unknown as AirshipBlueprint);
  const blockKeys = blueprint.blocks.map(positionKey);

  if (
    new Set(blockKeys).size !== blockKeys.length ||
    blueprint.blocks.some(
      (block) =>
        Math.abs(block.x) >= blueprint.berth.size.x ||
        Math.abs(block.y) >= blueprint.berth.size.y ||
        Math.abs(block.z) >= blueprint.berth.size.z,
    )
  ) {
    return undefined;
  }

  if (
    blueprint.helm.x !== 0 ||
    blueprint.helm.y !== 0 ||
    blueprint.helm.z !== 0 ||
    !SKYCRAFT_HELM_IDS.has(blueprint.helm.typeId)
  ) {
    return undefined;
  }

  const helmBlock = blueprint.blocks.find(
    (block) => block.x === 0 && block.y === 0 && block.z === 0,
  );
  if (
    helmBlock === undefined ||
    helmBlock.typeId !== blueprint.helm.typeId ||
    !statesEqual(helmBlock.states, blueprint.helm.states)
  ) {
    return undefined;
  }

  const helmCount = blueprint.blocks.filter((block) =>
    SKYCRAFT_HELM_IDS.has(block.typeId),
  ).length;
  const coreCount = blueprint.blocks.filter(
    (block) => block.typeId === SKYCRAFT_IDS.core,
  ).length;

  if (helmCount !== 1 || coreCount !== 1) {
    return undefined;
  }

  const expectedComponents = blueprint.blocks.filter(
    (block) =>
      SKYCRAFT_COMPONENTS[block.typeId as SkycraftComponentId] !== undefined,
  );
  if (
    blueprint.components.length !== expectedComponents.length ||
    new Set(blueprint.components.map(positionKey)).size !==
      blueprint.components.length
  ) {
    return undefined;
  }

  for (const component of blueprint.components) {
    const block = blueprint.blocks.find(
      (candidate) => positionKey(candidate) === positionKey(component),
    );

    if (
      block === undefined ||
      block.typeId !== component.typeId ||
      !statesEqual(block.states, component.states) ||
      component.kind !==
        SKYCRAFT_COMPONENTS[block.typeId as SkycraftComponentId]?.kind ||
      component.facing !== facingFromStates(block.states)
    ) {
      return undefined;
    }
  }

  return blueprint;
}

export function migrateBlueprint(value: unknown): AirshipBlueprint | undefined {
  return parseBlueprintV1(value);
}

export function emptyBlueprint(
  airshipId: string,
  berth: DockBerth,
  helm: RelativeBlock,
): AirshipBlueprint {
  return {
    schemaVersion: 1,
    airshipId,
    revision: 1,
    berth,
    helm,
    blocks: [helm],
    components: [],
    engineeringVersion: 1,
  };
}
