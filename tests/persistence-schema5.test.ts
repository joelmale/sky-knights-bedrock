import { describe, expect, it } from "vitest";

import { LAYOUT } from "../scripts/config/islands";
import {
  DEFAULT_WORLD_PROFILE_ID,
  WORLD_PROFILES,
  WORLD_PROFILE_IDS,
  deriveWorldSeed,
  isWorldProfileId,
  profileIncludesIsland,
  resolveWorldProfileId,
  worldProfile,
} from "../scripts/config/profiles";
import { plannedIslandLayoutRecords } from "../scripts/generation/discovery";
import {
  DynamicPropertyHost,
  WorldStateRepository,
} from "../scripts/persistence/repositories";
import {
  CURRENT_PLAYER_SCHEMA_VERSION,
  CURRENT_SHIP_SCHEMA_VERSION,
  CURRENT_WORLD_SCHEMA_VERSION,
  IslandLayoutRecord,
  createWorldState,
  islandLayoutRecord,
  markIslandPlayerModified,
  migrateWorldState,
  parsePlayerState,
  parseShipState,
  recordIslandLayout,
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

const dock = {
  dimensionId: "minecraft:overworld",
  x: 9.5,
  y: 161,
  z: 0.5,
};

/**
 * A live schema-4 test world: Crystal-to-Cutter finished, the refit crafted and
 * installed, and the Ashwing Raider defeated. Nothing in this fixture may be
 * lost by the 4 -> 5 upgrade.
 */
function liveWorldStateV4(): Record<string, unknown> {
  return {
    schemaVersion: 4,
    seed: 2026,
    generatedIslandIds: ["starter_island", "ember_outpost", "frostspire"],
    islandVersions: {
      starter_island: 3,
      ember_outpost: 4,
      frostspire: 2,
    },
    skyRaiderEncounter: {
      status: "defeated",
      entityId: "raider-entity-1",
      lastKnownLocation: {
        dimensionId: "minecraft:overworld",
        x: 174,
        y: 172,
        z: 28,
      },
    },
    migrations: ["world:v1->v2", "world:v2->v3", "world:v3->v4"],
  };
}

const livePlayerStateV3 = {
  schemaVersion: 3,
  initialized: true,
  recoveryEnabled: true,
  discoveredIslandIds: ["starter_island", "ember_outpost", "frostspire"],
  lastSafeDock: dock,
  skycutterUnlocked: true,
  objective: "combat_complete",
  ownedShip: {
    entityId: "cutter-entity-1",
    shipId: "cutter-1",
    frame: "skycutter",
    lastKnownLocation: dock,
    modules: {
      hull: "skyknights:armored_hull",
      engine: "skyknights:frostfire_engine",
      cargo: "skyknights:expanded_cargo_hold",
      utility: "skyknights:shield_projector",
    },
  },
};

const liveShipStateV3 = {
  schemaVersion: 3,
  shipId: "cutter-1",
  ownerPlayerId: "player-1",
  ownerName: "SkyKnight",
  homeDock: dock,
  docked: true,
  combat: {
    shotsFired: 41,
    hits: 27,
    raidersDefeated: 1,
  },
  configuration: {
    frame: "skycutter",
    modules: {
      hull: "skyknights:armored_hull",
      engine: "skyknights:frostfire_engine",
      cargo: "skyknights:expanded_cargo_hold",
      utility: "skyknights:shield_projector",
    },
  },
};

function neverCalledSeed(): number {
  throw new Error("A world that already has a seed must never reroll it.");
}

describe("world schema 4 -> 5 migration", () => {
  it("upgrades a completed Crystal-to-Cutter world without losing anything", () => {
    const state = migrateWorldState(liveWorldStateV4(), neverCalledSeed);

    expect(state.schemaVersion).toBe(5);
    expect(state.seed).toBe(2026);
    expect(state.generatedIslandIds).toEqual([
      "starter_island",
      "ember_outpost",
      "frostspire",
    ]);
    expect(state.islandVersions).toEqual({
      starter_island: 3,
      ember_outpost: 4,
      frostspire: 2,
    });
    expect(state.skyRaiderEncounter).toEqual({
      status: "defeated",
      entityId: "raider-entity-1",
      lastKnownLocation: {
        dimensionId: "minecraft:overworld",
        x: 174,
        y: 172,
        z: 28,
      },
    });
    expect(state.migrations).toEqual([
      "world:v1->v2",
      "world:v2->v3",
      "world:v3->v4",
      "world:v4->v5",
    ]);
  });

  it("adds the seed, profile, and layout fields schema 5 introduces", () => {
    const state = migrateWorldState(liveWorldStateV4(), neverCalledSeed);

    expect(state.worldProfile).toBe(DEFAULT_WORLD_PROFILE_ID);
    expect(state.layoutVersion).toBe(LAYOUT.layoutVersion);
    expect(state.islandLayout).toEqual({});
    expect(state.worldSeed).toBe(deriveWorldSeed(2026, "standard"));
  });

  it("protects legacy generated islands when edit history is unknowable", () => {
    const migrated = migrateWorldState(liveWorldStateV4(), neverCalledSeed);
    const records = plannedIslandLayoutRecords(migrated);
    const recorded = recordIslandLayout(migrated, records);

    expect(islandLayoutRecord(recorded, "starter_island")?.playerModified).toBe(
      true,
    );
    expect(islandLayoutRecord(recorded, "ember_outpost")?.playerModified).toBe(
      true,
    );
    expect(islandLayoutRecord(recorded, "frostspire")?.playerModified).toBe(
      true,
    );
    expect(islandLayoutRecord(recorded, "verdant_hollow")?.playerModified).toBe(
      false,
    );
  });

  it("derives a stable world seed instead of rolling a fresh one", () => {
    const first = migrateWorldState(liveWorldStateV4(), neverCalledSeed);
    const second = migrateWorldState(liveWorldStateV4(), neverCalledSeed);

    // Pinned literal: changing the derivation relocates every existing realm.
    expect(first.worldSeed).toBe(417159518);
    expect(second.worldSeed).toBe(first.worldSeed);
    expect(first.worldSeed >>> 0).toBe(first.worldSeed);
    expect(createWorldState(2026).worldSeed).toBe(first.worldSeed);
  });

  it("keeps an in-flight generation job resumable across the upgrade", () => {
    const legacy = liveWorldStateV4();
    legacy.activeGeneration = {
      id: "frostspire",
      contentVersion: 2,
      structureId: "skyknights:frostspire",
      dimensionId: "minecraft:overworld",
      origin: { x: 240, y: 150, z: -11 },
      stage: "structure_placed",
      attempts: 1,
    };

    expect(migrateWorldState(legacy, neverCalledSeed).activeGeneration).toEqual(
      {
        id: "frostspire",
        contentVersion: 2,
        structureId: "skyknights:frostspire",
        dimensionId: "minecraft:overworld",
        origin: { x: 240, y: 150, z: -11 },
        stage: "structure_placed",
        attempts: 1,
      },
    );
  });

  it("is idempotent when the same document is migrated twice", () => {
    const once = migrateWorldState(liveWorldStateV4(), neverCalledSeed);
    const twice = migrateWorldState(
      JSON.parse(JSON.stringify(once)) as unknown,
      neverCalledSeed,
    );

    expect(twice).toEqual(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
    expect(twice.migrations).toEqual(once.migrations);
  });

  it("upgrades a v1 world straight through to schema 5", () => {
    const state = migrateWorldState(
      {
        schemaVersion: 1,
        seed: 7,
        generatedIslandIds: ["starter_island"],
      },
      neverCalledSeed,
    );

    expect(state.schemaVersion).toBe(CURRENT_WORLD_SCHEMA_VERSION);
    expect(state.seed).toBe(7);
    expect(state.worldSeed).toBe(deriveWorldSeed(7, "standard"));
    expect(state.migrations).toEqual([
      "world:v1->v2",
      "world:v2->v3",
      "world:v3->v4",
      "world:v4->v5",
    ]);
  });

  it("rejects a document from an unknown future schema", () => {
    expect(() =>
      migrateWorldState({ schemaVersion: 99, seed: 1 }, neverCalledSeed),
    ).toThrow(/Unsupported Sky Knights world schema/);
  });
});

describe("schema 5 upgrade through the repository", () => {
  it("rewrites the stored document exactly once", () => {
    const host = new FakeDynamicPropertyHost();
    host.setDynamicProperty(
      "skyknights:world_state",
      JSON.stringify(liveWorldStateV4()),
    );
    host.setDynamicProperty(
      "skyknights:player_state",
      JSON.stringify(livePlayerStateV3),
    );
    host.setDynamicProperty(
      "skyknights:ship_state",
      JSON.stringify(liveShipStateV3),
    );

    const repository = new WorldStateRepository(host, neverCalledSeed);
    const first = repository.load();
    const afterFirst = host.getDynamicProperty("skyknights:world_state");
    const second = repository.load();

    expect(first.schemaVersion).toBe(5);
    expect(second).toEqual(first);
    expect(host.getDynamicProperty("skyknights:world_state")).toBe(afterFirst);
  });

  it("leaves the player and ship documents at schema 3 with progress intact", () => {
    const player = parsePlayerState(livePlayerStateV3, dock);
    const ship = parseShipState(liveShipStateV3, "fallback", dock, "skycutter");

    expect(player.schemaVersion).toBe(CURRENT_PLAYER_SCHEMA_VERSION);
    expect(player.objective).toBe("combat_complete");
    expect(player.skycutterUnlocked).toBe(true);
    expect(player.discoveredIslandIds).toEqual([
      "starter_island",
      "ember_outpost",
      "frostspire",
    ]);
    expect(player.ownedShip).toEqual({
      entityId: "cutter-entity-1",
      shipId: "cutter-1",
      frame: "skycutter",
      lastKnownLocation: dock,
      modules: {
        hull: "skyknights:armored_hull",
        engine: "skyknights:frostfire_engine",
        cargo: "skyknights:expanded_cargo_hold",
        utility: "skyknights:shield_projector",
      },
    });

    expect(ship.schemaVersion).toBe(CURRENT_SHIP_SCHEMA_VERSION);
    expect(ship.configuration.frame).toBe("skycutter");
    expect(ship.configuration.modules.utility).toBe(
      "skyknights:shield_projector",
    );
    expect(ship.combat).toEqual({
      shotsFired: 41,
      hits: 27,
      raidersDefeated: 1,
    });
  });
});

describe("world profile registry", () => {
  it("registers a sorted default profile", () => {
    expect(WORLD_PROFILE_IDS).toEqual([...WORLD_PROFILE_IDS].sort());
    expect(WORLD_PROFILE_IDS).toContain(DEFAULT_WORLD_PROFILE_ID);

    for (const id of WORLD_PROFILE_IDS) {
      expect(WORLD_PROFILES[id].id).toBe(id);
    }

    expect(worldProfile(DEFAULT_WORLD_PROFILE_ID).layoutVersion).toBe(
      LAYOUT.layoutVersion,
    );
    expect(worldProfile(DEFAULT_WORLD_PROFILE_ID).dimensionId).toBe(
      LAYOUT.dimensionId,
    );
  });

  it("resolves unknown, missing, and prototype-shaped ids to the default", () => {
    expect(isWorldProfileId("standard")).toBe(true);
    expect(isWorldProfileId("toString")).toBe(false);
    expect(isWorldProfileId(undefined)).toBe(false);
    expect(resolveWorldProfileId("retired_profile")).toBe(
      DEFAULT_WORLD_PROFILE_ID,
    );
    expect(resolveWorldProfileId(undefined)).toBe(DEFAULT_WORLD_PROFILE_ID);
    expect(worldProfile("constructor").id).toBe(DEFAULT_WORLD_PROFILE_ID);
  });

  it("selects every island for the standard profile", () => {
    const profile = worldProfile(DEFAULT_WORLD_PROFILE_ID);

    expect(profileIncludesIsland(profile, "starter_island")).toBe(true);
    expect(profileIncludesIsland(profile, "aether_sanctum")).toBe(true);
  });

  it("derives distinct, stable uint32 seeds", () => {
    for (const seed of [0, 1, 7, 2026, 0xdeadbeef]) {
      const derived = deriveWorldSeed(seed, DEFAULT_WORLD_PROFILE_ID);

      expect(Number.isInteger(derived)).toBe(true);
      expect(derived >>> 0).toBe(derived);
      expect(deriveWorldSeed(seed, DEFAULT_WORLD_PROFILE_ID)).toBe(derived);
    }

    expect(deriveWorldSeed(7, "standard")).not.toBe(
      deriveWorldSeed(8, "standard"),
    );
    expect(deriveWorldSeed(7, "unknown_profile")).toBe(
      deriveWorldSeed(7, "standard"),
    );
  });

  it("keeps a stored world seed when the profile id is no longer shipped", () => {
    const state = migrateWorldState(
      {
        ...liveWorldStateV4(),
        schemaVersion: 5,
        worldSeed: 123456,
        worldProfile: "retired_profile",
        layoutVersion: 1,
        islandLayout: {},
      },
      neverCalledSeed,
    );

    expect(state.worldProfile).toBe(DEFAULT_WORLD_PROFILE_ID);
    expect(state.worldSeed).toBe(123456);
  });

  it("derives the world seed when a schema-5 document is missing it", () => {
    const state = migrateWorldState(
      {
        ...liveWorldStateV4(),
        schemaVersion: 5,
        worldProfile: "standard",
        islandLayout: {},
      },
      neverCalledSeed,
    );

    expect(state.worldSeed).toBe(deriveWorldSeed(2026, "standard"));
    expect(state.layoutVersion).toBe(LAYOUT.layoutVersion);
  });
});

function layoutRecord(
  id: string,
  x: number,
  playerModified = false,
): IslandLayoutRecord {
  return {
    id,
    structureId: `skyknights:${id}`,
    dimensionId: "minecraft:overworld",
    placement: "seeded",
    origin: { x, y: 152, z: 40 },
    size: { x: 31, y: 18, z: 27 },
    reserved: {
      from: { x: x - 12, y: 144, z: 28 },
      to: { x: x + 42, y: 177, z: 78 },
    },
    playerModified,
  };
}

describe("island layout records", () => {
  it("stores records sorted by id and survives a round trip", () => {
    const state = recordIslandLayout(createWorldState(2026), [
      layoutRecord("verdant_hollow", 300),
      layoutRecord("ashfall_crater", -260),
    ]);

    expect(Object.keys(state.islandLayout)).toEqual([
      "ashfall_crater",
      "verdant_hollow",
    ]);

    const reloaded = migrateWorldState(
      JSON.parse(JSON.stringify(state)) as unknown,
      neverCalledSeed,
    );

    expect(reloaded.islandLayout).toEqual(state.islandLayout);
    expect(JSON.stringify(reloaded)).toBe(JSON.stringify(state));
    expect(islandLayoutRecord(reloaded, "ashfall_crater")?.origin).toEqual({
      x: -260,
      y: 152,
      z: 40,
    });
    expect(islandLayoutRecord(reloaded, "glacier_vault")).toBeUndefined();
  });

  it("never moves an existing layout record when a layout is re-planned", () => {
    const marked = markIslandPlayerModified(
      recordIslandLayout(createWorldState(2026), [
        layoutRecord("verdant_hollow", 300),
      ]),
      "verdant_hollow",
    );

    expect(islandLayoutRecord(marked, "verdant_hollow")?.playerModified).toBe(
      true,
    );

    const replanned = recordIslandLayout(marked, [
      layoutRecord("verdant_hollow", 320),
    ]);

    expect(islandLayoutRecord(replanned, "verdant_hollow")).toMatchObject({
      origin: { x: 300, y: 152, z: 40 },
      playerModified: true,
    });
  });

  it("ignores player-modified marks for islands that have no record", () => {
    const state = createWorldState(2026);

    expect(markIslandPlayerModified(state, "glacier_vault")).toBe(state);
    expect(recordIslandLayout(state, [])).toBe(state);
  });

  it("repairs a malformed record instead of dropping the island", () => {
    const state = migrateWorldState(
      {
        ...liveWorldStateV4(),
        schemaVersion: 5,
        worldSeed: 417159518,
        worldProfile: "standard",
        layoutVersion: 1,
        islandLayout: {
          glacier_vault: {
            id: "glacier_vault",
            origin: { x: 260, y: 156, z: -40 },
            size: { x: 31, y: 18, z: 27 },
            playerModified: true,
          },
        },
      },
      neverCalledSeed,
    );

    expect(islandLayoutRecord(state, "glacier_vault")).toEqual({
      id: "glacier_vault",
      structureId: "skyknights:glacier_vault",
      dimensionId: "minecraft:overworld",
      placement: "seeded",
      origin: { x: 260, y: 156, z: -40 },
      size: { x: 31, y: 18, z: 27 },
      reserved: {
        from: { x: 260, y: 156, z: -40 },
        to: { x: 290, y: 173, z: -14 },
      },
      playerModified: true,
    });
  });
});
