import { IDENTIFIERS } from "../config/constants";
import { DockLocation, ShipModuleSlots } from "../persistence/schema";

export function hasExtendedRange(modules: ShipModuleSlots): boolean {
  return modules.engine === IDENTIFIERS.aetherEngine;
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
  return (
    modules.hull === IDENTIFIERS.reinforcedHull &&
    modules.engine === IDENTIFIERS.aetherEngine &&
    modules.cargo === IDENTIFIERS.cargoHold &&
    modules.utility === IDENTIFIERS.navigatorModule
  );
}
