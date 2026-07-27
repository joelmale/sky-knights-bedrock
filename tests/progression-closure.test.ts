// Progression closure test (roadmap 8 "host-side reachability test", 10, 11/4).
//
// A hypothetical player starts on the home island holding NOTHING. Every rule
// in `scripts/progression/graph.ts` is applied repeatedly until the reachable
// set stops growing. The suite then asserts:
//
// 1. every `Guaranteed = yes` row of docs/CONTENT_MATRIX.md is reachable;
// 2. the graph still agrees with the shipping recipe JSON, the script-placed
//    loot in scripts/generation/content-table.ts, the matrix itself, and the
//    island tiers in scripts/config/islands.ts;
// 3. no island is gated on an item only that island yields (no circular gate);
// 4. the test can actually fail — the negative cases below delete a guaranteed
//    source, or inject a circular gate, and prove the assertions go red.
//
// Raw file reads use `import.meta.glob`, because the project has no
// `@types/node` and `tsc --noEmit` must stay clean.

import { describe, expect, it } from "vitest";

import { IDENTIFIERS } from "../scripts/config/constants";
import { ISLAND_DEFINITIONS } from "../scripts/config/islands";
import { ISLAND_CONTENT_TABLE } from "../scripts/generation/content-table";
import {
  deriveClosure,
  derivationFor,
  findGateCycle,
  formatGateCycle,
  guaranteedItemsWithoutBuiltSource,
  GUARANTEED_ITEMS,
  islandAccessToken,
  islandSelfGateFailures,
  missingGuaranteedItems,
  nodesGranting,
  nodesInScope,
  oneTimeOnlyTokens,
  PENDING_GUARANTEED_ITEMS,
  PROGRESSION_ISLANDS,
  PROGRESSION_NODES,
  ProgressionNode,
  QUANTITY_GATES,
  RECIPE_TAG_ITEMS,
  reachableTokens,
  shipTokenForTier,
  withoutNodes,
} from "../scripts/progression/graph";

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const RECIPE_SOURCES: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/recipes/*.json",
  { eager: true, query: "?raw", import: "default" },
);

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const MATRIX_SOURCES: Record<string, string> = import.meta.glob(
  "../docs/CONTENT_MATRIX.md",
  { eager: true, query: "?raw", import: "default" },
);

/**
 * Tokens whose only shipping source is a one-time structure chest. Losing the
 * stack is a soft lock, so the set is pinned here rather than left to drift.
 * `minecraft:emerald` is the tightest: `navigator_module` needs three and the
 * Ember Outpost chest holds exactly three.
 */
const ONE_TIME_ONLY_BUILT_TOKENS: readonly string[] = [
  "minecraft:cooked_beef",
  "minecraft:cooked_salmon",
  "minecraft:copper_ingot",
  "minecraft:diamond",
  "minecraft:emerald",
  "minecraft:gold_ingot",
  "minecraft:oak_sapling",
  "minecraft:redstone",
  IDENTIFIERS.aetherCore,
  IDENTIFIERS.aetherCrystal,
  IDENTIFIERS.froststeelIngot,
  IDENTIFIERS.relicShard,
];

function onlyValue(sources: Record<string, string>): string {
  const keys = Object.keys(sources);

  if (keys.length !== 1) {
    throw new Error(`Expected exactly one source file, found ${keys.length}.`);
  }

  return sources[keys[0]];
}

function backtickedNames(cell: string): readonly string[] {
  const parts = cell.split("`");
  const names: string[] = [];

  for (let index = 1; index < parts.length; index += 2) {
    names.push(parts[index]);
  }

  return names;
}

interface MatrixItemRow {
  itemId: string;
  guaranteed: boolean;
  status: string;
}

function parseMatrixItemRows(markdown: string): readonly MatrixItemRow[] {
  const lines = markdown.split("\n");
  const start = lines.indexOf("## Items");

  if (start < 0) {
    throw new Error("docs/CONTENT_MATRIX.md has no '## Items' section.");
  }

  const rows: MatrixItemRow[] = [];
  let seen = 0;

  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (line.indexOf("## ") === 0) {
      break;
    }

    if (line.indexOf("|") !== 0) {
      continue;
    }

    seen += 1;

    if (seen <= 2) {
      continue;
    }

    const cells = line.split("|");
    const vanilla = cells[1].indexOf("(vanilla)") >= 0;

    for (const name of backtickedNames(cells[1])) {
      rows.push({
        itemId: `${vanilla ? "minecraft" : "skyknights"}:${name}`,
        guaranteed: cells[3].trim() === "yes",
        status: cells[4].trim(),
      });
    }
  }

  if (rows.length === 0) {
    throw new Error("Parsed no rows from the content matrix items table.");
  }

  return rows;
}

interface ParsedRecipe {
  identifier: string;
  needsTable: boolean;
  items: readonly string[];
  tags: readonly string[];
  result: string;
}

function parseRecipe(source: string): ParsedRecipe {
  const json = JSON.parse(source) as Record<string, unknown>;
  const shaped = json["minecraft:recipe_shaped"] as
    Record<string, unknown> | undefined;
  const shapeless = json["minecraft:recipe_shapeless"] as
    Record<string, unknown> | undefined;
  const recipe = shaped ?? shapeless;

  if (recipe === undefined) {
    throw new Error("Recipe file declares neither a shaped nor shapeless key.");
  }

  const description = recipe.description as { identifier: string };
  const tags = (recipe.tags as string[] | undefined) ?? [];
  const result = recipe.result as { item: string };
  const ingredients: { item?: string; tag?: string }[] = [];

  if (shaped !== undefined) {
    const key = shaped.key as Record<string, { item?: string; tag?: string }>;

    for (const symbol of Object.keys(key).sort()) {
      ingredients.push(key[symbol]);
    }
  } else {
    for (const ingredient of shapeless?.ingredients as {
      item?: string;
      tag?: string;
    }[]) {
      ingredients.push(ingredient);
    }
  }

  const items: string[] = [];
  const ingredientTags: string[] = [];

  for (const ingredient of ingredients) {
    if (ingredient.item !== undefined && items.indexOf(ingredient.item) < 0) {
      items.push(ingredient.item);
    }

    if (
      ingredient.tag !== undefined &&
      ingredientTags.indexOf(ingredient.tag) < 0
    ) {
      ingredientTags.push(ingredient.tag);
    }
  }

  return {
    identifier: description.identifier,
    needsTable: tags.indexOf("crafting_table") >= 0,
    items,
    tags: ingredientTags,
    result: result.item,
  };
}

function parsedRecipes(): readonly ParsedRecipe[] {
  return Object.keys(RECIPE_SOURCES)
    .sort()
    .map((path) => parseRecipe(RECIPE_SOURCES[path]));
}

function contentItemIds(): ReadonlySet<string> {
  const ids = new Set<string>();

  for (const content of ISLAND_CONTENT_TABLE) {
    for (const item of content.lootChest?.items ?? []) {
      ids.add(item.itemId);
    }
  }

  return ids;
}

function node(id: string): ProgressionNode {
  const found = PROGRESSION_NODES.find((candidate) => candidate.id === id);

  if (found === undefined) {
    throw new Error(`Unknown progression rule ${id}.`);
  }

  return found;
}

describe("progression closure", () => {
  it("starts the hypothetical player holding nothing", () => {
    const withoutSpawn = withoutNodes(PROGRESSION_NODES, ["start:home"]);
    expect(deriveClosure(withoutSpawn).tokens.size).toBe(0);
    expect(deriveClosure(PROGRESSION_NODES).appliedNodeIds[0]).toBe(
      "start:home",
    );
    expect(node("start:home").requires).toEqual([]);
  });

  it("reaches every built guaranteed item from an empty inventory", () => {
    expect(missingGuaranteedItems(PROGRESSION_NODES, "built")).toEqual([]);
  });

  it("reaches every declared guaranteed item, planned rows included", () => {
    expect(missingGuaranteedItems(PROGRESSION_NODES, "declared")).toEqual([]);
  });

  it("reaches every ship tier and every island", () => {
    const reachable = reachableTokens(PROGRESSION_NODES, "declared");

    for (const tier of [1, 2, 3]) {
      expect(reachable.has(shipTokenForTier(tier))).toBe(true);
    }

    for (const island of PROGRESSION_ISLANDS) {
      expect(reachable.has(islandAccessToken(island.id))).toBe(true);
    }
  });

  it("derives the endgame item through the intended ladder", () => {
    const scoped = nodesInScope(PROGRESSION_NODES, "declared");
    const closure = deriveClosure(scoped);
    const chain = derivationFor(scoped, closure, "skyknights:aether_core");

    expect(chain[0]).toBe("start:home");
    expect(chain).toContain("assembly:skiff");
    expect(chain).toContain("loot:ember_outpost");
    expect(chain).toContain("assembly:skycutter");
    expect(chain).toContain("loot:frostspire");
    expect(chain).toContain("assembly:skycutter_refit");
    expect(chain[chain.length - 1]).toBe("loot:aether_sanctum");
  });
});

describe("content matrix agreement", () => {
  it("declares exactly the guaranteed rows the matrix marks yes", () => {
    const rows = parseMatrixItemRows(onlyValue(MATRIX_SOURCES));
    const expected = rows
      .filter((row) => row.guaranteed)
      .map((row) => row.itemId)
      .sort();
    const declared = GUARANTEED_ITEMS.map((item) => item.itemId).sort();

    expect(declared).toEqual(expected);
  });

  it("mirrors the matrix status column for every guaranteed row", () => {
    const rows = parseMatrixItemRows(onlyValue(MATRIX_SOURCES));

    for (const item of GUARANTEED_ITEMS) {
      const row = rows.find((candidate) => candidate.itemId === item.itemId);
      expect(row, `${item.itemId} is missing from the matrix`).toBeDefined();
      expect(row?.status).toBe(item.status);
    }
  });

  it("matches the island tiers in the layout registry", () => {
    expect(PROGRESSION_ISLANDS.map((island) => island.id)).toEqual(
      ISLAND_DEFINITIONS.map((definition) => definition.id),
    );

    for (const island of PROGRESSION_ISLANDS) {
      const definition = ISLAND_DEFINITIONS.find(
        (candidate) => candidate.id === island.id,
      );
      expect(definition?.tier).toBe(island.tier);
    }
  });
});

describe("shipping content agreement", () => {
  it("matches every recipe JSON file ingredient for ingredient", () => {
    const recipes = parsedRecipes();
    expect(recipes.length).toBeGreaterThan(0);

    for (const recipe of recipes) {
      const rule = node(`craft:${recipe.identifier}`);
      expect(rule.grants).toContain(recipe.result);

      const allowed: string[] = [];

      if (recipe.needsTable) {
        expect(rule.requires).toContain("minecraft:crafting_table");
        allowed.push("minecraft:crafting_table");
      }

      for (const item of recipe.items) {
        expect(rule.requires, `${rule.id} must require ${item}`).toContain(
          item,
        );
        allowed.push(item);
      }

      for (const tag of recipe.tags) {
        const options = RECIPE_TAG_ITEMS[tag];
        expect(options, `no RECIPE_TAG_ITEMS entry for ${tag}`).toBeDefined();
        expect(
          options.some((option) => rule.requires.indexOf(option) >= 0),
          `${rule.id} must require one of ${options.join(", ")} for ${tag}`,
        ).toBe(true);

        for (const option of options) {
          allowed.push(option);
        }
      }

      for (const requirement of rule.requires) {
        expect(
          allowed,
          `${rule.id} requires ${requirement}, which the recipe never uses`,
        ).toContain(requirement);
      }
    }
  });

  it("declares a recipe file for every add-on craft rule", () => {
    const identifiers = parsedRecipes().map((recipe) => recipe.identifier);

    for (const rule of PROGRESSION_NODES) {
      if (rule.id.indexOf("craft:skyknights:") !== 0) {
        continue;
      }

      expect(identifiers).toContain(rule.id.slice("craft:".length));
    }
  });

  it("matches the declarative guaranteed loot table", () => {
    const placed = contentItemIds();
    const lootRules = PROGRESSION_NODES.filter(
      (rule) => rule.kind === "loot" && rule.status === "built",
    );

    expect(lootRules.map((rule) => rule.id)).toEqual([
      "loot:ember_outpost",
      "loot:frostspire",
      "loot:sunspire_reach",
      "loot:verdant_hollow",
      "loot:glacier_vault",
      "loot:ashfall_crater",
      "loot:aether_sanctum",
    ]);

    for (const rule of lootRules) {
      for (const grant of rule.grants) {
        expect(
          placed.has(grant),
          `${rule.id} claims ${grant}, which content-table.ts never places`,
        ).toBe(true);
      }
    }

    expect(placed.has(IDENTIFIERS.aetherCrystal)).toBe(true);
    expect(placed.has(IDENTIFIERS.froststeelIngot)).toBe(true);
  });
});

describe("ordering constraints", () => {
  it("never gates an island on an item only that island yields", () => {
    expect(islandSelfGateFailures(PROGRESSION_NODES, "built")).toEqual([]);
    expect(islandSelfGateFailures(PROGRESSION_NODES, "declared")).toEqual([]);
  });

  it("keeps every tier-N gate below the tier it unlocks", () => {
    const reachable = reachableTokens(PROGRESSION_NODES, "declared");

    for (const island of PROGRESSION_ISLANDS) {
      if (island.tier === 0) {
        continue;
      }

      const travel = node(`travel:${island.id}`);
      expect(travel.requires).toContain(shipTokenForTier(island.tier));

      for (const requirement of travel.requires) {
        expect(
          reachable.has(requirement),
          `${travel.id} requires unreachable ${requirement}`,
        ).toBe(true);
      }
    }
  });

  it("gives every multi-count gate enough distinct sources", () => {
    for (const gate of QUANTITY_GATES) {
      const sources = nodesGranting(PROGRESSION_NODES, gate.itemId);
      expect(
        sources.length,
        `${gate.itemId} needs ${gate.count} for ${gate.gate}`,
      ).toBeGreaterThanOrEqual(gate.minimumDistinctSources);
    }
  });

  it("pins the tokens that only a one-time chest can yield", () => {
    expect(oneTimeOnlyTokens(PROGRESSION_NODES, "built")).toEqual(
      ONE_TIME_ONLY_BUILT_TOKENS.slice().sort(),
    );
  });
});

describe("unimplemented guaranteed sources", () => {
  it("keeps the real gap inside the documented pending list", () => {
    const pending = guaranteedItemsWithoutBuiltSource(PROGRESSION_NODES);

    for (const itemId of pending) {
      expect(
        PENDING_GUARANTEED_ITEMS,
        `${itemId} has no shipping source and is not documented as pending`,
      ).toContain(itemId);
    }
  });

  it("only ever parks planned matrix rows in the pending list", () => {
    for (const itemId of PENDING_GUARANTEED_ITEMS) {
      const item = GUARANTEED_ITEMS.find(
        (candidate) => candidate.itemId === itemId,
      );
      expect(item?.status).toBe("planned");
      expect(
        nodesGranting(PROGRESSION_NODES, itemId).length,
        `${itemId} has no declared source at all`,
      ).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Negative cases. A closure test that cannot fail is worthless.
// ---------------------------------------------------------------------------

describe("closure failure detection", () => {
  it("refuses to remove a rule that does not exist", () => {
    expect(() => withoutNodes(PROGRESSION_NODES, ["loot:nowhere"])).toThrow(
      "Cannot remove unknown progression rule loot:nowhere.",
    );
  });

  it("fails when the Ember Outpost guaranteed loot is removed", () => {
    const broken = withoutNodes(PROGRESSION_NODES, ["loot:ember_outpost"]);
    const missing = missingGuaranteedItems(broken, "built");

    expect(missing).toContain(IDENTIFIERS.aetherCrystal);
    expect(missing).toContain(IDENTIFIERS.aetherEngine);
    expect(missing).toContain(IDENTIFIERS.navigatorModule);
    expect(missing).toContain(IDENTIFIERS.froststeelIngot);
    expect(missing).toContain(IDENTIFIERS.raiderCore);
    expect(missing).toContain(IDENTIFIERS.shieldProjector);
    expect(missing.length).toBeGreaterThan(6);
  });

  it("fails when a single starter recipe is removed", () => {
    const broken = withoutNodes(PROGRESSION_NODES, [
      `craft:${IDENTIFIERS.shipCore}`,
    ]);
    const missing = missingGuaranteedItems(broken, "built");

    expect(missing).toContain(IDENTIFIERS.shipCore);
    expect(missing).toContain(IDENTIFIERS.aetherCrystal);
    expect(missing).toContain(IDENTIFIERS.froststeelIngot);
  });

  it("reports the fallback Ashfall source cycle when Ember loot is removed", () => {
    const broken = nodesInScope(
      withoutNodes(PROGRESSION_NODES, ["loot:ember_outpost"]),
      "built",
    );
    expect(findGateCycle(broken, IDENTIFIERS.aetherCrystal)).toBeDefined();
  });

  it("ignores benign cycles around an already reachable item", () => {
    // Verdant Hollow oak logs depend on a skiff, which depends on oak logs —
    // a real cycle, but harmless because the home island also yields logs.
    const declared = nodesInScope(PROGRESSION_NODES, "declared");
    expect(findGateCycle(declared, "minecraft:oak_log")).toBeUndefined();
  });

  it("reports an injected circular gate with a readable path", () => {
    const circular = PROGRESSION_NODES.map((rule) =>
      rule.id === "travel:frostspire"
        ? {
            ...rule,
            requires: [...rule.requires, IDENTIFIERS.froststeelIngot],
          }
        : rule,
    );

    expect(missingGuaranteedItems(circular, "built")).toContain(
      IDENTIFIERS.froststeelIngot,
    );

    const cycle = findGateCycle(
      nodesInScope(circular, "built"),
      IDENTIFIERS.froststeelIngot,
    );
    expect(cycle).toBeDefined();

    const path = formatGateCycle(cycle!);
    expect(path).toContain("loot:frostspire");
    expect(path).toContain("travel:frostspire");
    expect(path.indexOf(IDENTIFIERS.froststeelIngot)).toBe(0);
    expect(path.lastIndexOf(IDENTIFIERS.froststeelIngot)).toBeGreaterThan(0);

    const failures = islandSelfGateFailures(circular, "built");
    expect(failures.map((failure) => failure.islandId)).toContain("frostspire");
  });

  it("detects an island gated on its own loot", () => {
    const selfGated = PROGRESSION_NODES.map((rule) =>
      rule.id === "travel:ember_outpost"
        ? { ...rule, requires: [...rule.requires, IDENTIFIERS.aetherCrystal] }
        : rule,
    );
    const failures = islandSelfGateFailures(selfGated, "built");

    expect(failures.map((failure) => failure.islandId)).toContain(
      "ember_outpost",
    );
    expect(failures[0].reason).toContain("access:ember_outpost");
  });
});
