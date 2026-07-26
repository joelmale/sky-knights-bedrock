import { describe, expect, it } from "vitest";

import { addBlockVectors, structureBounds } from "../scripts/generation/bounds";

describe("structure generation bounds", () => {
  it("covers the complete inclusive starter-island volume", () => {
    expect(
      structureBounds({ x: -12, y: 149, z: -10 }, { x: 31, y: 16, z: 23 }),
    ).toEqual({
      from: { x: -12, y: 149, z: -10 },
      to: { x: 18, y: 164, z: 12 },
    });
  });

  it("maps integrity offsets to world block locations", () => {
    expect(
      addBlockVectors({ x: -12, y: 149, z: -10 }, { x: 30, y: 11, z: 10 }),
    ).toEqual({ x: 18, y: 160, z: 0 });
  });

  it("covers the complete inclusive Frostspire volume", () => {
    expect(
      structureBounds({ x: 240, y: 150, z: -11 }, { x: 27, y: 15, z: 23 }),
    ).toEqual({
      from: { x: 240, y: 150, z: -11 },
      to: { x: 266, y: 164, z: 11 },
    });
  });
});
