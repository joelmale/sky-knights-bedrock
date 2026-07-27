export type SkycraftUtility = "navigator" | "cannon" | "shield" | "repair";
export type FlightSafety = "normal" | "controlled_descent" | "grounded";

export interface ComponentIntegrity {
  id: string;
  kind:
    "helm" | "engine" | "lift" | "control" | "cargo" | "hardpoint" | "utility";
  integrity: number;
  maximumIntegrity: number;
  disabled: boolean;
}

export interface AirshipDamageState {
  hullIntegrity: number;
  hullMaximum: number;
  components: readonly ComponentIntegrity[];
}

export interface RepairRequirement {
  itemId: string;
  count: number;
}

export interface RepairPlan {
  hullPoints: number;
  components: readonly string[];
  requirements: readonly RepairRequirement[];
}

export function canonicalDamageState(
  state: AirshipDamageState,
): AirshipDamageState {
  return {
    hullIntegrity: Math.max(
      0,
      Math.min(state.hullMaximum, Math.trunc(state.hullIntegrity)),
    ),
    hullMaximum: Math.max(1, Math.trunc(state.hullMaximum)),
    components: [...state.components]
      .map((component) => {
        const maximumIntegrity = Math.max(
          1,
          Math.trunc(component.maximumIntegrity),
        );
        const integrity = Math.max(
          0,
          Math.min(maximumIntegrity, Math.trunc(component.integrity)),
        );
        return {
          ...component,
          maximumIntegrity,
          integrity,
          disabled: component.disabled || integrity === 0,
        };
      })
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

/** Applies hull damage first, then consumes component integrity in stable ID order. */
export function applyDamage(
  state: AirshipDamageState,
  amount: number,
): AirshipDamageState {
  const normalized = canonicalDamageState(state);
  let remaining = Math.max(0, Math.trunc(amount));
  const hullDamage = Math.min(normalized.hullIntegrity, remaining);
  remaining -= hullDamage;
  const components = normalized.components.map((component) => {
    const damage = Math.min(component.integrity, remaining);
    remaining -= damage;
    const integrity = component.integrity - damage;
    return {
      ...component,
      integrity,
      disabled: component.disabled || integrity === 0,
    };
  });

  return {
    hullIntegrity: normalized.hullIntegrity - hullDamage,
    hullMaximum: normalized.hullMaximum,
    components,
  };
}

export function disabledComponentIds(
  state: AirshipDamageState,
): readonly string[] {
  return canonicalDamageState(state)
    .components.filter((component) => component.disabled)
    .map((component) => component.id);
}

export function controlledDescent(
  liftSubunits: number,
  requiredLiftSubunits: number,
  state: AirshipDamageState,
): FlightSafety {
  const components = canonicalDamageState(state).components;
  const helmDisabled = components.some(
    (component) => component.kind === "helm" && component.disabled,
  );
  const activeLift = components.some(
    (component) => component.kind === "lift" && !component.disabled,
  );
  const activeControl = components.some(
    (component) => component.kind === "control" && !component.disabled,
  );

  if (helmDisabled || !activeLift || !activeControl) {
    return "grounded";
  }

  return liftSubunits < requiredLiftSubunits ? "controlled_descent" : "normal";
}

export function repairPlan(state: AirshipDamageState): RepairPlan {
  const normalized = canonicalDamageState(state);
  const hullPoints = normalized.hullMaximum - normalized.hullIntegrity;
  const components = normalized.components.filter(
    (component) => component.integrity < component.maximumIntegrity,
  );
  const repairKits =
    Math.ceil(hullPoints / 40) +
    components.filter((component) => component.disabled).length;
  const requirements: RepairRequirement[] =
    repairKits > 0
      ? [{ itemId: "skyknights:repair_kit", count: repairKits }]
      : [];

  return {
    hullPoints,
    components: components.map((component) => component.id),
    requirements,
  };
}

export function utilityPlan(
  hardpointCap: number,
  requested: readonly SkycraftUtility[],
  state: AirshipDamageState,
): readonly SkycraftUtility[] {
  const disabledHardpoints = canonicalDamageState(state).components.filter(
    (component) => component.kind === "hardpoint" && component.disabled,
  ).length;
  const available = Math.max(0, Math.trunc(hardpointCap) - disabledHardpoints);
  return [...new Set(requested)].sort().slice(0, available);
}
