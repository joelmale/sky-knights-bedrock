import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  playerRepositoryConstructed: vi.fn(),
  playerLoad: vi.fn(),
  playerSave: vi.fn(),
  shipRepositoryConstructed: vi.fn(),
  shipLoad: vi.fn(),
  shipSave: vi.fn(),
  getAllPlayers: vi.fn(),
  getDimension: vi.fn(),
}));

vi.mock("@minecraft/server", () => ({
  Entity: class {},
  Player: class {},
  EntityComponentTypes: {
    Tameable: "minecraft:tameable",
  },
  system: {
    currentTick: 42,
  },
  world: {
    getAllPlayers: mocks.getAllPlayers,
    getDimension: mocks.getDimension,
  },
}));

vi.mock("../scripts/persistence/repositories", () => ({
  PlayerStateRepository: class {
    public constructor(...args: unknown[]) {
      mocks.playerRepositoryConstructed(...args);
    }

    public load(): unknown {
      return mocks.playerLoad();
    }

    public save(state: unknown): void {
      mocks.playerSave(state);
    }
  },
  ShipStateRepository: class {
    public constructor(...args: unknown[]) {
      mocks.shipRepositoryConstructed(...args);
    }

    public load(): unknown {
      return mocks.shipLoad();
    }

    public save(state: unknown): void {
      mocks.shipSave(state);
    }
  },
}));

import { Player } from "@minecraft/server";

import { IDENTIFIERS } from "../scripts/config/constants";
import { Logger } from "../scripts/diagnostics/logger";
import { adoptNearbyOwnedShip } from "../scripts/gameplay/ship-docking";
import {
  NON_PRIMARY_SHIP_TAG,
  spawnSkiffForPlayer,
  updateOwnedShipTracking,
} from "../scripts/gameplay/skiff";

function initialShipState() {
  return {
    shipId: "ship-existing",
    ownerPlayerId: "",
    homeDock: {
      dimensionId: "minecraft:overworld",
      x: 0,
      y: 0,
      z: 0,
    },
    docked: false,
    configuration: {
      frame: "skiff",
      modules: {},
    },
  };
}

describe("non-primary owned ships", () => {
  let ship: {
    id: string;
    typeId: string;
    location: { x: number; y: number; z: number };
    dimension: { id: string };
    nameTag: string;
    addTag: ReturnType<typeof vi.fn>;
    removeTag: ReturnType<typeof vi.fn>;
    hasTag: ReturnType<typeof vi.fn>;
    triggerEvent: ReturnType<typeof vi.fn>;
    getComponent: ReturnType<typeof vi.fn>;
  };
  let player: {
    id: string;
    name: string;
    dimension: {
      id: string;
      spawnEntity: ReturnType<typeof vi.fn>;
    };
    location: { x: number; y: number; z: number };
    getViewDirection: ReturnType<typeof vi.fn>;
  };
  let tame: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    tame = vi.fn();
    ship = {
      id: "entity-12345678",
      typeId: IDENTIFIERS.skiff,
      location: { x: 24.5, y: 164, z: -7.5 },
      dimension: { id: "minecraft:overworld" },
      nameTag: "",
      addTag: vi.fn(),
      removeTag: vi.fn(),
      hasTag: vi.fn(() => false),
      triggerEvent: vi.fn(),
      getComponent: vi.fn(() => ({ tame })),
    };
    player = {
      id: "player-1",
      name: "Tester",
      dimension: {
        id: "minecraft:overworld",
        spawnEntity: vi.fn(() => ship),
      },
      location: { x: 0, y: 161, z: 0 },
      getViewDirection: vi.fn(() => ({ x: 1, y: 0, z: 0 })),
    };
    mocks.playerLoad.mockReturnValue({
      ownedShip: {
        shipId: "real-ship",
      },
    });
    mocks.shipLoad.mockImplementation(initialShipState);
    mocks.getAllPlayers.mockReturnValue([]);
    mocks.getDimension.mockReturnValue({
      getEntities: vi.fn(() => []),
    });
  });

  it("retains entity ownership without replacing the canonical ship", () => {
    spawnSkiffForPlayer(
      player as unknown as Player,
      new Logger("test", () => {}),
      ship.location,
      undefined,
      { trackAsPrimary: false },
    );

    expect(tame).toHaveBeenCalledWith(player);
    expect(mocks.shipSave).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerPlayerId: player.id,
        ownerName: player.name,
        docked: true,
      }),
    );
    expect(mocks.playerRepositoryConstructed).not.toHaveBeenCalled();
    expect(mocks.playerSave).not.toHaveBeenCalled();
    expect(ship.addTag).toHaveBeenCalledWith(NON_PRIMARY_SHIP_TAG);
  });

  it("keeps normal spawns as the canonical tracked ship", () => {
    spawnSkiffForPlayer(
      player as unknown as Player,
      new Logger("test", () => {}),
      ship.location,
    );

    expect(mocks.playerRepositoryConstructed).toHaveBeenCalled();
    expect(mocks.playerSave).toHaveBeenCalledWith(
      expect.objectContaining({
        ownedShip: expect.objectContaining({
          entityId: ship.id,
          frame: "skiff",
        }),
      }),
    );
    expect(ship.addTag).not.toHaveBeenCalledWith(NON_PRIMARY_SHIP_TAG);
  });

  it("marks a non-primary spawn before fallible initialization", () => {
    mocks.shipRepositoryConstructed.mockImplementationOnce(() => {
      throw new Error("repository unavailable");
    });

    expect(() =>
      spawnSkiffForPlayer(
        player as unknown as Player,
        new Logger("test", () => {}),
        ship.location,
        undefined,
        { trackAsPrimary: false },
      ),
    ).toThrow(/repository unavailable/u);

    expect(ship.addTag).toHaveBeenCalledWith(NON_PRIMARY_SHIP_TAG);
    expect(mocks.playerRepositoryConstructed).not.toHaveBeenCalled();
  });

  it("excludes non-primary ships from the periodic canonical tracker", () => {
    ship.hasTag.mockImplementation(
      (tag: string) => tag === NON_PRIMARY_SHIP_TAG,
    );
    mocks.getDimension.mockReturnValue({
      getEntities: vi.fn(() => [ship]),
    });

    updateOwnedShipTracking();

    expect(ship.hasTag).toHaveBeenCalledWith(NON_PRIMARY_SHIP_TAG);
    expect(mocks.shipRepositoryConstructed).not.toHaveBeenCalled();
    expect(mocks.playerSave).not.toHaveBeenCalled();
  });

  it("excludes a nearby non-primary ship from canonical adoption", () => {
    ship.hasTag.mockImplementation(
      (tag: string) => tag === NON_PRIMARY_SHIP_TAG,
    );
    mocks.playerLoad.mockReturnValue({ ownedShip: undefined });
    mocks.getDimension.mockReturnValue({
      getEntities: vi.fn(() => [ship]),
    });

    expect(adoptNearbyOwnedShip(player as unknown as Player)).toBeUndefined();
    expect(mocks.shipRepositoryConstructed).not.toHaveBeenCalled();
    expect(mocks.playerSave).not.toHaveBeenCalled();
  });
});
