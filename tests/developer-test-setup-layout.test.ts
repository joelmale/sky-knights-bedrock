import { describe, expect, it } from "vitest";

import {
  COMBAT,
  IDENTIFIERS,
  STARTER_ISLAND,
  VOID_RESCUE_Y,
} from "../scripts/config/constants";
import {
  DEVELOPER_TEST_ARRIVAL_SAFETY_RADIUS,
  DEVELOPER_TEST_ENTITY_TAG,
  DEVELOPER_TEST_SETUP,
} from "../scripts/gameplay/developer-test-setup-layout";
import { SKYCRAFT_BERTHS } from "../scripts/skycraft/berths";
import { REFERENCE_BLUEPRINTS } from "../scripts/skycraft/catalog";

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const COMMAND_MODULES: Record<string, string> = import.meta.glob(
  "../scripts/diagnostics/commands.ts",
  {
    eager: true,
    query: "?raw",
    import: "default",
  },
);
const COMMAND_SOURCE = COMMAND_MODULES[Object.keys(COMMAND_MODULES)[0]];

function distanceSquared(
  left: { x: number; y: number; z: number },
  right: { x: number; y: number; z: number },
): number {
  const dx = left.x - right.x;
  const dy = left.y - right.y;
  const dz = left.z - right.z;
  return dx * dx + dy * dy + dz * dz;
}

describe("developer test setup layout", () => {
  it("registers one cheat-gated player command for the setup runtime", () => {
    expect(
      COMMAND_SOURCE.match(/name: "skyknights:test_setup"/gu),
    ).toHaveLength(1);
    expect(COMMAND_SOURCE).toContain("prepareDeveloperTestSetup(");
    expect(COMMAND_SOURCE).toContain(
      "permissionLevel: CommandPermissionLevel.GameDirectors",
    );
    expect(COMMAND_SOURCE).toContain("cheatsRequired: true");
  });

  it("uses one unique placement for every shipped mobile craft", () => {
    expect(DEVELOPER_TEST_SETUP.craft.map((craft) => craft.typeId)).toEqual([
      IDENTIFIERS.skiff,
      IDENTIFIERS.skycutter,
      IDENTIFIERS.aetherOutrigger,
      IDENTIFIERS.steampunkBlimp,
    ]);

    const positions = DEVELOPER_TEST_SETUP.craft.map(
      (craft) => `${craft.location.x},${craft.location.y},${craft.location.z}`,
    );
    expect(new Set(positions).size).toBe(positions.length);
  });

  it("keeps clearances outside authored starter-island structure bytes", () => {
    const starterMin = STARTER_ISLAND.origin;
    const starterMax = {
      x: starterMin.x + STARTER_ISLAND.size.x - 1,
      y: starterMin.y + STARTER_ISLAND.size.y - 1,
      z: starterMin.z + STARTER_ISLAND.size.z - 1,
    };

    for (const craft of DEVELOPER_TEST_SETUP.craft) {
      const min = {
        x: Math.floor(craft.location.x) - craft.clearance.horizontalRadius,
        y: Math.floor(craft.location.y),
        z: Math.floor(craft.location.z) - craft.clearance.horizontalRadius,
      };
      const max = {
        x: Math.floor(craft.location.x) + craft.clearance.horizontalRadius,
        y: min.y + craft.clearance.height - 1,
        z: Math.floor(craft.location.z) + craft.clearance.horizontalRadius,
      };
      const intersectsStarter =
        min.x <= starterMax.x &&
        max.x >= starterMin.x &&
        min.y <= starterMax.y &&
        max.y >= starterMin.y &&
        min.z <= starterMax.z &&
        max.z >= starterMin.z;

      expect(intersectsStarter, craft.id).toBe(false);
      expect(min.y).toBeGreaterThan(VOID_RESCUE_Y);
    }
  });

  it("keeps the staged fleet outside every Skycraft construction berth", () => {
    for (const craft of DEVELOPER_TEST_SETUP.craft) {
      const craftMin = {
        x: Math.floor(craft.location.x) - craft.clearance.horizontalRadius,
        y: Math.floor(craft.location.y),
        z: Math.floor(craft.location.z) - craft.clearance.horizontalRadius,
      };
      const craftMax = {
        x: Math.floor(craft.location.x) + craft.clearance.horizontalRadius,
        y: craftMin.y + craft.clearance.height - 1,
        z: Math.floor(craft.location.z) + craft.clearance.horizontalRadius,
      };

      for (const definition of SKYCRAFT_BERTHS) {
        const berthMin = definition.berth.origin;
        const berthMax = {
          x: berthMin.x + definition.berth.size.x - 1,
          y: berthMin.y + definition.berth.size.y - 1,
          z: berthMin.z + definition.berth.size.z - 1,
        };
        const intersectsBerth =
          craftMin.x <= berthMax.x &&
          craftMax.x >= berthMin.x &&
          craftMin.y <= berthMax.y &&
          craftMax.y >= berthMin.y &&
          craftMin.z <= berthMax.z &&
          craftMax.z >= berthMin.z;

        expect(intersectsBerth, `${craft.id}: ${definition.berth.id}`).toBe(
          false,
        );
      }
    }
  });

  it("puts the Raider away from arrival but inside Skycutter cannon range", () => {
    const skycutter = DEVELOPER_TEST_SETUP.craft.find(
      (craft) => craft.id === "skycutter",
    )!;
    const raider = DEVELOPER_TEST_SETUP.raider;

    expect(
      distanceSquared(DEVELOPER_TEST_SETUP.landing, raider),
    ).toBeGreaterThan(
      DEVELOPER_TEST_ARRIVAL_SAFETY_RADIUS *
        DEVELOPER_TEST_ARRIVAL_SAFETY_RADIUS,
    );
    expect(distanceSquared(skycutter.location, raider)).toBeLessThan(
      COMBAT.cannonRange * COMBAT.cannonRange,
    );
  });

  it("advertises the fixed authored-island route and all references", () => {
    expect(DEVELOPER_TEST_SETUP.route.map((stop) => stop.id)).toEqual([
      "starter_island",
      "ember_outpost",
      "frostspire",
    ]);
    expect(REFERENCE_BLUEPRINTS).toHaveLength(8);
    expect(DEVELOPER_TEST_ENTITY_TAG).toBe("skyknights.dev_test_setup");
  });
});
