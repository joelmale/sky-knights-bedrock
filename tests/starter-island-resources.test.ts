import { describe, expect, it } from "vitest";

import { DOCKYARD } from "../scripts/config/constants";
import { islandDefinition } from "../scripts/config/islands";
import {
  STARTER_RESOURCE_MINIMUMS,
  island as authoredStarterIsland,
} from "../tools/structures/starter_island.mjs";

interface StructureInspection {
  palette: string[];
  indices: number[];
}

interface ShapedRecipe {
  description: { identifier: string };
  pattern: string[];
  key: Record<string, { item?: string; tag?: string }>;
  result: { item: string; count?: number };
}

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const RECIPE_SOURCES: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/recipes/{ship_core,canvas_bundle,thruster_module}.json",
  { eager: true, query: "?raw", import: "default" },
);

const starterStructure = authoredStarterIsland as {
  size: number[];
  inspect(): StructureInspection;
};
const inspection = starterStructure.inspect();
const [starterWidth, starterHeight, starterDepth] = starterStructure.size;
const minimums = STARTER_RESOURCE_MINIMUMS as Record<string, number>;

function blockCount(typeId: string): number {
  const paletteIndex = inspection.palette.indexOf(typeId);
  return inspection.indices.filter((index) => index === paletteIndex).length;
}

function blockTypeAt(x: number, y: number, z: number): string {
  if (
    x < 0 ||
    x >= starterWidth ||
    y < 0 ||
    y >= starterHeight ||
    z < 0 ||
    z >= starterDepth
  ) {
    return "minecraft:air";
  }

  const paletteIndex =
    inspection.indices[
      x * starterHeight * starterDepth + y * starterDepth + z
    ] ?? -1;
  return paletteIndex < 0
    ? "minecraft:air"
    : (inspection.palette[paletteIndex] ?? "unknown");
}

function exposedBlockCount(typeId: string): number {
  let count = 0;

  for (let x = 0; x < starterWidth; x += 1) {
    for (let y = 0; y < starterHeight; y += 1) {
      for (let z = 0; z < starterDepth; z += 1) {
        if (blockTypeAt(x, y, z) !== typeId) {
          continue;
        }

        const neighbors = [
          blockTypeAt(x - 1, y, z),
          blockTypeAt(x + 1, y, z),
          blockTypeAt(x, y - 1, z),
          blockTypeAt(x, y + 1, z),
          blockTypeAt(x, y, z - 1),
          blockTypeAt(x, y, z + 1),
        ];

        if (neighbors.includes("minecraft:air")) {
          count += 1;
        }
      }
    }
  }

  return count;
}

function starterRecipes(): ShapedRecipe[] {
  const recipes: ShapedRecipe[] = [];

  for (const path in RECIPE_SOURCES) {
    recipes.push(
      (
        JSON.parse(RECIPE_SOURCES[path]) as {
          "minecraft:recipe_shaped": ShapedRecipe;
        }
      )["minecraft:recipe_shaped"],
    );
  }

  return recipes;
}

function recipeIngredientCounts(recipe: ShapedRecipe): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const row of recipe.pattern) {
    for (const symbol of row) {
      const ingredient = recipe.key[symbol];

      if (ingredient === undefined) {
        continue;
      }

      const itemId =
        ingredient.item ??
        (ingredient.tag === "minecraft:planks"
          ? "minecraft:oak_planks"
          : ingredient.tag);

      if (itemId !== undefined) {
        counts[itemId] = (counts[itemId] ?? 0) + 1;
      }
    }
  }

  return counts;
}

describe("starter island resource contract", () => {
  it("matches every runtime integrity probe to the generated block", () => {
    for (const probe of islandDefinition("starter_island").integrityBlocks) {
      expect(
        blockTypeAt(probe.offset.x, probe.offset.y, probe.offset.z),
        `${probe.offset.x},${probe.offset.y},${probe.offset.z}`,
      ).toBe(probe.typeId);
    }
  });

  it("contains a visible-workshop resource budget with a safety margin", () => {
    expect(minimums).toEqual({
      "minecraft:oak_log": 8,
      "minecraft:stone": 16,
      "minecraft:coal_ore": 8,
      "minecraft:iron_ore": 12,
    });

    for (const typeId in minimums) {
      expect(blockCount(typeId), typeId).toBeGreaterThanOrEqual(
        minimums[typeId],
      );
    }

    expect(blockCount("minecraft:crafting_table")).toBeGreaterThanOrEqual(1);
    expect(blockCount("minecraft:furnace")).toBeGreaterThanOrEqual(1);
    expect(blockTypeAt(12, 12, 7)).toBe("minecraft:crafting_table");
    expect(blockTypeAt(13, 12, 7)).toBe("minecraft:furnace");
    expect(blockTypeAt(7, 12, 7)).toBe("minecraft:oak_log");
    expect(blockTypeAt(17, 12, 15)).toBe("minecraft:oak_log");
    expect(exposedBlockCount("minecraft:iron_ore")).toBeGreaterThanOrEqual(1);
    expect(exposedBlockCount("minecraft:coal_ore")).toBeGreaterThanOrEqual(1);
  });

  it("places adjacent iron and coal prospects in the walkable surface", () => {
    expect(blockTypeAt(9, 11, 9)).toBe("minecraft:iron_ore");
    expect(blockTypeAt(9, 12, 9)).toBe("minecraft:air");
    expect(blockTypeAt(9, 10, 9)).toBe("minecraft:iron_ore");
    expect(blockTypeAt(10, 11, 9)).toBe("minecraft:coal_ore");
    expect(blockTypeAt(10, 12, 9)).toBe("minecraft:air");
    expect(blockTypeAt(10, 10, 9)).toBe("minecraft:coal_ore");
  });

  it("covers the complete first-skiff recipe and survival-tool budget", () => {
    const recipes = starterRecipes();
    const requirements: Record<string, Record<string, number>> = {};
    const results: Record<string, number> = {};

    for (const recipe of recipes) {
      requirements[recipe.description.identifier] =
        recipeIngredientCounts(recipe);
      results[recipe.result.item] = recipe.result.count ?? 1;
    }

    expect(DOCKYARD.assemblyRequirements).toEqual([
      { itemId: "skyknights:ship_core", count: 1 },
      { itemId: "skyknights:canvas_bundle", count: 2 },
      { itemId: "skyknights:thruster_module", count: 1 },
    ]);
    expect(results).toEqual({
      "skyknights:ship_core": 1,
      "skyknights:canvas_bundle": 2,
      "skyknights:thruster_module": 1,
    });
    expect(requirements).toEqual({
      "skyknights:ship_core": {
        "minecraft:iron_ingot": 4,
        "minecraft:coal": 1,
      },
      "skyknights:canvas_bundle": {
        "minecraft:oak_planks": 6,
        "minecraft:stick": 2,
      },
      "skyknights:thruster_module": {
        "minecraft:coal": 1,
        "minecraft:iron_ingot": 3,
        "minecraft:cobblestone": 1,
      },
    });

    // Conservative closure: the player may craft a table, wooden pick, stone
    // pick, and furnace even though the island also supplies a workshop.
    expect(blockCount("minecraft:iron_ore")).toBeGreaterThanOrEqual(7);
    expect(blockCount("minecraft:coal_ore")).toBeGreaterThanOrEqual(3);
    expect(blockCount("minecraft:stone")).toBeGreaterThanOrEqual(12);
    expect(blockCount("minecraft:oak_log") * 4).toBeGreaterThanOrEqual(17);
  });
});
