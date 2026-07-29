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
    repository = {
      load: vi.fn(() => ({
        generatedIslandIds: REQUIRED_ISLANDS.map((island) => island.id),
      })),
    };
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
    mocks.spawnSkyRaiderForPlayer.mockReturnValue(
      fakeEntity("new-raider", IDENTIFIERS.skyRaider),
    );
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
      DEVELOPER_TEST_SETUP.raider,
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
