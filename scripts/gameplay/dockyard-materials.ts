export interface MaterialRequirement {
  itemId: string;
  count: number;
}

export interface InventoryStack {
  typeId: string;
  amount: number;
}

export interface MaterialConsumption {
  slot: number;
  itemId: string;
  count: number;
}

export function countMaterials(
  stacks: readonly (InventoryStack | undefined)[],
  requirements: readonly MaterialRequirement[],
): Record<string, number> {
  const requiredIds = new Set(
    requirements.map((requirement) => requirement.itemId),
  );
  const counts: Record<string, number> = {};

  for (const stack of stacks) {
    if (stack !== undefined && requiredIds.has(stack.typeId)) {
      counts[stack.typeId] = (counts[stack.typeId] ?? 0) + stack.amount;
    }
  }

  return counts;
}

export function planMaterialConsumption(
  stacks: readonly (InventoryStack | undefined)[],
  requirements: readonly MaterialRequirement[],
): MaterialConsumption[] | undefined {
  const remaining = requirements.map((requirement) => ({ ...requirement }));
  const plan: MaterialConsumption[] = [];

  for (let slot = 0; slot < stacks.length; slot += 1) {
    const stack = stacks[slot];

    if (stack === undefined) {
      continue;
    }

    const requirement = remaining.find(
      (candidate) => candidate.itemId === stack.typeId && candidate.count > 0,
    );

    if (requirement === undefined) {
      continue;
    }

    const count = Math.min(requirement.count, stack.amount);
    requirement.count -= count;
    plan.push({ slot, itemId: stack.typeId, count });
  }

  return remaining.every((requirement) => requirement.count === 0)
    ? plan
    : undefined;
}

export function shouldEnsureDockmaster(
  islandRecorded: boolean,
  dockSupportTypeId: string | undefined,
): boolean {
  return islandRecorded || dockSupportTypeId === "minecraft:oak_planks";
}
