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

export const DOCK_DECK_BLOCK = "minecraft:oak_planks";

export type DockmasterMood = "steward" | "wrathful";

/**
 * What the dock sweep should do this pass.
 *
 * - `station` — normal upkeep: the deck is intact, so station or recentre the
 *   steward.
 * - `restore_deck` — the deck under the anchor is gone but the player has not
 *   reached their first ship. Rebuild the plank instead of punishing them.
 * - `provoke` — the deck is gone and the player already has a ship, so the
 *   destruction was deliberate. Transform the steward.
 * - `leave_wrathful` — already transformed; never restore the steward.
 * - `wait` — the dock chunk is not loaded, so nothing can be concluded.
 */
export type DockDeckOutcome =
  "station" | "restore_deck" | "provoke" | "leave_wrathful" | "wait";

/**
 * Resolves the dock sweep outcome.
 *
 * Pure so the whole decision table is unit-testable without an engine. The
 * defect this replaces was an indefinite loop: the Dockmaster has gravity and
 * a damage sensor that blocks every source including the void, so once its
 * deck was broken it fell forever while the sweep teleported it back every ten
 * seconds.
 *
 * The first-ship gate exists because the Dockmaster is the recovery anchor for
 * the entire progression. A new player who breaks the deck by accident must
 * get their dock back, not a boss they cannot beat and cannot escape.
 */
export function resolveDockDeck({
  islandRecorded,
  dockSupportTypeId,
  firstShipBuilt,
  mood,
}: {
  islandRecorded: boolean;
  dockSupportTypeId: string | undefined;
  firstShipBuilt: boolean;
  mood: DockmasterMood;
}): DockDeckOutcome {
  if (mood === "wrathful") {
    return "leave_wrathful";
  }

  if (!shouldEnsureDockmaster(islandRecorded, dockSupportTypeId)) {
    return "wait";
  }

  if (dockSupportTypeId === undefined) {
    return "wait";
  }

  if (dockSupportTypeId === DOCK_DECK_BLOCK) {
    return "station";
  }

  return firstShipBuilt ? "provoke" : "restore_deck";
}
