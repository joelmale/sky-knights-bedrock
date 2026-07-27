import {
  ALLOWED_SKYCRAFT_BLOCKS,
  FORBIDDEN_BLOCKS,
  SKYCRAFT_COMPONENTS,
  SKYCRAFT_HELM_IDS,
  SKYCRAFT_IDS,
  SKYCRAFT_LIMITS,
  SkycraftComponentId,
} from "./config";
import { blueprintByteSize, emptyBlueprint } from "./blueprint";
import {
  BlockPosition,
  BlueprintBlock,
  BlueprintComponent,
  DockBerth,
  Direction,
  RelativeBlock,
  ScanDiagnostic,
  ScanResult,
} from "./types";

export interface ScanBlock {
  typeId: string;
  states?: Readonly<Record<string, string | number | boolean>>;
}
export interface BlockReader {
  getBlock(position: BlockPosition): ScanBlock | undefined;
}
function key(position: BlockPosition): string {
  return `${position.x},${position.y},${position.z}`;
}
function comparePosition(left: BlockPosition, right: BlockPosition): number {
  return left.x - right.x || left.y - right.y || left.z - right.z;
}
function inBerth(position: BlockPosition, berth: DockBerth): boolean {
  return (
    position.x >= berth.origin.x &&
    position.y >= berth.origin.y &&
    position.z >= berth.origin.z &&
    position.x < berth.origin.x + berth.size.x &&
    position.y < berth.origin.y + berth.size.y &&
    position.z < berth.origin.z + berth.size.z
  );
}
function relative(
  position: BlockPosition,
  helm: BlockPosition,
  block: ScanBlock,
): BlueprintBlock {
  return {
    x: position.x - helm.x,
    y: position.y - helm.y,
    z: position.z - helm.z,
    typeId: block.typeId,
    states: block.states ?? {},
  };
}
function componentKind(typeId: string): BlueprintComponent["kind"] | undefined {
  return SKYCRAFT_COMPONENTS[typeId as SkycraftComponentId]?.kind;
}

/**
 * Bedrock exposes `minecraft:facing_direction` as 0..5, while authored
 * cardinal placement traits expose string values. Accept both representations
 * so host tests exercise the same normalization as a live block permutation.
 */
export function normalizedFacing(
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

function isEmptyBlock(block: ScanBlock): boolean {
  return (
    block.typeId === "minecraft:air" ||
    block.typeId === "minecraft:cave_air" ||
    block.typeId === "minecraft:void_air"
  );
}
const NEIGHBORS: readonly BlockPosition[] = [
  { x: -1, y: 0, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: -1 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 1, z: 0 },
  { x: 1, y: 0, z: 0 },
];

export function scanAirship(
  reader: BlockReader,
  berth: DockBerth,
  helmPosition: BlockPosition,
  airshipId = "scan",
  blockCap = Number.MAX_SAFE_INTEGER,
): ScanResult {
  const diagnostics: ScanDiagnostic[] = [];
  const helmBlock = reader.getBlock(helmPosition);
  if (
    !inBerth(helmPosition, berth) ||
    helmBlock === undefined ||
    !SKYCRAFT_HELM_IDS.has(helmBlock.typeId)
  )
    return {
      blocks: [],
      components: [],
      diagnostics: [
        {
          code: "missing_helm",
          message: "Exactly one Helm must be the scan origin.",
        },
      ],
      byteSize: 0,
    };
  const visited = new Set<string>();
  const queue: BlockPosition[] = [helmPosition];
  const blocks: BlueprintBlock[] = [];
  const components: BlueprintComponent[] = [];
  let cursor = 0;
  while (cursor < queue.length) {
    const position = queue[cursor++];
    const positionKey = key(position);
    if (visited.has(positionKey) || !inBerth(position, berth)) continue;
    visited.add(positionKey);
    const block = reader.getBlock(position);
    if (block === undefined || isEmptyBlock(block)) continue;
    if (FORBIDDEN_BLOCKS.has(block.typeId)) {
      diagnostics.push({
        code: "forbidden_block",
        message: `Forbidden block ${block.typeId}.`,
        position,
      });
      continue;
    }
    if (!ALLOWED_SKYCRAFT_BLOCKS.has(block.typeId)) {
      diagnostics.push({
        code: "unsupported_block",
        message: `Unsupported block ${block.typeId}.`,
        position,
      });
      continue;
    }
    const entry = relative(position, helmPosition, block);
    blocks.push(entry);
    const kind = componentKind(block.typeId);
    if (kind !== undefined)
      components.push({
        ...entry,
        kind,
        facing: normalizedFacing(entry.states),
      });
    for (const delta of NEIGHBORS)
      queue.push({
        x: position.x + delta.x,
        y: position.y + delta.y,
        z: position.z + delta.z,
      });
  }
  let berthHelms = 0;
  let berthCores = 0;
  for (let x = berth.origin.x; x < berth.origin.x + berth.size.x; x += 1) {
    for (let y = berth.origin.y; y < berth.origin.y + berth.size.y; y += 1) {
      for (let z = berth.origin.z; z < berth.origin.z + berth.size.z; z += 1) {
        const position = { x, y, z };
        const block = reader.getBlock(position);
        if (block !== undefined && SKYCRAFT_HELM_IDS.has(block.typeId))
          berthHelms += 1;
        if (block?.typeId === SKYCRAFT_IDS.core) berthCores += 1;
        if (
          block !== undefined &&
          ALLOWED_SKYCRAFT_BLOCKS.has(block.typeId) &&
          !visited.has(key(position))
        )
          diagnostics.push({
            code: "disconnected_block",
            message: "Approved block is disconnected from the Helm.",
            position,
          });
      }
    }
  }
  blocks.sort(comparePosition);
  components.sort(
    (a, b) => comparePosition(a, b) || a.kind.localeCompare(b.kind),
  );
  const count = (typeId: string) =>
    blocks.filter((block) => block.typeId === typeId).length;
  if (
    berthHelms !== 1 ||
    blocks.filter((block) => SKYCRAFT_HELM_IDS.has(block.typeId)).length !== 1
  )
    diagnostics.push({
      code: "duplicate_helm",
      message:
        "Exactly one Helm is required in the berth and connected to the design.",
    });
  if (berthCores !== 1 || count(SKYCRAFT_IDS.core) !== 1)
    diagnostics.push({
      code: "missing_or_duplicate_core",
      message:
        "Exactly one Ship Core is required in the berth and connected to the design.",
    });
  if (blocks.length > blockCap)
    diagnostics.push({
      code: "block_cap",
      message: `Block count ${blocks.length} exceeds the certified cap ${blockCap}.`,
    });
  if (components.length > SKYCRAFT_LIMITS.componentCap)
    diagnostics.push({
      code: "component_cap",
      message: "Too many functional components.",
    });
  const helm: RelativeBlock = {
    x: 0,
    y: 0,
    z: 0,
    typeId: helmBlock.typeId,
    states: helmBlock.states ?? {},
  };
  const byteSize = blueprintByteSize({
    ...emptyBlueprint(airshipId, berth, helm),
    blocks,
    components,
  });
  if (byteSize > SKYCRAFT_LIMITS.blueprintByteCap)
    diagnostics.push({
      code: "blueprint_bytes",
      message: "Blueprint exceeds the measured persistence cap.",
    });
  return { blocks, components, helm, diagnostics, byteSize };
}
