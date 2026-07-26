import { DockLocation, ShipModuleSlots } from "../persistence/schema";
import { hasExtendedRangeModule, shipModuleDefinition } from "./ship-modules";

export function hasExtendedRange(modules: ShipModuleSlots): boolean {
  return hasExtendedRangeModule(modules);
}

export function horizontalDistanceSquared(
  left: Pick<DockLocation, "x" | "z">,
  right: Pick<DockLocation, "x" | "z">,
): number {
  const dx = left.x - right.x;
  const dz = left.z - right.z;
  return dx * dx + dz * dz;
}

export function isCompleteSkycutterLoadout(modules: ShipModuleSlots): boolean {
  return (["hull", "engine", "cargo", "utility"] as const).every(
    (slot) => shipModuleDefinition(modules[slot])?.slot === slot,
  );
}
