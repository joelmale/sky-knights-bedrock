import { describe, expect, it } from "vitest";

import {
  hasExtendedRange,
  horizontalDistanceSquared,
  isCompleteSkycutterLoadout,
} from "../scripts/gameplay/ship-rules";
import {
  hasAetherCannon,
  hasExpandedCargo,
  modulesForSlot,
  shipDamageMultiplier,
} from "../scripts/gameplay/ship-modules";

describe("ship progression rules", () => {
  it("grants extended range to both expedition engines", () => {
    expect(hasExtendedRange({ engine: "starter_thruster" })).toBe(false);
    expect(hasExtendedRange({ engine: "skyknights:aether_engine" })).toBe(true);
    expect(hasExtendedRange({ engine: "skyknights:frostfire_engine" })).toBe(
      true,
    );
  });

  it("requires all four configured Skycutter slots", () => {
    expect(
      isCompleteSkycutterLoadout({
        hull: "skyknights:reinforced_hull",
        engine: "skyknights:aether_engine",
        cargo: "skyknights:cargo_hold",
        utility: "skyknights:navigator_module",
      }),
    ).toBe(true);
    expect(
      isCompleteSkycutterLoadout({
        hull: "skyknights:reinforced_hull",
        engine: "skyknights:aether_engine",
        cargo: "skyknights:cargo_hold",
      }),
    ).toBe(false);
    expect(
      isCompleteSkycutterLoadout({
        hull: "skyknights:armored_hull",
        engine: "skyknights:frostfire_engine",
        cargo: "skyknights:expanded_cargo_hold",
        utility: "skyknights:aether_cannon",
      }),
    ).toBe(true);
  });

  it("uses horizontal distance for the travel gate", () => {
    expect(horizontalDistanceSquared({ x: 10, z: 10 }, { x: 13, z: 14 })).toBe(
      25,
    );
  });

  it("maps advanced module effects to their slots", () => {
    expect(modulesForSlot("utility").map(({ itemId }) => itemId)).toEqual([
      "skyknights:navigator_module",
      "skyknights:aether_cannon",
      "skyknights:shield_projector",
    ]);
    expect(hasAetherCannon({ utility: "skyknights:aether_cannon" })).toBe(true);
    expect(hasExpandedCargo({ cargo: "skyknights:expanded_cargo_hold" })).toBe(
      true,
    );
  });

  it("stacks armored hull and shield damage reduction", () => {
    expect(
      shipDamageMultiplier({
        hull: "skyknights:armored_hull",
        utility: "skyknights:shield_projector",
      }),
    ).toBeCloseTo(0.44);
  });
});
