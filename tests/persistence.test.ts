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
  it("creates and persists a v3 world state", () => {
    const host = new FakeDynamicPropertyHost();
    const repository = new WorldStateRepository(host, () => 42);

    expect(repository.load()).toEqual({
      schemaVersion: 3,
      seed: 42,
      generatedIslandIds: [],
      islandVersions: {},
      migrations: [],
    });
    expect(repository.load().seed).toBe(42);
  });

  it("migrates a v1 world through v3 once", () => {
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
      schemaVersion: 3,
      seed: 7,
      generatedIslandIds: ["starter_island"],
      islandVersions: {},
      migrations: ["world:v1->v2", "world:v2->v3"],
    });
    expect(repository.load().migrations).toEqual([
      "world:v1->v2",
      "world:v2->v3",
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
      schemaVersion: 3,
      seed: 8,
      generatedIslandIds: ["starter_island"],
      islandVersions: {},
      migrations: ["world:v1->v2", "world:v2->v3"],
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
      schemaVersion: 2,
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
      schemaVersion: 2,
      shipId: "old-skiff",
      ownerPlayerId: "player-1",
      homeDock: fallbackDock,
      docked: false,
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
  });
});
