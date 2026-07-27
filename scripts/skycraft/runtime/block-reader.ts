import { BlockReader, ScanBlock } from "../scanner";
import { BlockPosition } from "../types";

export interface RuntimeBlock {
  typeId: string;
  states: Readonly<Record<string, string | number | boolean>>;
}
export interface RuntimeDimension {
  getBlock(position: BlockPosition): RuntimeBlock | undefined;
}
const APPROVED_STATES = [
  "minecraft:facing_direction",
  "minecraft:cardinal_direction",
  "facing_direction",
  "cardinal_direction",
  "pillar_axis",
  "weirdo_direction",
  "upside_down_bit",
  "vertical_half",
  "direction",
  "open_bit",
  "in_wall_bit",
] as const;
export function approvedStates(
  states: Readonly<Record<string, string | number | boolean>>,
): Readonly<Record<string, string | number | boolean>> {
  const result: Record<string, string | number | boolean> = {};
  for (const key of APPROVED_STATES)
    if (states[key] !== undefined) result[key] = states[key];
  return result;
}
export function createRuntimeBlockReader(
  dimension: RuntimeDimension,
): BlockReader {
  return {
    getBlock(position: BlockPosition): ScanBlock | undefined {
      const block = dimension.getBlock(position);

      if (
        block === undefined ||
        block.typeId === "minecraft:air" ||
        block.typeId === "minecraft:cave_air" ||
        block.typeId === "minecraft:void_air"
      ) {
        return undefined;
      }

      return { typeId: block.typeId, states: approvedStates(block.states) };
    },
  };
}
