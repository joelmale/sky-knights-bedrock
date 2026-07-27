import { describe, expect, it } from "vitest";

import {
  IDENTIFIERS,
  STARTER_ISLAND,
  TEST_BENCH,
} from "../scripts/config/constants";
import {
  markTestBenchStall,
  parseTestBenchState,
  planTestBench,
  unmarkTestBenchStall,
} from "../scripts/gameplay/testbench-layout";

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const ITEM_SOURCES: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/items/*.json",
  { eager: true, query: "?raw", import: "default" },
);

function itemStackLimits(): Readonly<Record<string, number>> {
  const limits: Record<string, number> = {};

  for (const path of Object.keys(ITEM_SOURCES)) {
    const source = ITEM_SOURCES[path];
    const document = JSON.parse(source) as {
      "minecraft:item": {
        description: { identifier: string };
        components?: { "minecraft:max_stack_size"?: number };
      };
    };
    const item = document["minecraft:item"];
    limits[item.description.identifier] =
      item.components?.["minecraft:max_stack_size"] ?? 64;
  }

  return limits;
}

describe("developer test bench", () => {
  it("places one stall per definition", () => {
    expect(planTestBench()).toHaveLength(TEST_BENCH.stalls.length);
  });

  it("lays the stalls out in a single evenly spaced row", () => {
    const placements = planTestBench();

    for (const placement of placements) {
      expect(placement.barrel.z).toBe(TEST_BENCH.row.z);
      expect(placement.barrel.y).toBe(TEST_BENCH.row.y);
      expect(placement.sign.y).toBe(placement.barrel.y + 1);
      expect(placement.sign.x).toBe(placement.barrel.x);
    }

    for (let index = 1; index < placements.length; index += 1) {
      expect(placements[index].barrel.x - placements[index - 1].barrel.x).toBe(
        TEST_BENCH.row.spacing,
      );
    }
  });

  it("keeps every stall on the starter island surface", () => {
    // The starter island grass layer is an ellipse around the island centre.
    // A stall outside it would float in the void or clip the dock.
    const centreX = STARTER_ISLAND.origin.x + 12;
    const centreZ = STARTER_ISLAND.origin.z + 10;
    const radiusX = 11;
    const radiusZ = 9;

    for (const placement of planTestBench()) {
      const dx = placement.barrel.x - centreX;
      const dz = placement.barrel.z - centreZ;
      const inside =
        (dx * dx) / (radiusX * radiusX) + (dz * dz) / (radiusZ * radiusZ);

      expect(inside).toBeLessThanOrEqual(1);
    }
  });

  it("does not collide with the dock walkway or its structures", () => {
    // The dock runs along z = -1..1; the bench must stay clear of it.
    for (const placement of planTestBench()) {
      expect(Math.abs(placement.barrel.z)).toBeGreaterThan(1);
    }
  });

  it("stocks every stall without exceeding a barrel's 27 slots", () => {
    for (const stall of TEST_BENCH.stalls) {
      expect(stall.items.length).toBeGreaterThan(0);
      expect(stall.items.length).toBeLessThanOrEqual(27);
    }
  });

  it("uses unique stall ids and labels", () => {
    const ids = TEST_BENCH.stalls.map((stall) => stall.id);
    const labels = TEST_BENCH.stalls.map((stall) => stall.label);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("exposes every custom item a tester needs to skip the progression", () => {
    const stocked = new Set<string>();

    for (const stall of TEST_BENCH.stalls) {
      for (const entry of stall.items) {
        stocked.add(entry.itemId);
      }
    }

    // Every ship part, module, and progression item must be reachable from the
    // bench, otherwise a tester still has to play the chain to reach a system.
    const required = [
      IDENTIFIERS.shipCore,
      IDENTIFIERS.canvasBundle,
      IDENTIFIERS.thrusterModule,
      IDENTIFIERS.reinforcedHull,
      IDENTIFIERS.aetherEngine,
      IDENTIFIERS.cargoHold,
      IDENTIFIERS.navigatorModule,
      IDENTIFIERS.armoredHull,
      IDENTIFIERS.frostfireEngine,
      IDENTIFIERS.expandedCargoHold,
      IDENTIFIERS.aetherCannon,
      IDENTIFIERS.cannonControl,
      IDENTIFIERS.aetherCharge,
      IDENTIFIERS.shieldProjector,
      IDENTIFIERS.repairKit,
      IDENTIFIERS.aetherCrystal,
      IDENTIFIERS.froststeelIngot,
      IDENTIFIERS.raiderCore,
    ];

    for (const itemId of required) {
      expect(stocked).toContain(itemId);
    }
  });

  it("requests positive counts within every custom item's stack limit", () => {
    const limits = itemStackLimits();

    for (const stall of TEST_BENCH.stalls) {
      for (const entry of stall.items) {
        expect(entry.count).toBeGreaterThan(0);
        expect(entry.count).toBeLessThanOrEqual(limits[entry.itemId] ?? 64);
      }
    }
  });

  it("parses, sorts, deduplicates, marks, and clears ownership state", () => {
    const parsed = parseTestBenchState({
      schemaVersion: 1,
      stallIds: ["shield", "starter_parts", "shield", "unknown"],
    });

    expect(parsed.stallIds).toEqual(["shield", "starter_parts"]);
    expect(markTestBenchStall(parsed, "cannon").stallIds).toEqual([
      "cannon",
      "shield",
      "starter_parts",
    ]);
    expect(unmarkTestBenchStall(parsed, "shield").stallIds).toEqual([
      "starter_parts",
    ]);
    expect(parseTestBenchState({ schemaVersion: 99 })).toEqual({
      schemaVersion: 1,
      stallIds: [],
    });
  });
});
