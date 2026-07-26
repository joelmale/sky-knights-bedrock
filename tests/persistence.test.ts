import { describe, expect, it } from "vitest";

import {
  DynamicPropertyHost,
  WorldStateRepository,
} from "../scripts/persistence/repositories";
import {
  parsePlayerState,
  parseShipState,
} from "../scripts/persistence/schema";

class FakeDynamicPropertyHost implements DynamicPropertyHost {
  private readonly values = new Map<string, string>();

  public getDynamicProperty(identifier: string): string | undefined {
    return this.values.get(identifier);
  }

  public setDynamicProperty(
    identifier: string,
    value?: boolean | number | string | { x: number; y: number; z: number },
  ): void {
    if (value === undefined) {
      this.values.delete(identifier);
      return;
    }

    if (typeof value !== "string") {
      throw new Error("This test host only stores strings.");
    }

    this.values.set(identifier, value);
  }
}

describe("WorldStateRepository", () => {
  it("creates and persists a v4 world state", () => {
    const host = new FakeDynamicPropertyHost();
    const repository = new WorldStateRepository(host, () => 42);

    expect(repository.load()).toEqual({
      schemaVersion: 4,
      seed: 42,
      generatedIslandIds: [],
      islandVersions: {},
      skyRaiderEncounter: { status: "dormant" },
      migrations: [],
    });
    expect(repository.load().seed).toBe(42);
  });

  it("migrates a v1 world through v4 once", () => {
    const host = new FakeDynamicPropertyHost();
    host.setDynamicProperty(
      "skyknights:world_state",
      JSON.stringify({
        schemaVersion: 1,
        seed: 7,
        generatedIslandIds: ["starter_island"],
      }),
    );
    const repository = new WorldStateRepository(host, () => 99);

    expect(repository.load()).toEqual({
      schemaVersion: 4,
      seed: 7,
      generatedIslandIds: ["starter_island"],
      islandVersions: {},
      skyRaiderEncounter: { status: "dormant" },
      migrations: ["world:v1->v2", "world:v2->v3", "world:v3->v4"],
    });
    expect(repository.load().migrations).toEqual([
      "world:v1->v2",
      "world:v2->v3",
      "world:v3->v4",
    ]);
  });

  it("migrates v2 worlds with unversioned islands so content is rebuilt", () => {
    const host = new FakeDynamicPropertyHost();
    host.setDynamicProperty(
      "skyknights:world_state",
      JSON.stringify({
        schemaVersion: 2,
        seed: 8,
        generatedIslandIds: ["starter_island"],
        migrations: ["world:v1->v2"],
      }),
    );
    const repository = new WorldStateRepository(host, () => 99);

    expect(repository.load()).toEqual({
      schemaVersion: 4,
      seed: 8,
      generatedIslandIds: ["starter_island"],
      islandVersions: {},
      activeGeneration: undefined,
      skyRaiderEncounter: { status: "dormant" },
      migrations: ["world:v1->v2", "world:v2->v3", "world:v3->v4"],
    });
  });

  it("migrates a v3 world into a dormant shared combat encounter", () => {
    const host = new FakeDynamicPropertyHost();
    host.setDynamicProperty(
      "skyknights:world_state",
      JSON.stringify({
        schemaVersion: 3,
        seed: 12,
        generatedIslandIds: ["starter_island", "frostspire"],
        islandVersions: { starter_island: 3, frostspire: 1 },
        migrations: ["world:v2->v3"],
      }),
    );
    const repository = new WorldStateRepository(host, () => 99);

    expect(repository.load()).toMatchObject({
      schemaVersion: 4,
      seed: 12,
      islandVersions: { starter_island: 3, frostspire: 1 },
      skyRaiderEncounter: { status: "dormant" },
      migrations: ["world:v2->v3", "world:v3->v4"],
    });
  });
});

const fallbackDock = {
  dimensionId: "minecraft:overworld",
  x: 9.5,
  y: 161,
  z: 0.5,
};

describe("gameplay document migrations", () => {
  it("migrates a v1 player at Ember Outpost to the return-crystal objective", () => {
    expect(
      parsePlayerState(
        {
          schemaVersion: 1,
          initialized: true,
          recoveryEnabled: true,
          discoveredIslandIds: ["ember_outpost"],
          lastSafeDock: fallbackDock,
        },
        fallbackDock,
      ),
    ).toEqual({
      schemaVersion: 3,
      initialized: true,
      recoveryEnabled: true,
      discoveredIslandIds: ["ember_outpost"],
      lastSafeDock: fallbackDock,
      skycutterUnlocked: false,
      objective: "return_crystal",
      ownedShip: undefined,
    });
  });

  it("migrates v1 skiff modules into named slots", () => {
    expect(
      parseShipState(
        {
          schemaVersion: 1,
          shipId: "old-skiff",
          ownerPlayerId: "player-1",
          homeDock: fallbackDock,
          configuration: {
            frame: "skiff",
            modules: ["canvas_hull", "starter_thruster"],
          },
        },
        "fallback",
        fallbackDock,
      ),
    ).toEqual({
      schemaVersion: 3,
      shipId: "old-skiff",
      ownerPlayerId: "player-1",
      homeDock: fallbackDock,
      docked: false,
      combat: {
        shotsFired: 0,
        hits: 0,
        raidersDefeated: 0,
      },
      configuration: {
        frame: "skiff",
        modules: {
          hull: "canvas_hull",
          engine: "starter_thruster",
        },
      },
    });
  });

  it("preserves a configured v2 Skycutter", () => {
    const state = parseShipState(
      {
        schemaVersion: 2,
        shipId: "cutter-1",
        ownerPlayerId: "new-id",
        ownerName: "SkyKnight",
        homeDock: fallbackDock,
        docked: true,
        configuration: {
          frame: "skycutter",
          modules: {
            hull: "skyknights:reinforced_hull",
            engine: "skyknights:aether_engine",
            cargo: "skyknights:cargo_hold",
            utility: "skyknights:navigator_module",
          },
        },
      },
      "fallback",
      fallbackDock,
      "skycutter",
    );

    expect(state.configuration.frame).toBe("skycutter");
    expect(state.configuration.modules.engine).toBe("skyknights:aether_engine");
    expect(state.ownerName).toBe("SkyKnight");
    expect(state.docked).toBe(true);
    expect(state.combat).toEqual({
      shotsFired: 0,
      hits: 0,
      raidersDefeated: 0,
    });
  });

  it("maps the legacy completed objective to the refit progression", () => {
    const state = parsePlayerState(
      {
        schemaVersion: 2,
        initialized: true,
        recoveryEnabled: true,
        discoveredIslandIds: ["ember_outpost", "frostspire"],
        lastSafeDock: fallbackDock,
        skycutterUnlocked: true,
        objective: "complete",
      },
      fallbackDock,
    );

    expect(state.schemaVersion).toBe(3);
    expect(state.objective).toBe("craft_combat_refit");
  });
});
