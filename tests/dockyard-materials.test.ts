import { describe, expect, it } from "vitest";

import {
  countMaterials,
  planMaterialConsumption,
  shouldEnsureDockmaster,
} from "../scripts/gameplay/dockyard-materials";

const requirements = [
  { itemId: "skyknights:ship_core", count: 1 },
  { itemId: "skyknights:canvas_bundle", count: 2 },
  { itemId: "skyknights:thruster_module", count: 1 },
];

describe("dockyard material transaction", () => {
  it("plans consumption across split inventory stacks", () => {
    const stacks = [
      { typeId: "skyknights:canvas_bundle", amount: 1 },
      { typeId: "minecraft:dirt", amount: 64 },
      { typeId: "skyknights:ship_core", amount: 1 },
      { typeId: "skyknights:canvas_bundle", amount: 4 },
      { typeId: "skyknights:thruster_module", amount: 1 },
    ];

    expect(countMaterials(stacks, requirements)).toEqual({
      "skyknights:canvas_bundle": 5,
      "skyknights:ship_core": 1,
      "skyknights:thruster_module": 1,
    });
    expect(planMaterialConsumption(stacks, requirements)).toEqual([
      { slot: 0, itemId: "skyknights:canvas_bundle", count: 1 },
      { slot: 2, itemId: "skyknights:ship_core", count: 1 },
      { slot: 3, itemId: "skyknights:canvas_bundle", count: 1 },
      { slot: 4, itemId: "skyknights:thruster_module", count: 1 },
    ]);
  });

  it("rejects assembly without every required component", () => {
    expect(
      planMaterialConsumption(
        [
          { typeId: "skyknights:ship_core", amount: 1 },
          { typeId: "skyknights:canvas_bundle", amount: 2 },
        ],
        requirements,
      ),
    ).toBeUndefined();
  });

  it("restores the Dockmaster from either saved generation or the real dock", () => {
    expect(shouldEnsureDockmaster(true, undefined)).toBe(true);
    expect(shouldEnsureDockmaster(false, "minecraft:oak_planks")).toBe(true);
    expect(shouldEnsureDockmaster(false, "minecraft:air")).toBe(false);
  });
});
