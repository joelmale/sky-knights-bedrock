import { describe, expect, it } from "vitest";

import {
  blueprintComponentCount,
  REFERENCE_BLUEPRINTS,
  referenceBlueprint,
  SKYCRAFT_BLOCK_IDS,
} from "../scripts/skycraft/catalog";

describe("Skycraft reference catalog", () => {
  it("ships all eight editable docked reference starting points", () => {
    expect(REFERENCE_BLUEPRINTS.map((blueprint) => blueprint.name)).toEqual([
      "Minnow",
      "Dart",
      "Cargo Punt",
      "Cloudwhale",
      "Aether Disc",
      "Frostwing",
      "Surveyor",
      "Grand Cruiser",
    ]);
  });

  it("uses every agreed Skycraft block in at least one reference build", () => {
    const used = new Set<string>();
    for (const blueprint of REFERENCE_BLUEPRINTS) {
      for (const id of Object.keys(blueprint.blocks)) used.add(id);
    }
    expect([...used].sort()).toEqual([...SKYCRAFT_BLOCK_IDS].sort());
  });

  it("returns a clone so a reference build remains editable without mutation", () => {
    const minnow = referenceBlueprint("minnow");
    const editable = minnow.blocks as Record<string, number>;
    editable["skyknights:lift_sail"] = 99;
    expect(referenceBlueprint("minnow").blocks["skyknights:lift_sail"]).toBe(1);
    expect(
      blueprintComponentCount(referenceBlueprint("grand_cruiser")),
    ).toBeGreaterThan(10);
  });
});
