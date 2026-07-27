import { describe, expect, it } from "vitest";
import {
  SkycraftExecutor,
  RuntimeWorld,
} from "../scripts/skycraft/runtime/executor";
import { AirshipRepository } from "../scripts/skycraft/runtime/repository";
import { AirshipState, BlockPosition } from "../scripts/skycraft/types";
class Host {
  values = new Map<string, string>();
  getDynamicProperty(key: string) {
    return this.values.get(key);
  }
  setDynamicProperty(key: string, value?: string) {
    if (value === undefined) this.values.delete(key);
    else this.values.set(key, value);
  }
}
function key(p: BlockPosition) {
  return `${p.x},${p.y},${p.z}`;
}
class World implements RuntimeWorld {
  blocks = new Map<
    string,
    {
      typeId: string;
      states: Readonly<Record<string, string | number | boolean>>;
    }
  >();
  flights = new Set<string>();
  fail = "";
  getBlock(p: BlockPosition) {
    return this.blocks.get(key(p));
  }
  setBlock(
    p: BlockPosition,
    block?: {
      typeId: string;
      states: Readonly<Record<string, string | number | boolean>>;
    },
  ) {
    if (this.fail === "set") throw new Error("set");
    if (block === undefined) this.blocks.delete(key(p));
    else this.blocks.set(key(p), block);
  }
  spawnFlight() {
    if (this.fail === "spawn") throw new Error("spawn");
    this.flights.add("flight");
    return "flight";
  }
  configureFlight() {
    if (this.fail === "configure") throw new Error("configure");
  }
  removeFlight(id: string) {
    if (this.fail === "remove") throw new Error("remove");
    this.flights.delete(id);
  }
  flightExists(id: string) {
    return this.flights.has(id);
  }
}
function state(): AirshipState {
  return {
    schemaVersion: 1,
    airshipId: "airship_a",
    ownerPlayerId: "owner",
    crew: [],
    transaction: "docked",
    dockedHelmPosition: {
      x: 1,
      y: 1,
      z: 1,
      dimensionId: "minecraft:overworld",
    },
    blueprint: {
      schemaVersion: 1,
      airshipId: "airship_a",
      revision: 1,
      berth: {
        id: "b",
        dimensionId: "minecraft:overworld",
        origin: { x: 0, y: 0, z: 0 },
        size: { x: 7, y: 5, z: 7 },
        orientation: "north",
      },
      helm: { x: 0, y: 0, z: 0, typeId: "skyknights:basic_helm", states: {} },
      blocks: [
        { x: 0, y: 0, z: 0, typeId: "skyknights:basic_helm", states: {} },
        {
          x: 1,
          y: 0,
          z: 0,
          typeId: "skyknights:ship_core_block",
          states: {},
        },
      ],
      components: [
        {
          x: 0,
          y: 0,
          z: 0,
          typeId: "skyknights:basic_helm",
          states: {},
          kind: "helm",
        },
        {
          x: 1,
          y: 0,
          z: 0,
          typeId: "skyknights:ship_core_block",
          states: {},
          kind: "core",
        },
      ],
      engineeringVersion: 1,
    },
    cargo: { authority: "disabled", reservedMassSubunits: 0 },
    damage: { hullDamage: 0, damagedComponents: [] },
  };
}

function placeDock(world: World, current: AirshipState): void {
  for (const block of current.blueprint.blocks) {
    world.blocks.set(
      key({ x: 1 + block.x, y: 1 + block.y, z: 1 + block.z }),
      block,
    );
  }
}

describe("skycraft runtime executor", () => {
  it("launches then docks without duplicate authority", () => {
    const host = new Host();
    const world = new World();
    const current = state();
    placeDock(world, current);
    const executor = new SkycraftExecutor(new AirshipRepository(host), world);
    const launched = executor.launch(current, { x: 1, y: 1, z: 1 });
    expect(launched.ok).toBe(true);
    expect(world.blocks.size).toBe(0);
    const docked = executor.dock(launched.state, { x: 1, y: 1, z: 1 });
    expect(docked.ok).toBe(true);
    expect(world.blocks.size).toBe(2);
  });
  it("fails closed at each launch mutation boundary", () => {
    for (const failure of ["set", "spawn", "configure"]) {
      const host = new Host();
      const world = new World();
      const current = state();
      placeDock(world, current);
      world.fail = failure;
      const result = new SkycraftExecutor(
        new AirshipRepository(host),
        world,
      ).launch(current, { x: 1, y: 1, z: 1 });
      expect(result.state.transaction).toBe("recovery_required");
    }
  });
  it("fails closed at each docking mutation boundary", () => {
    for (const failure of ["set", "remove"]) {
      const host = new Host();
      const world = new World();
      const current = state();
      world.flights.add("flight");
      world.fail = failure;
      const inFlight = {
        ...current,
        transaction: "in_flight" as const,
        flightEntityId: "flight",
      };
      const result = new SkycraftExecutor(
        new AirshipRepository(host),
        world,
      ).dock(inFlight, { x: 1, y: 1, z: 1 });
      expect(result.state.transaction).toBe("recovery_required");
    }
  });

  it("refuses launch while a persisted repair bill is outstanding", () => {
    const host = new Host();
    const world = new World();
    const damaged = {
      ...state(),
      damage: {
        hullDamage: 1,
        damagedComponents: ["skyknights:lift_sail@0,0,1"],
      },
    };
    placeDock(world, damaged);

    const result = new SkycraftExecutor(
      new AirshipRepository(host),
      world,
    ).launch(damaged, { x: 1, y: 1, z: 1 });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Repair all/u);
    expect(world.blocks.size).toBe(2);
    expect(world.flights.size).toBe(0);
  });

  it("enforces the global active-craft safety cap before mutation", () => {
    const host = new Host();
    const repository = new AirshipRepository(host);
    const current = state();
    for (let index = 0; index < 4; index += 1) {
      const airshipId = `active_${index}`;
      repository.save({
        ...current,
        airshipId,
        transaction: "in_flight",
        flightEntityId: `flight_${index}`,
        blueprint: { ...current.blueprint, airshipId },
      });
    }
    const world = new World();
    placeDock(world, current);

    const result = new SkycraftExecutor(repository, world).launch(current, {
      x: 1,
      y: 1,
      z: 1,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/safety cap/u);
    expect(world.blocks.size).toBe(2);
    expect(world.flights.size).toBe(0);
  });

  it("recovers every unambiguous partial launch and docking state", () => {
    const launchWorld = new World();
    const launchState: AirshipState = {
      ...state(),
      transaction: "recovery_required",
      recoveryFrom: "launching",
      dockedHelmPosition: {
        x: 1,
        y: 1,
        z: 1,
        dimensionId: "minecraft:overworld",
      },
    };
    launchWorld.blocks.set("2,1,1", launchState.blueprint.blocks[1]);
    const launchRecovery = new SkycraftExecutor(
      new AirshipRepository(new Host()),
      launchWorld,
    ).recover(launchState);
    expect(launchRecovery.state.transaction).toBe("docked");
    expect(launchWorld.blocks.size).toBe(2);

    const flightWorld = new World();
    flightWorld.flights.add("flight");
    const flightRecovery = new SkycraftExecutor(
      new AirshipRepository(new Host()),
      flightWorld,
    ).recover({
      ...launchState,
      flightEntityId: "flight",
    });
    expect(flightRecovery.state.transaction).toBe("in_flight");

    const dockWorld = new World();
    dockWorld.flights.add("flight");
    dockWorld.blocks.set("1,1,1", launchState.blueprint.blocks[0]);
    const dockRecovery = new SkycraftExecutor(
      new AirshipRepository(new Host()),
      dockWorld,
    ).recover({
      ...launchState,
      recoveryFrom: "docking",
      flightEntityId: "flight",
    });
    expect(dockRecovery.state.transaction).toBe("docked");
    expect(dockWorld.blocks.size).toBe(2);
    expect(dockWorld.flights.size).toBe(0);

    const missingFlightWorld = new World();
    const missingFlightRecovery = new SkycraftExecutor(
      new AirshipRepository(new Host()),
      missingFlightWorld,
    ).recover({
      ...launchState,
      recoveryFrom: "in_flight",
      flightEntityId: "missing-flight",
    });
    expect(missingFlightRecovery.state.transaction).toBe("docked");
    expect(missingFlightRecovery.state.flightEntityId).toBeUndefined();
    expect(missingFlightWorld.blocks.size).toBe(2);
  });

  it("fails closed when launch recovery sees both complete authorities", () => {
    const world = new World();
    const current = state();
    placeDock(world, current);
    world.flights.add("flight");
    const result = new SkycraftExecutor(
      new AirshipRepository(new Host()),
      world,
    ).recover({
      ...current,
      transaction: "recovery_required",
      recoveryFrom: "launching",
      flightEntityId: "flight",
      dockedHelmPosition: {
        x: 1,
        y: 1,
        z: 1,
        dimensionId: "minecraft:overworld",
      },
    });
    expect(result.ok).toBe(false);
    expect(result.state.transaction).toBe("recovery_required");
    expect(world.blocks.size).toBe(2);
    expect(world.flights.size).toBe(1);
  });
});
