import { describe, expect, it } from "vitest";
import { SKYCRAFT_CERTIFICATIONS } from "../scripts/skycraft/config";
import { evaluateAirship } from "../scripts/skycraft/engineering";
import { AirshipBlueprint } from "../scripts/skycraft/types";
const base: AirshipBlueprint = {
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
      x: 0,
      y: 0,
      z: 0,
      typeId: "skyknights:basic_helm",
      states: {},
    },
    {
      x: 1,
      y: 0,
      z: 0,
      typeId: "skyknights:ship_core_block",
      states: {},
    },
    { x: 2, y: 0, z: 0, typeId: "skyknights:coal_thruster", states: {} },
    { x: 0, y: 1, z: 0, typeId: "skyknights:lift_sail", states: {} },
  ],
  components: [
    {
      x: 2,
      y: 0,
      z: 0,
      typeId: "skyknights:coal_thruster",
      states: {},
      kind: "engine",
      facing: "down",
    },
    {
      x: 0,
      y: 1,
      z: 0,
      typeId: "skyknights:lift_sail",
      states: {},
      kind: "lift",
    },
  ],
  engineeringVersion: 1,
};
describe("skycraft engineering", () => {
  it("uses integer 115 percent lift", () => {
    const report = evaluateAirship(
      base,
      SKYCRAFT_CERTIFICATIONS.apprentice_raft,
    );
    expect(report.requiredLiftSubunits).toBe(33);
    expect(report.allowed).toBe(false);
    expect(report.diagnostics).toContain(
      "No aft-facing engine provides forward thrust.",
    );
  });
});
