import { describe, expect, it } from "vitest";
import { normalizedFacing, scanAirship } from "../scripts/skycraft/scanner";
const berth = {
  id: "b",
  dimensionId: "minecraft:overworld",
  origin: { x: 0, y: 0, z: 0 },
  size: { x: 7, y: 5, z: 7 },
  orientation: "north" as const,
};
describe("skycraft scanner", () => {
  it("finds a deterministic connected craft", () => {
    const blocks: Record<string, { typeId: string }> = {
      "1,1,1": { typeId: "skyknights:basic_helm" },
      "2,1,1": { typeId: "skyknights:ship_core_block" },
      "3,1,1": { typeId: "skyknights:coal_thruster" },
    };
    const result = scanAirship(
      { getBlock: (p) => blocks[`${p.x},${p.y},${p.z}`] },
      berth,
      { x: 1, y: 1, z: 1 },
    );
    expect(result.diagnostics).toEqual([]);
    expect(result.blocks.map((block) => block.x)).toEqual([0, 1, 2]);
  });
  it("rejects a missing core", () => {
    const result = scanAirship(
      {
        getBlock: (p) =>
          p.x === 1 && p.y === 1 && p.z === 1
            ? { typeId: "skyknights:basic_helm" }
            : undefined,
      },
      berth,
      { x: 1, y: 1, z: 1 },
    );
    expect(result.diagnostics[0].code).toBe("missing_or_duplicate_core");
  });

  it("normalizes live numeric facing states and ignores air", () => {
    expect(normalizedFacing({ "minecraft:facing_direction": 0 })).toBe("down");
    expect(normalizedFacing({ "minecraft:facing_direction": 3 })).toBe("south");
    expect(normalizedFacing({ "minecraft:facing_direction": 5 })).toBe("east");

    const result = scanAirship(
      {
        getBlock: (position) => {
          if (position.x === 1 && position.y === 1 && position.z === 1) {
            return { typeId: "skyknights:basic_helm" };
          }
          if (position.x === 2 && position.y === 1 && position.z === 1) {
            return { typeId: "skyknights:ship_core_block" };
          }
          return { typeId: "minecraft:air" };
        },
      },
      berth,
      { x: 1, y: 1, z: 1 },
    );
    expect(result.diagnostics).toEqual([]);
  });
});
