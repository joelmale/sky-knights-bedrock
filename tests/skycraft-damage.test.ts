import { describe, expect, it } from "vitest";

import {
  applyDamage,
  controlledDescent,
  disabledComponentIds,
  repairPlan,
  utilityPlan,
} from "../scripts/skycraft/damage";

const state = {
  hullIntegrity: 10,
  hullMaximum: 40,
  components: [
    {
      id: "engine",
      kind: "engine" as const,
      integrity: 5,
      maximumIntegrity: 5,
      disabled: false,
    },
    {
      id: "helm",
      kind: "helm" as const,
      integrity: 2,
      maximumIntegrity: 2,
      disabled: false,
    },
    {
      id: "lift",
      kind: "lift" as const,
      integrity: 4,
      maximumIntegrity: 4,
      disabled: false,
    },
    {
      id: "rudder",
      kind: "control" as const,
      integrity: 4,
      maximumIntegrity: 4,
      disabled: false,
    },
    {
      id: "port",
      kind: "hardpoint" as const,
      integrity: 0,
      maximumIntegrity: 3,
      disabled: true,
    },
  ],
};

describe("Skycraft damage and recovery planning", () => {
  it("applies excess damage in deterministic component order", () => {
    const damaged = applyDamage(state, 15);
    expect(damaged.hullIntegrity).toBe(0);
    expect(disabledComponentIds(damaged)).toEqual(["engine", "port"]);
    expect(controlledDescent(20, 30, damaged)).toBe("controlled_descent");
  });

  it("plans repair and disables unavailable hardpoints deterministically", () => {
    expect(repairPlan(state)).toMatchObject({
      hullPoints: 30,
      components: ["port"],
    });
    expect(utilityPlan(2, ["shield", "cannon", "shield"], state)).toEqual([
      "cannon",
    ]);
  });
});
