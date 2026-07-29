import {
  EMBER_OUTPOST,
  FROSTSPIRE,
  IDENTIFIERS,
  STARTER_ISLAND,
} from "../config/constants";

export const DEVELOPER_TEST_ENTITY_TAG = "skyknights.dev_test_setup";
export const DEVELOPER_TEST_SETUP_TIMEOUT_TICKS = 20 * 60;
export const DEVELOPER_TEST_ARRIVAL_SAFETY_RADIUS = 64;

export type DeveloperTestCraftId =
  "skiff" | "skycutter" | "aether_outrigger" | "steampunk_blimp";

export interface DeveloperTestCraftPlacement {
  readonly id: DeveloperTestCraftId;
  readonly typeId: string;
  readonly location: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly clearance: {
    readonly horizontalRadius: number;
    readonly height: number;
  };
}

export interface DeveloperTestRouteStop {
  readonly id: "starter_island" | "ember_outpost" | "frostspire";
  readonly label: string;
  readonly location: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
}

function inspectionPoint(island: {
  readonly origin: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  };
  readonly size: { readonly x: number; readonly y: number; readonly z: number };
}): { x: number; y: number; z: number } {
  return {
    x: island.origin.x + Math.floor(island.size.x / 2),
    y: island.origin.y + island.size.y + 4,
    z: island.origin.z + Math.floor(island.size.z / 2),
  };
}

/**
 * Fixed starter-realm developer setup.
 *
 * The mobile craft float above the authored dock and do not require new
 * blocks. The hostile Raider sits in a separate lane more than 64 blocks from
 * the landing point so setup does not immediately turn into combat.
 */
export const DEVELOPER_TEST_SETUP = {
  dimensionId: STARTER_ISLAND.dimensionId,
  landing: {
    x: STARTER_ISLAND.safeDock.x,
    y: STARTER_ISLAND.safeDock.y + 1,
    z: STARTER_ISLAND.safeDock.z,
  },
  craft: [
    {
      id: "skiff",
      typeId: IDENTIFIERS.skiff,
      location: { x: 24.5, y: 164, z: -7.5 },
      clearance: { horizontalRadius: 2, height: 3 },
    },
    {
      id: "skycutter",
      typeId: IDENTIFIERS.skycutter,
      location: { x: 46.5, y: 164, z: 8.5 },
      clearance: { horizontalRadius: 3, height: 3 },
    },
    {
      id: "aether_outrigger",
      typeId: IDENTIFIERS.aetherOutrigger,
      location: { x: 5.5, y: 170, z: -18.5 },
      clearance: { horizontalRadius: 3, height: 4 },
    },
    {
      id: "steampunk_blimp",
      typeId: IDENTIFIERS.steampunkBlimp,
      location: { x: 5.5, y: 174, z: 20.5 },
      clearance: { horizontalRadius: 3, height: 4 },
    },
  ] as const satisfies readonly DeveloperTestCraftPlacement[],
  raider: {
    dimensionId: STARTER_ISLAND.dimensionId,
    x: 54,
    y: 176,
    z: 54,
    clearance: { horizontalRadius: 2, height: 4 },
  },
  route: [
    {
      id: "starter_island",
      label: "Starter Island",
      location: inspectionPoint(STARTER_ISLAND),
    },
    {
      id: "ember_outpost",
      label: "Ember Outpost",
      location: inspectionPoint(EMBER_OUTPOST),
    },
    {
      id: "frostspire",
      label: "Frostspire",
      location: inspectionPoint(FROSTSPIRE),
    },
  ] as const satisfies readonly DeveloperTestRouteStop[],
} as const;
