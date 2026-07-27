import { describe, expect, it } from "vitest";

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const RECIPE_SOURCES: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/recipes/*.json",
  { eager: true, query: "?raw", import: "default" },
);

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const GAMETEST_MANIFEST_SOURCES: Record<string, string> = import.meta.glob(
  "../profiles/gametest/behavior_pack/manifest.json",
  { eager: true, query: "?raw", import: "default" },
);

function onlyValue(sources: Record<string, string>): string {
  const keys = Object.keys(sources);

  if (keys.length !== 1) {
    throw new Error(`Expected one source, found ${keys.length}.`);
  }

  return sources[keys[0] ?? ""] ?? "";
}

describe("BDS content contracts", () => {
  it("uses the BDS-supported GameTest module dependency", () => {
    const manifest = JSON.parse(onlyValue(GAMETEST_MANIFEST_SOURCES)) as {
      dependencies: Array<{ module_name?: string; version?: string }>;
    };
    const gameTest = manifest.dependencies.find(
      (dependency) => dependency.module_name === "@minecraft/server-gametest",
    );

    expect(gameTest?.version).toBe("1.0.0-beta");
  });

  it("uses the context-object form for always-unlocked recipes", () => {
    expect(Object.keys(RECIPE_SOURCES).length).toBeGreaterThan(0);

    for (const file of Object.keys(RECIPE_SOURCES)) {
      const source = RECIPE_SOURCES[file] ?? "";
      const document = JSON.parse(source) as Record<
        string,
        { unlock?: unknown } | string
      >;
      const recipeKey = Object.keys(document).find(
        (key) => typeof document[key] === "object" && document[key] !== null,
      );
      const recipe = recipeKey
        ? (document[recipeKey] as { unlock?: unknown })
        : undefined;

      expect(recipe, file).toBeDefined();
      expect(recipe?.unlock, file).toEqual({
        context: "AlwaysUnlocked",
      });
    }
  });
});
