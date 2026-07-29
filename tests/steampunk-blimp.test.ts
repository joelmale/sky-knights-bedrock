import { describe, expect, it } from "vitest";

import { IDENTIFIERS } from "../scripts/config/constants";

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const BEHAVIOR_SOURCES: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/entities/steampunk_blimp.json",
  { eager: true, query: "?raw", import: "default" },
);
// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const CLIENT_SOURCES: Record<string, string> = import.meta.glob(
  "../resource_packs/sk_rp/entity/steampunk_blimp.entity.json",
  { eager: true, query: "?raw", import: "default" },
);
// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const ANIMATION_SOURCES: Record<string, string> = import.meta.glob(
  "../resource_packs/sk_rp/animations/steampunk_blimp.animation.json",
  { eager: true, query: "?raw", import: "default" },
);
// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const GEOMETRY_SOURCES: Record<string, string> = import.meta.glob(
  "../resource_packs/sk_rp/models/entity/steampunk_blimp.geo.json",
  { eager: true, query: "?raw", import: "default" },
);
// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const TEXTURE_URLS: Record<string, string> = import.meta.glob(
  "../resource_packs/sk_rp/textures/entity/skyknights/steampunk_blimp.png",
  { eager: true, query: "?url", import: "default" },
);
// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const COMMAND_SOURCES: Record<string, string> = import.meta.glob(
  "../scripts/diagnostics/commands.ts",
  { eager: true, query: "?raw", import: "default" },
);
// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const VALIDATION_SOURCES: Record<string, string> = import.meta.glob(
  "../scripts/bootstrap/validation.ts",
  { eager: true, query: "?raw", import: "default" },
);
// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const LANGUAGE_SOURCES: Record<string, string> = import.meta.glob(
  "../resource_packs/sk_rp/texts/en_US.lang",
  { eager: true, query: "?raw", import: "default" },
);

const GEOMETRY_IDENTIFIER = "geometry.skyknights.steampunk_blimp";
const TEXTURE_PATH = "textures/entity/skyknights/steampunk_blimp";
const PROPELLER_ANIMATION = "animation.skyknights.steampunk_blimp.propellers";

function onlyValue(sources: Record<string, string>): string {
  const keys = Object.keys(sources);
  if (keys.length !== 1) {
    throw new Error(`Expected exactly one asset, found ${keys.length}.`);
  }
  return sources[keys[0]];
}

describe("Steampunk Blimp prototype assets", () => {
  const behavior = JSON.parse(onlyValue(BEHAVIOR_SOURCES));
  const client = JSON.parse(onlyValue(CLIENT_SOURCES));
  const animationDocument = JSON.parse(onlyValue(ANIMATION_SOURCES));

  it("binds the summon-only behavior and client assets consistently", () => {
    const behaviorDescription = behavior["minecraft:entity"].description;
    const clientDescription = client["minecraft:client_entity"].description;

    expect(behaviorDescription).toMatchObject({
      identifier: IDENTIFIERS.steampunkBlimp,
      is_spawnable: false,
      is_summonable: true,
    });
    expect(clientDescription.identifier).toBe(IDENTIFIERS.steampunkBlimp);
    expect(clientDescription.geometry.default).toBe(GEOMETRY_IDENTIFIER);
    expect(clientDescription.textures.default).toBe(TEXTURE_PATH);
    expect(clientDescription.render_controllers).toEqual([
      "controller.render.default",
    ]);
  });

  it("uses a slow, durable, four-seat air-controlled flight contract", () => {
    const components = behavior["minecraft:entity"].components;
    const rideable = components["minecraft:rideable"];

    expect(components["minecraft:physics"]).toEqual({
      has_gravity: false,
      has_collision: true,
    });
    expect(components["minecraft:can_fly"]).toEqual({});
    expect(components["minecraft:movement"].value).toBe(0.12);
    expect(components["minecraft:flying_speed"].value).toBe(0.12);
    expect(components["minecraft:health"]).toEqual({
      value: 150,
      max: 150,
    });
    // Bedrock exposes one symmetric horizontal width. This covers the central
    // gondola while avoiding a much larger invisible wall around the engines.
    expect(components["minecraft:collision_box"]).toEqual({
      width: 5.6,
      height: 3,
    });
    expect(rideable.seat_count).toBe(4);
    expect(rideable.controlling_seat).toBe(0);
    expect(rideable.seats).toHaveLength(4);
    expect(rideable).not.toHaveProperty("dismount_mode");

    // Geometry coordinates are pixels. The solid cabin spans x=-10..10,
    // y=11..23, z=-4..19; every seat instead belongs on the open bow deck
    // ahead of z=-7.5.
    const cabin = {
      minX: -10 / 16,
      maxX: 10 / 16,
      minY: 11 / 16,
      maxY: 23 / 16,
      minZ: -4 / 16,
      maxZ: 19 / 16,
    };
    const bowDeckLimitZ = -7.5 / 16;
    for (const seat of rideable.seats) {
      const [x, y, z] = seat.position;
      const embeddedInCabin =
        x >= cabin.minX &&
        x <= cabin.maxX &&
        y >= cabin.minY &&
        y <= cabin.maxY &&
        z >= cabin.minZ &&
        z <= cabin.maxZ;
      expect(z).toBeLessThan(bowDeckLimitZ);
      expect(embeddedInCabin).toBe(false);
    }
    expect(components["minecraft:behavior.player_ride_tamed"]).toEqual({
      priority: 0,
    });
    expect(components["minecraft:pushable"]).toEqual({
      is_pushable: false,
      is_pushable_by_piston: false,
    });
    expect(components).toHaveProperty("minecraft:persistent");
    expect(components).toHaveProperty("minecraft:nameable");
  });

  it("continuously counter-rotates both frozen propeller bones", () => {
    const clientDescription = client["minecraft:client_entity"].description;
    const animation = animationDocument.animations[PROPELLER_ANIMATION];

    expect(clientDescription.animations.propellers).toBe(PROPELLER_ANIMATION);
    expect(clientDescription.scripts.animate).toContain("propellers");
    expect(animation.loop).toBe(true);
    expect(animation.animation_length).toBe(1);
    expect(animation.bones.propeller_left.rotation).toEqual([
      0,
      0,
      "query.anim_time * 720.0",
    ]);
    expect(animation.bones.propeller_right.rotation).toEqual([
      0,
      0,
      "query.anim_time * -720.0",
    ]);
  });

  it("resolves the frozen geometry, bones, and external texture", () => {
    const geometry = JSON.parse(onlyValue(GEOMETRY_SOURCES));
    const document = geometry["minecraft:geometry"][0];
    const boneNames = document.bones.map((bone: { name: string }) => bone.name);

    expect(document.description).toMatchObject({
      identifier: GEOMETRY_IDENTIFIER,
      texture_width: 256,
      texture_height: 256,
      visible_bounds_width: 12,
      visible_bounds_height: 10,
      visible_bounds_offset: [0, 5, 0],
    });
    expect(boneNames).toEqual(
      expect.arrayContaining([
        "root",
        "balloon",
        "tail_fins",
        "gondola",
        "engine_left",
        "engine_right",
        "propeller_left",
        "propeller_right",
      ]),
    );
    expect(Object.keys(TEXTURE_URLS)).toHaveLength(1);
  });

  it("registers startup validation, localization, and the developer command", () => {
    expect(onlyValue(VALIDATION_SOURCES)).toContain(
      "IDENTIFIERS.steampunkBlimp",
    );
    expect(onlyValue(COMMAND_SOURCES)).toContain('name: "skyknights:blimp"');
    expect(onlyValue(COMMAND_SOURCES)).toContain(
      "type: IDENTIFIERS.steampunkBlimp",
    );
    expect(onlyValue(LANGUAGE_SOURCES)).toContain(
      "entity.skyknights:steampunk_blimp.name=Steampunk Blimp",
    );
  });
});
