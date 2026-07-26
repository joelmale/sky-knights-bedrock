import { describe, expect, it } from "vitest";

import {
  hasExtendedRange,
  horizontalDistanceSquared,
  isCompleteSkycutterLoadout,
} from "../scripts/gameplay/ship-rules";

describe("ship progression rules", () => {
  it("only grants extended range to the Aether Engine", () => {
    expect(hasExtendedRange({ engine: "starter_thruster" })).toBe(false);
    expect(hasExtendedRange({ engine: "skyknights:aether_engine" })).toBe(true);
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
  });

  it("uses horizontal distance for the travel gate", () => {
    expect(horizontalDistanceSquared({ x: 10, z: 10 }, { x: 13, z: 14 })).toBe(
      25,
    );
  });
});
