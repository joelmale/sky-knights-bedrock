import { describe, expect, it } from "vitest";

import { IDENTIFIERS } from "../scripts/config/constants";

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const BEHAVIOR_SOURCES: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/entities/aether_outrigger.json",
  { eager: true, query: "?raw", import: "default" },
);
// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const CLIENT_SOURCES: Record<string, string> = import.meta.glob(
  "../resource_packs/sk_rp/entity/aether_outrigger.entity.json",
  { eager: true, query: "?raw", import: "default" },
);
// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const GEOMETRY_SOURCES: Record<string, string> = import.meta.glob(
  "../resource_packs/sk_rp/models/entity/aether_outrigger.geo.json",
  { eager: true, query: "?raw", import: "default" },
);
// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const BLOCKBENCH_SOURCES: Record<string, string> = import.meta.glob(
  "../art_source/blockbench/aether_outrigger.geo.bbmodel",
  { eager: true, query: "?raw", import: "default" },
);
// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const TEXTURE_URLS: Record<string, string> = import.meta.glob(
  "../resource_packs/sk_rp/textures/entity/skyknights/aether_outrigger.png",
  { eager: true, query: "?url", import: "default" },
);

function onlyValue(sources: Record<string, string>): string {
  const keys = Object.keys(sources);
  if (keys.length !== 1) {
    throw new Error(`Expected exactly one asset, found ${keys.length}.`);
  }
  return sources[keys[0]];
}

describe("Aether Outrigger prototype assets", () => {
  const behavior = JSON.parse(onlyValue(BEHAVIOR_SOURCES));
  const client = JSON.parse(onlyValue(CLIENT_SOURCES));
  const geometry = JSON.parse(onlyValue(GEOMETRY_SOURCES));
  const blockbench = JSON.parse(onlyValue(BLOCKBENCH_SOURCES));

  it("binds the behavior, client, geometry, and embedded texture consistently", () => {
    expect(behavior["minecraft:entity"].description.identifier).toBe(
      IDENTIFIERS.aetherOutrigger,
    );
    expect(client["minecraft:client_entity"].description.identifier).toBe(
      IDENTIFIERS.aetherOutrigger,
    );
    expect(client["minecraft:client_entity"].description.geometry.default).toBe(
      "geometry.skyknights.aether_outrigger",
    );
    expect(client["minecraft:client_entity"].description.textures.default).toBe(
      "textures/entity/skyknights/aether_outrigger",
    );
    expect(geometry["minecraft:geometry"][0].description.identifier).toBe(
      "geometry.skyknights.aether_outrigger",
    );
    expect(Object.keys(TEXTURE_URLS)).toHaveLength(1);
    expect(blockbench.resolution).toEqual({ width: 256, height: 256 });
    expect(blockbench.textures[0].source).toMatch(/^data:image\/png;base64,/u);
  });

  it("uses the tested non-gravity two-seat flight contract", () => {
    const components = behavior["minecraft:entity"].components;
    expect(components["minecraft:physics"]).toEqual({
      has_gravity: false,
      has_collision: true,
    });
    expect(components["minecraft:can_fly"]).toEqual({});
    expect(components["minecraft:rideable"].seat_count).toBe(2);
    expect(components["minecraft:rideable"].controlling_seat).toBe(0);
    expect(components["minecraft:rideable"].seats).toHaveLength(2);
    expect(components["minecraft:pushable"]).toEqual({
      is_pushable: false,
      is_pushable_by_piston: false,
    });
    expect(components["minecraft:behavior.player_ride_tamed"]).toEqual({
      priority: 0,
    });
  });

  it("exports the doubled hull and an aft, eye-line-clearing sail", () => {
    const document = geometry["minecraft:geometry"][0];
    expect(document.description).toMatchObject({
      visible_bounds_width: 14,
      visible_bounds_height: 12,
      visible_bounds_offset: [0, 5, 0],
    });

    const bones = new Map<string, any>(
      document.bones.map((bone: { name: string }) => [bone.name, bone]),
    );
    expect([...bones.keys()]).toEqual(
      expect.arrayContaining([
        "hull",
        "engine_block",
        "lift_pod_left",
        "lift_pod_right",
        "mast",
        "sail",
      ]),
    );
    expect(bones.get("mast")).not.toHaveProperty("rotation");
    expect(bones.get("sail").cubes).toEqual([
      { origin: [-22, 56, 14], size: [44, 20, 4], uv: [92, 0] },
      { origin: [-22, 76, 14], size: [44, 12, 4], uv: [92, 20] },
      { origin: [-22, 44, 14], size: [44, 12, 4], uv: [92, 28] },
    ]);
    expect(bones.get("lift_pod_left").cubes[2]).toMatchObject({
      origin: [-38, 4, 0],
      size: [12, 12, 38],
    });
    expect(bones.get("lift_pod_right").cubes[2]).toMatchObject({
      origin: [26, 4, 0],
      size: [12, 12, 38],
    });

    const cubes = document.bones.flatMap(
      (bone: { cubes?: Array<{ origin: number[]; size: number[] }> }) =>
        bone.cubes ?? [],
    );
    const extents = cubes.reduce(
      (
        result: { min: number[]; max: number[] },
        cube: { origin: number[]; size: number[] },
      ) => ({
        min: result.min.map((value, axis) =>
          Math.min(value, cube.origin[axis]),
        ),
        max: result.max.map((value, axis) =>
          Math.max(value, cube.origin[axis] + cube.size[axis]),
        ),
      }),
      {
        min: [
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY,
          Number.POSITIVE_INFINITY,
        ],
        max: [
          Number.NEGATIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
          Number.NEGATIVE_INFINITY,
        ],
      },
    );
    expect(extents).toEqual({
      min: [-40, 0, -58],
      max: [40, 90, 52],
    });
  });
});
