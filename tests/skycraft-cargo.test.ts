import { describe, expect, it } from "vitest";

import {
  availableFlightMass,
  canLoadCargo,
  cargoLoad,
  cargoPermission,
} from "../scripts/skycraft/cargo";

describe("Skycraft cargo authority and reserved mass", () => {
  const manifest = {
    authority: "crew_load" as const,
    capacitySlots: 2,
    reservedMassSubunits: 8,
    stacks: [{ itemId: "minecraft:iron_ingot", count: 4, unitMassSubunits: 2 }],
  };

  it("keeps cargo authority distinct from piloting", () => {
    expect(cargoPermission(manifest.authority, "pilot")).toBe("load");
    expect(cargoPermission(manifest.authority, "guest")).toBe("none");
    expect(
      canLoadCargo(manifest, "guest", {
        itemId: "minecraft:coal",
        count: 1,
        unitMassSubunits: 1,
      }),
    ).toBe(false);
  });

  it("accounts for manifest and reserved mass before flight", () => {
    expect(cargoLoad(manifest)).toMatchObject({
      cargoMassSubunits: 8,
      totalMassSubunits: 16,
      withinCapacity: true,
    });
    expect(availableFlightMass(100, 70, manifest)).toBe(14);
  });
});
