import { describe, expect, it } from "vitest";

import { DOCKYARD } from "../scripts/config/constants";
import { islandDefinition } from "../scripts/config/islands";
import {
  STARTER_BOULDER_BLOCKS,
  STARTER_RESOURCE_MARGIN,
  STARTER_RESOURCE_MINIMUMS,
  STARTER_RESOURCE_REQUIREMENTS,
  STARTER_SURFACE_OUTCROPS,
  STARTER_TREES,
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
const requirements = STARTER_RESOURCE_REQUIREMENTS as Record<string, number>;
const margin = STARTER_RESOURCE_MARGIN as number;
const boulderBlocks = STARTER_BOULDER_BLOCKS as {
  x: number;
  y: number;
  z: number;
}[];
const surfaceOutcrops = STARTER_SURFACE_OUTCROPS as {
  index: number;
  x: number;
  z: number;
  depth: number;
}[];
const trees = STARTER_TREES as { x: number; z: number }[];

// The walkable grass layer. Ore a player can see stands in this layer with
// open sky above it.
const SURFACE_Y = 11;
const ORE_TYPES = ["minecraft:iron_ore", "minecraft:coal_ore"];

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

  it("derives every minimum from the route requirement and a 2.5x margin", () => {
    expect(margin).toBe(2.5);
    expect(requirements).toEqual({
      "minecraft:oak_log": 5,
      "minecraft:stone": 4,
      "minecraft:coal_ore": 3,
      "minecraft:iron_ore": 7,
    });

    for (const typeId in requirements) {
      expect(minimums[typeId], typeId).toBe(
        Math.ceil(requirements[typeId] * margin),
      );
    }

    expect(minimums).toEqual({
      "minecraft:oak_log": 13,
      "minecraft:stone": 10,
      "minecraft:coal_ore": 8,
      "minecraft:iron_ore": 18,
    });
  });

  it("contains a visible-workshop resource budget with a safety margin", () => {
    for (const typeId in minimums) {
      expect(blockCount(typeId), typeId).toBeGreaterThanOrEqual(
        minimums[typeId],
      );
    }

    expect(blockCount("minecraft:crafting_table")).toBeGreaterThanOrEqual(1);
    expect(blockCount("minecraft:furnace")).toBeGreaterThanOrEqual(1);
    expect(blockTypeAt(12, 12, 7)).toBe("minecraft:crafting_table");
    expect(blockTypeAt(13, 12, 7)).toBe("minecraft:furnace");
    expect(exposedBlockCount("minecraft:iron_ore")).toBeGreaterThanOrEqual(4);
    expect(exposedBlockCount("minecraft:coal_ore")).toBeGreaterThanOrEqual(2);

    for (const tree of trees) {
      expect(blockTypeAt(tree.x, 12, tree.z)).toBe("minecraft:oak_log");
    }

    expect(trees.length * 4).toBeGreaterThanOrEqual(
      minimums["minecraft:oak_log"],
    );
  });

  it("advertises every prospect in the walkable surface with ore beneath it", () => {
    expect(surfaceOutcrops.filter((outcrop) => outcrop.depth >= 2).length).toBe(
      surfaceOutcrops.length,
    );

    for (const outcrop of surfaceOutcrops) {
      const typeId = blockTypeAt(outcrop.x, SURFACE_Y, outcrop.z);
      expect(ORE_TYPES, `${outcrop.x},${outcrop.z}`).toContain(typeId);
      expect(blockTypeAt(outcrop.x, SURFACE_Y + 1, outcrop.z)).toBe(
        "minecraft:air",
      );

      for (let offset = 1; offset < outcrop.depth; offset += 1) {
        expect(
          blockTypeAt(outcrop.x, SURFACE_Y - offset, outcrop.z),
          `${outcrop.x},${SURFACE_Y - offset},${outcrop.z}`,
        ).toBe(typeId);
      }
    }
  });

  // The 0.3.5 playtest found only two iron because the surplus sat on the
  // island's tapered underside, which cannot be mined before the ship the iron
  // pays for. No ore may sit below the diggable band again.
  it("keeps every ore block inside the band reachable from the surface", () => {
    for (const typeId of ORE_TYPES) {
      let found = 0;

      for (let x = 0; x < starterWidth; x += 1) {
        for (let y = 0; y < starterHeight; y += 1) {
          for (let z = 0; z < starterDepth; z += 1) {
            if (blockTypeAt(x, y, z) !== typeId) {
              continue;
            }

            found += 1;
            expect(y, `${typeId} at ${x},${y},${z}`).toBeGreaterThanOrEqual(7);
          }
        }
      }

      expect(found, typeId).toBe(minimums[typeId]);
    }
  });

  it("places a visible boulder with enough stone for the first stone pickaxe", () => {
    expect(boulderBlocks.length).toBeGreaterThanOrEqual(
      minimums["minecraft:stone"],
    );

    for (const block of boulderBlocks) {
      expect(block.y).toBeGreaterThan(SURFACE_Y);
      expect(blockTypeAt(block.x, block.y, block.z)).toBe("minecraft:stone");
      expect(blockTypeAt(block.x, SURFACE_Y, block.z)).toBe(
        "minecraft:grass_block",
      );
    }

    expect(exposedBlockCount("minecraft:stone")).toBeGreaterThanOrEqual(
      boulderBlocks.length,
    );
  });

  it("covers the complete first-skiff recipe and survival-tool budget", () => {
    const recipes = starterRecipes();
    const recipeRequirements: Record<string, Record<string, number>> = {};
    const results: Record<string, number> = {};

    for (const recipe of recipes) {
      recipeRequirements[recipe.description.identifier] =
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
    expect(recipeRequirements).toEqual({
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

    // The declared iron requirement must be exactly what the two iron recipes
    // spend, so a recipe retune cannot silently erode the margin.
    const routeIron =
      recipeRequirements["skyknights:ship_core"]["minecraft:iron_ingot"] +
      recipeRequirements["skyknights:thruster_module"]["minecraft:iron_ingot"];

    expect(routeIron).toBe(requirements["minecraft:iron_ore"]);

    // Conservative closure: the player may craft a table, wooden pick, stone
    // pick, and furnace even though the island also supplies a workshop.
    for (const typeId in requirements) {
      const supplied =
        typeId === "minecraft:stone"
          ? boulderBlocks.length
          : blockCount(typeId);

      expect(supplied / requirements[typeId], typeId).toBeGreaterThanOrEqual(
        margin,
      );
    }
  });
});
