import { describe, expect, it } from "vitest";
import {
  canonicalBlueprintJson,
  migrateBlueprint,
} from "../scripts/skycraft/blueprint";
import { AirshipBlueprint } from "../scripts/skycraft/types";

const blueprint: AirshipBlueprint = {
  schemaVersion: 1,
  airshipId: "a",
  revision: 1,
  berth: {
    id: "b",
    dimensionId: "minecraft:overworld",
    origin: { x: 0, y: 0, z: 0 },
    size: { x: 7, y: 5, z: 7 },
    orientation: "north",
  },
  helm: {
    x: 0,
    y: 0,
    z: 0,
    typeId: "skyknights:basic_helm",
    states: {},
  },
  blocks: [
    {
      x: 1,
      y: 0,
      z: 0,
      typeId: "minecraft:oak_planks",
      states: { b: 2, a: 1 },
    },
    {
      x: 0,
      y: 0,
      z: 0,
      typeId: "skyknights:basic_helm",
      states: {},
    },
    {
      x: 0,
      y: 0,
      z: 1,
      typeId: "skyknights:ship_core_block",
      states: {},
    },
  ],
  components: [
    {
      x: 0,
      y: 0,
      z: 0,
      typeId: "skyknights:basic_helm",
      states: {},
      kind: "helm",
    },
    {
      x: 0,
      y: 0,
      z: 1,
      typeId: "skyknights:ship_core_block",
      states: {},
      kind: "core",
    },
  ],
  engineeringVersion: 1,
};
describe("skycraft blueprints", () => {
  it("serializes canonically and fails closed", () => {
    expect(canonicalBlueprintJson(blueprint)).toContain('"a":1,"b":2');
    expect(
      migrateBlueprint({ ...blueprint, schemaVersion: 2 }),
    ).toBeUndefined();
    expect(migrateBlueprint(blueprint)?.blocks[0].x).toBe(0);
  });

  it("rejects omitted, duplicated, or implausibly distant component cells", () => {
    expect(
      migrateBlueprint({ ...blueprint, components: [blueprint.components[0]] }),
    ).toBeUndefined();
    expect(
      migrateBlueprint({
        ...blueprint,
        components: [blueprint.components[0], blueprint.components[0]],
      }),
    ).toBeUndefined();
    expect(
      migrateBlueprint({
        ...blueprint,
        blocks: [
          ...blueprint.blocks,
          {
            x: 99,
            y: 0,
            z: 0,
            typeId: "minecraft:oak_planks",
            states: {},
          },
        ],
      }),
    ).toBeUndefined();
  });
});
