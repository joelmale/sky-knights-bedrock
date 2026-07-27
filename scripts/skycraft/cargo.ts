export type CargoRole = "owner" | "pilot" | "crew" | "guest";
export type CargoPermission = "none" | "load" | "manage";

export interface CargoStack {
  itemId: string;
  count: number;
  unitMassSubunits: number;
}

export interface CargoManifest {
  authority: "owner_only" | "crew_load" | "shared";
  capacitySlots: number;
  stacks: readonly CargoStack[];
  reservedMassSubunits: number;
}

export interface CargoLoadReport {
  cargoMassSubunits: number;
  reservedMassSubunits: number;
  totalMassSubunits: number;
  occupiedSlots: number;
  withinCapacity: boolean;
}

export function cargoPermission(
  authority: CargoManifest["authority"],
  role: CargoRole,
): CargoPermission {
  if (role === "owner") {
    return "manage";
  }

  if (authority === "shared" && role !== "guest") {
    return "manage";
  }

  if (authority === "crew_load" && (role === "pilot" || role === "crew")) {
    return "load";
  }

  return "none";
}

export function canonicalCargoStacks(
  stacks: readonly CargoStack[],
): readonly CargoStack[] {
  return stacks
    .filter(
      (stack) =>
        stack.itemId.length > 0 &&
        Number.isInteger(stack.count) &&
        stack.count > 0 &&
        Number.isInteger(stack.unitMassSubunits) &&
        stack.unitMassSubunits >= 0,
    )
    .map((stack) => ({ ...stack }))
    .sort(
      (left, right) =>
        left.itemId.localeCompare(right.itemId) ||
        left.unitMassSubunits - right.unitMassSubunits ||
        left.count - right.count,
    );
}

export function cargoLoad(manifest: CargoManifest): CargoLoadReport {
  const stacks = canonicalCargoStacks(manifest.stacks);
  const cargoMassSubunits = stacks.reduce(
    (total, stack) => total + stack.count * stack.unitMassSubunits,
    0,
  );
  const reservedMassSubunits = Math.max(
    0,
    Math.trunc(manifest.reservedMassSubunits),
  );
  const capacitySlots = Math.max(0, Math.trunc(manifest.capacitySlots));

  return {
    cargoMassSubunits,
    reservedMassSubunits,
    totalMassSubunits: cargoMassSubunits + reservedMassSubunits,
    occupiedSlots: stacks.length,
    withinCapacity: stacks.length <= capacitySlots,
  };
}

export function canLoadCargo(
  manifest: CargoManifest,
  role: CargoRole,
  incoming: CargoStack,
): boolean {
  const permission = cargoPermission(manifest.authority, role);
  const normalized = canonicalCargoStacks([incoming]);

  if (permission === "none" || normalized.length !== 1) {
    return false;
  }

  const existing = canonicalCargoStacks(manifest.stacks);
  const sameStack = existing.some(
    (stack) =>
      stack.itemId === normalized[0].itemId &&
      stack.unitMassSubunits === normalized[0].unitMassSubunits,
  );
  return sameStack || existing.length < Math.max(0, manifest.capacitySlots);
}

export function availableFlightMass(
  liftSubunits: number,
  airframeMassSubunits: number,
  manifest: CargoManifest,
): number {
  return Math.max(
    0,
    Math.trunc(liftSubunits) -
      Math.max(0, Math.trunc(airframeMassSubunits)) -
      cargoLoad(manifest).totalMassSubunits,
  );
}
