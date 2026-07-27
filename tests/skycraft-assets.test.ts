import { describe, expect, it } from "vitest";
import {
  SKYCRAFT_COMPONENT_IDS,
  SKYCRAFT_IDS,
} from "../scripts/skycraft/config";

// @ts-expect-error Vite injects import.meta.glob.
const BLOCK_SOURCES: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/blocks/*.json",
  { eager: true, query: "?raw", import: "default" },
);

// @ts-expect-error Vite injects import.meta.glob.
const RECIPE_SOURCES: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/recipes/skycraft_*.json",
  { eager: true, query: "?raw", import: "default" },
);

// @ts-expect-error Vite injects import.meta.glob.
const TERRAIN_SOURCES: Record<string, string> = import.meta.glob(
  "../resource_packs/sk_rp/terrain_texture.json",
  { eager: true, query: "?raw", import: "default" },
);

// @ts-expect-error Vite injects import.meta.glob.
const BLOCK_SOUND_SOURCES: Record<string, string> = import.meta.glob(
  "../resource_packs/sk_rp/blocks.json",
  { eager: true, query: "?raw", import: "default" },
);

// @ts-expect-error Vite injects import.meta.glob.
const FLIGHT_ENTITY_SOURCES: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/entities/airship_flight.json",
  { eager: true, query: "?raw", import: "default" },
);

// @ts-expect-error Vite injects import.meta.glob.
const LANGUAGE_SOURCES: Record<string, string> = import.meta.glob(
  "../resource_packs/sk_rp/texts/en_US.lang",
  { eager: true, query: "?raw", import: "default" },
);

const SKYCRAFT_BLOCK_IDS = [
  "skyknights:basic_helm",
  "skyknights:reinforced_helm",
  "skyknights:ship_core_block",
  "skyknights:lift_sail",
  "skyknights:coal_thruster",
  "skyknights:braced_frame",
  "skyknights:rudder",
  "skyknights:airbag",
  "skyknights:dirigible_propeller",
  "skyknights:aether_lift_cell",
  "skyknights:aether_thruster",
  "skyknights:frostfire_thruster",
  "skyknights:stabilizer",
  "skyknights:cargo_rack",
  "skyknights:crew_seat",
  "skyknights:repair_station",
  "skyknights:cannon_hardpoint",
  "skyknights:shield_hardpoint",
] as const;

const ORIENTED = new Set([
  "skyknights:basic_helm",
  "skyknights:reinforced_helm",
  "skyknights:rudder",
  "skyknights:crew_seat",
  "skyknights:cannon_hardpoint",
]);
const DIRECTIONAL_ENGINES = new Set([
  "skyknights:coal_thruster",
  "skyknights:dirigible_propeller",
  "skyknights:aether_thruster",
  "skyknights:frostfire_thruster",
]);

function onlySource(sources: Record<string, string>): string {
  const values = Object.keys(sources).map((key) => sources[key]);
  expect(values).toHaveLength(1);
  return values[0];
}

function recipeOutput(source: string): string {
  const recipe = JSON.parse(source) as Record<string, Record<string, unknown>>;
  const body =
    recipe["minecraft:recipe_shaped"] ?? recipe["minecraft:recipe_shapeless"];
  const result = body.result as { item: string };
  return result.item;
}

const blocks = Object.keys(BLOCK_SOURCES).map((key) => {
  const source = BLOCK_SOURCES[key];
  return JSON.parse(source) as {
    "minecraft:block": {
      description: {
        identifier: string;
        menu_category?: { category: string; group?: string };
        traits?: Record<string, { enabled_states: string[] }>;
      };
      components: Record<string, unknown>;
    };
  };
});

describe("Skycraft block content contract", () => {
  it("ships exactly the agreed stable Skycraft block IDs", () => {
    expect(
      blocks
        .map((block) => block["minecraft:block"].description.identifier)
        .sort(),
    ).toEqual([...SKYCRAFT_BLOCK_IDS].sort());
    expect([...SKYCRAFT_COMPONENT_IDS].sort()).toEqual(
      [...SKYCRAFT_BLOCK_IDS].sort(),
    );
  });

  it("uses namespaced creative groups accepted by dedicated servers", () => {
    for (const block of blocks) {
      const menu = block["minecraft:block"].description.menu_category;
      expect(menu?.category).toBe("construction");
      expect(menu?.group).toMatch(/^[^:]+:[^:]+$/u);
    }
  });

  it("uses full-block geometry, materials, and physical bounds", () => {
    for (const block of blocks) {
      const components = block["minecraft:block"].components;
      expect(components["minecraft:geometry"]).toBe(
        "minecraft:geometry.full_block",
      );
      expect(components["minecraft:material_instances"]).toBeDefined();
      expect(components["minecraft:collision_box"]).toBe(true);
      expect(components["minecraft:selection_box"]).toBe(true);
      expect(components["minecraft:sound"]).toBeUndefined();
      expect(components["minecraft:destructible_by_mining"]).toBeDefined();
      expect(components["minecraft:destructible_by_explosion"]).toBeDefined();
    }
  });

  it("gives control and propulsion blocks stable placement-direction traits", () => {
    for (const block of blocks) {
      const description = block["minecraft:block"].description;
      const states =
        description.traits?.["minecraft:placement_direction"]?.enabled_states ??
        [];
      if (ORIENTED.has(description.identifier)) {
        expect(states).toContain("minecraft:cardinal_direction");
      }
      if (DIRECTIONAL_ENGINES.has(description.identifier)) {
        expect(states).toContain("minecraft:cardinal_direction");
        expect(states).toContain("minecraft:facing_direction");
      }
    }
  });

  it("does not introduce experimental block entities or dynamic properties", () => {
    for (const key of Object.keys(BLOCK_SOURCES)) {
      const source = BLOCK_SOURCES[key];
      expect(source).not.toContain("block_entity");
      expect(source).not.toContain("dynamic_properties");
      expect(source).not.toContain("experimental");
    }
  });

  it("localizes every placed component and the non-summonable flight proxy", () => {
    const language = onlySource(LANGUAGE_SOURCES);
    for (const id of SKYCRAFT_BLOCK_IDS) {
      expect(language).toContain(`tile.${id}.name=`);
    }

    const entity = JSON.parse(onlySource(FLIGHT_ENTITY_SOURCES)) as {
      "minecraft:entity": {
        description: {
          identifier: string;
          is_summonable: boolean;
        };
        events: Record<string, unknown>;
      };
    };
    expect(entity["minecraft:entity"].description.identifier).toBe(
      SKYCRAFT_IDS.flightEntity,
    );
    expect(entity["minecraft:entity"].description.is_summonable).toBe(false);
    expect(language).toContain(`entity.${SKYCRAFT_IDS.flightEntity}.name=`);
    expect(Object.keys(entity["minecraft:entity"].events)).toEqual(
      expect.arrayContaining([
        "skyknights:configure_apprentice",
        "skyknights:configure_masterwork",
        "skyknights:visual_minnow",
        "skyknights:visual_grand",
      ]),
    );
  });
});

describe("Skycraft recipes and resource textures", () => {
  it("has one always-unlocked recipe for every Skycraft block", () => {
    const outputs = Object.keys(RECIPE_SOURCES).map((key) => {
      const source = RECIPE_SOURCES[key];
      const recipe = JSON.parse(source) as Record<
        string,
        Record<string, unknown>
      >;
      const body =
        recipe["minecraft:recipe_shaped"] ??
        recipe["minecraft:recipe_shapeless"];
      expect(body.unlock).toEqual({ context: "AlwaysUnlocked" });
      return recipeOutput(source);
    });
    expect(outputs.sort()).toEqual([...SKYCRAFT_BLOCK_IDS].sort());
  });

  it("registers every material alias and an explicit blocks.json sound entry", () => {
    const terrain = JSON.parse(onlySource(TERRAIN_SOURCES)) as {
      texture_data: Record<string, unknown>;
    };
    const sounds = JSON.parse(onlySource(BLOCK_SOUND_SOURCES)) as Record<
      string,
      { sound: string }
    >;
    for (const block of blocks) {
      const id = block["minecraft:block"].description.identifier;
      const material = block["minecraft:block"].components[
        "minecraft:material_instances"
      ] as Record<string, { texture: string }>;
      expect(terrain.texture_data[material["*"].texture]).toBeDefined();
      expect(sounds[id]?.sound).toEqual(expect.any(String));
    }
  });
});
