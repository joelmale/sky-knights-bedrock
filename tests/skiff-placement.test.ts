import { describe, expect, it } from "vitest";

import { getSkiffSpawnLocation } from "../scripts/gameplay/skiff-placement";

describe("skiff placement", () => {
  it("spawns ahead of the player at accessible rider height", () => {
    expect(
      getSkiffSpawnLocation(
        { x: 10, y: 64, z: 20 },
        { x: 0.5, y: 0.7, z: -0.5 },
      ),
    ).toEqual({
      x: 12,
      y: 64,
      z: 18,
    });
  });
});
