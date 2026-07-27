import { describe, expect, it } from "vitest";

import {
  STARTER_RESOURCE_MINIMUMS,
  island as authoredStarterIsland,
} from "../tools/structures/starter_island.mjs";

// @ts-expect-error Vite injects import.meta.glob.
const RECIPE_SOURCES: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/recipes/{ship_core,canvas_bundle,thruster_module,skycraft_basic_helm,skycraft_ship_core_block,skycraft_lift_sail,skycraft_coal_thruster}.json",
  { eager: true, query: "?raw", import: "default" },
);

interface RecipeBody {
  description: { identifier: string };
  pattern?: string[];
  key?: Record<string, { item?: string; tag?: string }>;
  ingredients?: Array<{ item?: string; tag?: string }>;
  result: { item: string; count?: number };
}

function recipes(): Readonly<Record<string, RecipeBody>> {
  const result: Record<string, RecipeBody> = {};
  for (const path of Object.keys(RECIPE_SOURCES)) {
    const parsed = JSON.parse(RECIPE_SOURCES[path]) as Record<
      string,
      RecipeBody
    >;
    const body =
      parsed["minecraft:recipe_shaped"] ?? parsed["minecraft:recipe_shapeless"];
    result[body.description.identifier] = body;
  }
  return result;
}

describe("Apprentice Raft starter resource closure", () => {
  it("converts legacy starter parts without adding another iron gate", () => {
    const rules = recipes();
    const coreWrapper = rules["skyknights:ship_core_block"];
    const thrusterWrapper = rules["skyknights:coal_thruster"];

    expect(coreWrapper.ingredients).toEqual([
      { item: "skyknights:ship_core" },
      { item: "minecraft:oak_planks" },
    ]);
    expect(thrusterWrapper.ingredients).toEqual([
      { item: "skyknights:thruster_module" },
      { item: "minecraft:coal" },
      { item: "minecraft:cobblestone" },
    ]);
    expect(JSON.stringify(coreWrapper)).not.toContain("iron_ingot");
    expect(JSON.stringify(thrusterWrapper)).not.toContain("iron_ingot");
  });

  it("fits a valid Minnow hull and all functional parts in the authored starter budget", () => {
    const inspection = (
      authoredStarterIsland as {
        inspect(): { palette: string[]; indices: number[] };
      }
    ).inspect();
    const count = (typeId: string): number => {
      const index = inspection.palette.indexOf(typeId);
      return inspection.indices.filter((entry) => entry === index).length;
    };

    // Legacy parts require 7 iron and 2 coal. Their placed wrappers add one
    // coal/cobblestone but no iron. Twelve deck planks plus wrapper/Helm/Sail
    // ingredients fit in seven logs, leaving one authored log for tools.
    expect(count("minecraft:iron_ore")).toBeGreaterThanOrEqual(7);
    expect(count("minecraft:coal_ore")).toBeGreaterThanOrEqual(3);
    expect(count("minecraft:oak_log")).toBeGreaterThanOrEqual(8);
    expect(
      (STARTER_RESOURCE_MINIMUMS as Record<string, number>)[
        "minecraft:oak_log"
      ],
    ).toBe(8);
  });
});
