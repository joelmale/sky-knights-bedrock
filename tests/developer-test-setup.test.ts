import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureRequiredIslandsQueued: vi.fn(),
  prepareDeveloperSkycraftBerths: vi.fn(),
  ensureDockmaster: vi.fn(),
  spawnSkyRaiderForPlayer: vi.fn(),
  spawnSkiffForPlayer: vi.fn(),
  spawnSkycutterForPlayer: vi.fn(),
  placeTestBench: vi.fn(),
  waitTicks: vi.fn(async () => {}),
  getDimension: vi.fn(),
  tickingAreas: new Set<string>(),
  hasTickingArea: vi.fn(),
  removeTickingArea: vi.fn(),
  hasTickingAreaCapacity: vi.fn(),
  createTickingArea: vi.fn(),
}));

vi.mock("@minecraft/server", () => ({
  Dimension: class {},
  Entity: class {},
  Player: class {},
  system: {
    waitTicks: mocks.waitTicks,
  },
  world: {
    getDimension: mocks.getDimension,
    tickingAreaManager: {
      hasTickingArea: mocks.hasTickingArea,
      removeTickingArea: mocks.removeTickingArea,
      hasCapacity: mocks.hasTickingAreaCapacity,
      createTickingArea: mocks.createTickingArea,
    },
  },
}));

vi.mock("../scripts/generation/service", () => ({
  ensureRequiredIslandsQueued: mocks.ensureRequiredIslandsQueued,
}));

vi.mock("../scripts/skycraft/controller", () => ({
  prepareDeveloperSkycraftBerths: mocks.prepareDeveloperSkycraftBerths,
}));

vi.mock("../scripts/gameplay/dockyard", () => ({
  ensureDockmaster: mocks.ensureDockmaster,
}));

vi.mock("../scripts/gameplay/sky-raider", () => ({
  spawnSkyRaiderForPlayer: mocks.spawnSkyRaiderForPlayer,
}));

vi.mock("../scripts/gameplay/skiff", () => ({
  spawnSkiffForPlayer: mocks.spawnSkiffForPlayer,
  spawnSkycutterForPlayer: mocks.spawnSkycutterForPlayer,
}));

vi.mock("../scripts/gameplay/testbench", () => ({
  placeTestBench: mocks.placeTestBench,
}));

import { Dimension, Entity, Player } from "@minecraft/server";

import { IDENTIFIERS, REQUIRED_ISLANDS } from "../scripts/config/constants";
import { Logger } from "../scripts/diagnostics/logger";
import { prepareDeveloperTestSetup } from "../scripts/gameplay/developer-test-setup";
import {
  DEVELOPER_TEST_ENTITY_TAG,
  DEVELOPER_TEST_RAIDER_TICKING_AREA,
  DEVELOPER_TEST_SETUP,
} from "../scripts/gameplay/developer-test-setup-layout";
import { WorldStateRepository } from "../scripts/persistence/repositories";
import { SKYCRAFT_EXPERIMENTAL_CERTIFICATION_TAG } from "../scripts/skycraft/progression";

interface FakeEntity {
  id: string;
  typeId: string;
  addTag: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  nameTag?: string;
}

function fakeEntity(id: string, typeId: string): FakeEntity {
  return {
    id,
    typeId,
    addTag: vi.fn(),
    remove: vi.fn(),
  };
}

describe("developer test setup runtime", () => {
  let oldEntities: FakeEntity[];
  let spawnedPrototypes: FakeEntity[];
  let dimension: {
    getBlock: ReturnType<typeof vi.fn>;
    getEntities: ReturnType<typeof vi.fn>;
    spawnEntity: ReturnType<typeof vi.fn>;
  };
  let player: {
    id: string;
    name: string;
    isValid: boolean;
    dimension: typeof dimension;
    teleport: ReturnType<typeof vi.fn>;
    addTag: ReturnType<typeof vi.fn>;
  };
  let worldState: {
    generatedIslandIds: string[];
    skyRaiderEncounter: {
      status: "active";
      entityId: string;
    };
  };
  let repository: {
    load: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    oldEntities = [
      fakeEntity("old-skiff", IDENTIFIERS.skiff),
      fakeEntity("old-raider", IDENTIFIERS.skyRaider),
    ];
    spawnedPrototypes = [];
    dimension = {
      getBlock: vi.fn(() => ({
        isAir: true,
        typeId: "minecraft:air",
      })),
      getEntities: vi.fn(() => oldEntities),
      spawnEntity: vi.fn((typeId: string) => {
        const entity = fakeEntity(`prototype-${typeId}`, typeId);
        spawnedPrototypes.push(entity);
        return entity;
      }),
    };
    player = {
      id: "player-1",
      name: "Tester",
      isValid: true,
      dimension,
      teleport: vi.fn(),
      addTag: vi.fn(),
    };
    worldState = {
      generatedIslandIds: REQUIRED_ISLANDS.map((island) => island.id),
      skyRaiderEncounter: {
        status: "active",
        entityId: "old-raider",
      },
    };
    repository = {
      load: vi.fn(() => worldState),
    };
    mocks.tickingAreas.clear();
    mocks.hasTickingArea.mockImplementation((id: string) =>
      mocks.tickingAreas.has(id),
    );
    mocks.removeTickingArea.mockImplementation((id: string) => {
      mocks.tickingAreas.delete(id);
    });
    mocks.hasTickingAreaCapacity.mockReturnValue(true);
    mocks.createTickingArea.mockImplementation(async (id: string) => {
      mocks.tickingAreas.add(id);
    });
    mocks.getDimension.mockReturnValue(dimension);
    mocks.prepareDeveloperSkycraftBerths.mockReturnValue({
      prepared: [
        "starter_apprentice",
        "starter_ember",
        "starter_specialist",
        "starter_expedition",
        "starter_masterwork",
      ],
      skipped: [],
    });
    mocks.ensureDockmaster.mockReturnValue(true);
    mocks.placeTestBench.mockReturnValue({
      placed: Array.from({ length: 8 }, (_, index) => `stall-${index}`),
      skipped: [],
    });
    mocks.spawnSkiffForPlayer.mockReturnValue(
      fakeEntity("new-skiff", IDENTIFIERS.skiff),
    );
    mocks.spawnSkycutterForPlayer.mockReturnValue(
      fakeEntity("new-skycutter", IDENTIFIERS.skycutter),
    );
    mocks.spawnSkyRaiderForPlayer.mockImplementation(() => {
      const removePreviousRaider = oldEntities.find(
        (entity) => entity.typeId === IDENTIFIERS.skyRaider,
      )?.remove as unknown as (() => void) | undefined;
      removePreviousRaider?.();
      return fakeEntity("new-raider", IDENTIFIERS.skyRaider);
    });
  });

  it("prepares and reports the complete fixed inspection hub", async () => {
    const report = await prepareDeveloperTestSetup(
      player as unknown as Player,
      repository as unknown as WorldStateRepository,
      new Logger("test", () => {}),
    );

    expect(player.teleport).toHaveBeenCalledWith(DEVELOPER_TEST_SETUP.landing, {
      dimension,
    });
    expect(player.addTag).toHaveBeenCalledWith(
      SKYCRAFT_EXPERIMENTAL_CERTIFICATION_TAG,
    );
    expect(
      oldEntities.every((entity) => entity.remove.mock.calls.length === 1),
    ).toBe(true);
    expect(mocks.spawnSkiffForPlayer).toHaveBeenCalledWith(
      player,
      expect.any(Logger),
      DEVELOPER_TEST_SETUP.craft[0].location,
      undefined,
      { trackAsPrimary: false },
    );
    expect(mocks.spawnSkycutterForPlayer).toHaveBeenCalledWith(
      player,
      expect.any(Logger),
      DEVELOPER_TEST_SETUP.craft[1].location,
      {
        hull: IDENTIFIERS.armoredHull,
        engine: IDENTIFIERS.frostfireEngine,
        cargo: IDENTIFIERS.expandedCargoHold,
        utility: IDENTIFIERS.aetherCannon,
      },
      { trackAsPrimary: false },
    );
    expect(dimension.spawnEntity).toHaveBeenCalledTimes(2);
    expect(mocks.spawnSkyRaiderForPlayer).toHaveBeenCalledWith(
      player,
      repository,
      expect.any(Logger),
      true,
      DEVELOPER_TEST_SETUP.raiderCandidates[0].location,
    );
    expect(mocks.createTickingArea).toHaveBeenCalledWith(
      DEVELOPER_TEST_RAIDER_TICKING_AREA,
      expect.objectContaining({ dimension }),
    );
    expect(mocks.removeTickingArea).toHaveBeenCalledWith(
      DEVELOPER_TEST_RAIDER_TICKING_AREA,
    );

    const taggedEntities = [
      mocks.spawnSkiffForPlayer.mock.results[0].value as FakeEntity,
      mocks.spawnSkycutterForPlayer.mock.results[0].value as FakeEntity,
      ...spawnedPrototypes,
      mocks.spawnSkyRaiderForPlayer.mock.results[0].value as FakeEntity,
    ];
    for (const entity of taggedEntities) {
      expect(entity.addTag).toHaveBeenCalledWith(DEVELOPER_TEST_ENTITY_TAG);
    }

    expect(report).toMatchObject({
      replacedEntities: 2,
      spawnedCraft: [
        IDENTIFIERS.skiff,
        IDENTIFIERS.skycutter,
        IDENTIFIERS.aetherOutrigger,
        IDENTIFIERS.steampunkBlimp,
      ],
      benchStalls: { placed: 8, skipped: [] },
      berths: { prepared: 5, skipped: [] },
      dockmasterReady: true,
      raiderReady: true,
      raiderLocation: DEVELOPER_TEST_SETUP.raiderCandidates[0].location,
    });
    expect(report.referenceBlueprints).toHaveLength(8);
  });

  it("fails before replacing entities when a fleet slot is obstructed", async () => {
    dimension.getBlock.mockReturnValueOnce({
      isAir: false,
      typeId: "minecraft:stone",
    });

    await expect(
      prepareDeveloperTestSetup(
        player as unknown as Player,
        repository as unknown as WorldStateRepository,
        new Logger("test", () => {}),
      ),
    ).rejects.toThrow(/skiff test slot is blocked/u);

    expect(dimension.getEntities).not.toHaveBeenCalled();
    expect(mocks.placeTestBench).not.toHaveBeenCalled();
    expect(mocks.spawnSkiffForPlayer).not.toHaveBeenCalled();
  });

  it("keeps the generation queue moving before placing anything", async () => {
    let loads = 0;
    repository.load.mockImplementation(() => {
      loads += 1;
      return {
        generatedIslandIds:
          loads < 3 ? [] : REQUIRED_ISLANDS.map((island) => island.id),
      };
    });

    await prepareDeveloperTestSetup(
      player as unknown as Player,
      repository as unknown as WorldStateRepository,
      new Logger("test", () => {}),
    );

    expect(mocks.ensureRequiredIslandsQueued).toHaveBeenCalledWith(
      repository,
      expect.any(Logger),
    );
    expect(mocks.waitTicks).toHaveBeenCalledWith(5);
    expect(player.teleport).toHaveBeenCalled();
  });

  it("loads the Raider lane before probing it", async () => {
    let laneLoaded = false;
    mocks.createTickingArea.mockImplementation(async (id: string) => {
      mocks.tickingAreas.add(id);
      laneLoaded = true;
    });
    dimension.getBlock.mockImplementation(({ x, y, z }) => {
      const isRaiderLane = x >= 52 && x <= 56 && z >= 52 && z <= 56;

      if (isRaiderLane && !laneLoaded) {
        throw new Error("chunk not loaded");
      }

      return {
        isAir: true,
        typeId: "minecraft:air",
      };
    });

    const report = await prepareDeveloperTestSetup(
      player as unknown as Player,
      repository as unknown as WorldStateRepository,
      new Logger("test", () => {}),
    );

    expect(report.raiderReady).toBe(true);
    expect(mocks.createTickingArea).toHaveBeenCalledOnce();
    expect(mocks.spawnSkyRaiderForPlayer).toHaveBeenCalledOnce();
  });

  it("uses the next deterministic Raider height when terrain blocks the primary lane", async () => {
    dimension.getBlock.mockImplementation(({ x, y, z }) => {
      const blocksPrimaryRaiderLane =
        x >= 52 && x <= 56 && y >= 176 && y <= 179 && z >= 52 && z <= 56;

      return {
        isAir: !blocksPrimaryRaiderLane,
        typeId: blocksPrimaryRaiderLane ? "minecraft:stone" : "minecraft:air",
      };
    });

    const report = await prepareDeveloperTestSetup(
      player as unknown as Player,
      repository as unknown as WorldStateRepository,
      new Logger("test", () => {}),
    );

    expect(mocks.spawnSkyRaiderForPlayer).toHaveBeenCalledWith(
      player,
      repository,
      expect.any(Logger),
      true,
      DEVELOPER_TEST_SETUP.raiderCandidates[1].location,
    );
    expect(report).toMatchObject({
      raiderReady: true,
      raiderLocation: DEVELOPER_TEST_SETUP.raiderCandidates[1].location,
    });
  });

  it("completes the craft setup when every Raider height is blocked", async () => {
    const previousEncounter = worldState.skyRaiderEncounter;
    dimension.getBlock.mockImplementation(({ x, y, z }) => {
      const blocksRaiderLane =
        x >= 52 && x <= 56 && y >= 176 && z >= 52 && z <= 56;

      return {
        isAir: !blocksRaiderLane,
        typeId: blocksRaiderLane ? "minecraft:stone" : "minecraft:air",
      };
    });

    const report = await prepareDeveloperTestSetup(
      player as unknown as Player,
      repository as unknown as WorldStateRepository,
      new Logger("test", () => {}),
    );

    expect(report).toMatchObject({
      raiderReady: false,
      spawnedCraft: [
        IDENTIFIERS.skiff,
        IDENTIFIERS.skycutter,
        IDENTIFIERS.aetherOutrigger,
        IDENTIFIERS.steampunkBlimp,
      ],
    });
    expect(report.raiderWarning).toMatch(
      /Every deterministic Raider position/u,
    );
    expect(report.raiderLocation).toBeUndefined();
    expect(mocks.spawnSkyRaiderForPlayer).not.toHaveBeenCalled();
    expect(oldEntities[0].remove).toHaveBeenCalledOnce();
    expect(oldEntities[1].remove).not.toHaveBeenCalled();
    expect(worldState.skyRaiderEncounter).toBe(previousEncounter);
    expect(mocks.removeTickingArea).toHaveBeenCalledWith(
      DEVELOPER_TEST_RAIDER_TICKING_AREA,
    );
  });

  it("completes the craft setup when Raider ticking-area capacity is unavailable", async () => {
    const previousEncounter = worldState.skyRaiderEncounter;
    mocks.hasTickingAreaCapacity.mockReturnValue(false);

    const report = await prepareDeveloperTestSetup(
      player as unknown as Player,
      repository as unknown as WorldStateRepository,
      new Logger("test", () => {}),
    );

    expect(report.raiderReady).toBe(false);
    expect(report.raiderWarning).toMatch(/No ticking-area capacity/u);
    expect(mocks.createTickingArea).not.toHaveBeenCalled();
    expect(mocks.spawnSkiffForPlayer).toHaveBeenCalledOnce();
    expect(mocks.spawnSkyRaiderForPlayer).not.toHaveBeenCalled();
    expect(oldEntities[0].remove).toHaveBeenCalledOnce();
    expect(oldEntities[1].remove).not.toHaveBeenCalled();
    expect(worldState.skyRaiderEncounter).toBe(previousEncounter);
  });

  it("keeps both owned test craft non-primary on every rerun", async () => {
    const logger = new Logger("test", () => {});

    await prepareDeveloperTestSetup(
      player as unknown as Player,
      repository as unknown as WorldStateRepository,
      logger,
    );
    await prepareDeveloperTestSetup(
      player as unknown as Player,
      repository as unknown as WorldStateRepository,
      logger,
    );

    expect(mocks.spawnSkiffForPlayer).toHaveBeenCalledTimes(2);
    expect(mocks.spawnSkycutterForPlayer).toHaveBeenCalledTimes(2);
    for (const call of mocks.spawnSkiffForPlayer.mock.calls) {
      expect(call[4]).toEqual({ trackAsPrimary: false });
    }
    for (const call of mocks.spawnSkycutterForPlayer.mock.calls) {
      expect(call[4]).toEqual({ trackAsPrimary: false });
    }
  });

  it("times out without mutating the hub when generation cannot finish", async () => {
    repository.load.mockReturnValue({ generatedIslandIds: [] });

    await expect(
      prepareDeveloperTestSetup(
        player as unknown as Player,
        repository as unknown as WorldStateRepository,
        new Logger("test", () => {}),
      ),
    ).rejects.toThrow(
      /Required islands did not finish within 60 seconds: starter_island, ember_outpost, frostspire/u,
    );

    expect(mocks.waitTicks).toHaveBeenCalledTimes(240);
    expect(player.teleport).not.toHaveBeenCalled();
    expect(dimension.getEntities).not.toHaveBeenCalled();
  });
});
