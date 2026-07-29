import { beforeEach, describe, expect, it, vi } from "vitest";

import { IDENTIFIERS } from "../scripts/config/constants";

const minecraftMocks = vi.hoisted(() => {
  const intervalCallbacks: Array<() => void> = [];
  const playerLeaveCallbacks: Array<(event: { playerId: string }) => void> = [];

  return {
    intervalCallbacks,
    playerLeaveCallbacks,
    players: [] as Array<unknown>,
  };
});

vi.mock("@minecraft/server", () => ({
  EntityComponentTypes: {
    Riding: "minecraft:riding",
  },
  system: {
    runInterval: (callback: () => void) => {
      minecraftMocks.intervalCallbacks.push(callback);
      return minecraftMocks.intervalCallbacks.length;
    },
  },
  world: {
    afterEvents: {
      playerLeave: {
        subscribe: (callback: (event: { playerId: string }) => void) => {
          minecraftMocks.playerLeaveCallbacks.push(callback);
          return callback;
        },
      },
    },
    getAllPlayers: () => minecraftMocks.players,
  },
}));

import { Logger, LogRecord } from "../scripts/diagnostics/logger";
import { initializePrototypeCraftCameraAssist } from "../scripts/gameplay/prototype-craft-camera";

// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const OUTRIGGER_BEHAVIOR_SOURCES: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/entities/aether_outrigger.json",
  { eager: true, query: "?raw", import: "default" },
);
// @ts-expect-error Vite injects import.meta.glob; there is no @types/node here.
const BLIMP_BEHAVIOR_SOURCES: Record<string, string> = import.meta.glob(
  "../behavior_packs/sk_bp/entities/steampunk_blimp.json",
  { eager: true, query: "?raw", import: "default" },
);

interface MockPlayer {
  id: string;
  camera: {
    clear: ReturnType<typeof vi.fn>;
    setCamera: ReturnType<typeof vi.fn>;
  };
  getComponent: ReturnType<typeof vi.fn>;
}

function player(id: string, mountedTypeId?: string): MockPlayer {
  return {
    id,
    camera: {
      clear: vi.fn(),
      setCamera: vi.fn(),
    },
    getComponent: vi.fn(() =>
      mountedTypeId === undefined
        ? undefined
        : {
            entityRidingOn: {
              typeId: mountedTypeId,
            },
          },
    ),
  };
}

function onlyValue(sources: Record<string, string>): string {
  const keys = Object.keys(sources);
  if (keys.length !== 1) {
    throw new Error(`Expected exactly one source, found ${keys.length}.`);
  }
  return sources[keys[0]];
}

describe("prototype craft camera assist", () => {
  let records: LogRecord[];

  beforeEach(() => {
    records = [];
    minecraftMocks.intervalCallbacks.length = 0;
    minecraftMocks.playerLeaveCallbacks.length = 0;
    minecraftMocks.players.length = 0;
  });

  it("sets third person once on boarding and clears once on dismount", () => {
    const rider = player("rider", IDENTIFIERS.aetherOutrigger);
    minecraftMocks.players.push(rider);
    initializePrototypeCraftCameraAssist(
      new Logger("test", (record) => records.push(record)),
    );

    expect(minecraftMocks.intervalCallbacks).toHaveLength(1);
    const sweep = minecraftMocks.intervalCallbacks[0];
    sweep();
    sweep();

    expect(rider.camera.setCamera).toHaveBeenCalledTimes(1);
    expect(rider.camera.setCamera).toHaveBeenCalledWith(
      "minecraft:third_person",
    );

    rider.getComponent.mockReturnValue(undefined);
    sweep();
    sweep();

    expect(rider.camera.clear).toHaveBeenCalledTimes(1);
    expect(records).toEqual([]);
  });

  it("supports the blimp but does not affect unrelated mounts", () => {
    const blimpRider = player("blimp", IDENTIFIERS.steampunkBlimp);
    const skiffRider = player("skiff", IDENTIFIERS.skiff);
    minecraftMocks.players.push(blimpRider, skiffRider);
    initializePrototypeCraftCameraAssist(new Logger("test", () => {}));

    minecraftMocks.intervalCallbacks[0]();

    expect(blimpRider.camera.setCamera).toHaveBeenCalledWith(
      "minecraft:third_person",
    );
    expect(skiffRider.camera.setCamera).not.toHaveBeenCalled();
    expect(skiffRider.camera.clear).not.toHaveBeenCalled();
  });

  it("forgets a departing rider without attempting an unavailable clear", () => {
    const rider = player("departing", IDENTIFIERS.aetherOutrigger);
    minecraftMocks.players.push(rider);
    initializePrototypeCraftCameraAssist(new Logger("test", () => {}));

    minecraftMocks.intervalCallbacks[0]();
    minecraftMocks.playerLeaveCallbacks[0]({ playerId: rider.id });
    minecraftMocks.players.length = 0;
    minecraftMocks.intervalCallbacks[0]();

    expect(rider.camera.setCamera).toHaveBeenCalledTimes(1);
    expect(rider.camera.clear).not.toHaveBeenCalled();
  });

  it("retries a failed camera activation without repeating the warning", () => {
    const rider = player("camera-error", IDENTIFIERS.steampunkBlimp);
    rider.camera.setCamera.mockImplementation(() => {
      throw new Error("camera unavailable");
    });
    minecraftMocks.players.push(rider);
    initializePrototypeCraftCameraAssist(
      new Logger("test", (record) => records.push(record)),
    );

    minecraftMocks.intervalCallbacks[0]();
    minecraftMocks.intervalCallbacks[0]();

    expect(rider.camera.setCamera).toHaveBeenCalledTimes(2);
    expect(records).toHaveLength(1);
    expect(records[0].message).toContain("Could not enable");
    expect(records[0].fields).toMatchObject({
      playerId: rider.id,
      error: "camera unavailable",
    });
  });

  it("retries camera cleanup until a dismounted player is released", () => {
    const rider = player("clear-error", IDENTIFIERS.aetherOutrigger);
    rider.camera.clear
      .mockImplementationOnce(() => {
        throw new Error("clear unavailable");
      })
      .mockImplementationOnce(() => undefined);
    minecraftMocks.players.push(rider);
    initializePrototypeCraftCameraAssist(
      new Logger("test", (record) => records.push(record)),
    );

    const sweep = minecraftMocks.intervalCallbacks[0];
    sweep();
    rider.getComponent.mockReturnValue(undefined);
    sweep();
    sweep();
    sweep();

    expect(rider.camera.clear).toHaveBeenCalledTimes(2);
    expect(records).toHaveLength(1);
    expect(records[0].message).toContain("Could not clear");
    expect(records[0].fields).toMatchObject({
      playerId: rider.id,
      error: "clear unavailable",
    });
  });
});

describe("prototype craft rideable camera contracts", () => {
  it("moves the enlarged Outrigger seats forward and expands its orbit", () => {
    const behavior = JSON.parse(onlyValue(OUTRIGGER_BEHAVIOR_SOURCES));
    const components = behavior["minecraft:entity"].components;
    const rideable = components["minecraft:rideable"];

    expect(components["minecraft:collision_box"]).toEqual({
      width: 5.6,
      height: 3,
    });
    expect(rideable).not.toHaveProperty("dismount_mode");
    expect(
      rideable.seats.map(({ position }: { position: number[] }) => position),
    ).toEqual([
      [0, 1.15, -1.3],
      [0, 1.15, -0.55],
    ]);
    expect(
      rideable.seats.map(
        ({
          third_person_camera_radius,
        }: {
          third_person_camera_radius: number;
        }) => third_person_camera_radius,
      ),
    ).toEqual([12, 12]);
  });

  it("gives every Blimp seat a large third-person orbit", () => {
    const behavior = JSON.parse(onlyValue(BLIMP_BEHAVIOR_SOURCES));
    const seats =
      behavior["minecraft:entity"].components["minecraft:rideable"].seats;

    expect(
      seats.map(
        ({
          third_person_camera_radius,
        }: {
          third_person_camera_radius: number;
        }) => third_person_camera_radius,
      ),
    ).toEqual([16, 16, 16, 16]);
  });
});
