import { describe, expect, it } from "vitest";
import {
  AirshipRepository,
  deterministicAirshipId,
} from "../scripts/skycraft/runtime/repository";
import { AirshipState } from "../scripts/skycraft/types";
class MemoryHost {
  public readonly values = new Map<string, string>();
  public getDynamicProperty(key: string) {
    return this.values.get(key);
  }
  public setDynamicProperty(key: string, value?: string) {
    if (value === undefined) this.values.delete(key);
    else this.values.set(key, value);
  }
}
const state: AirshipState = {
  schemaVersion: 1,
  airshipId: "airship_a",
  ownerPlayerId: "owner",
  crew: [],
  transaction: "docked",
  dockedHelmPosition: {
    x: 0,
    y: 0,
    z: 0,
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
      {
        x: 0,
        y: 0,
        z: 0,
        typeId: "skyknights:basic_helm",
        states: {},
      },
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
describe("skycraft runtime repository", () => {
  it("chunks state and fails closed on corrupt state", () => {
    const host = new MemoryHost();
    const repository = new AirshipRepository(host);
    repository.save(state);
    expect(repository.load("airship_a")?.airshipId).toBe("airship_a");
    host.values.set("skyknights:airship_v1:airship_a:0", "{");
    expect(repository.load("airship_a")).toBeUndefined();
    expect(deterministicAirshipId("owner", "berth")).toBe(
      deterministicAirshipId("owner", "berth"),
    );
  });

  it("never replaces a corrupt fleet index or reuses a registered id", () => {
    const host = new MemoryHost();
    const repository = new AirshipRepository(host);
    repository.save(state);
    const next = repository.nextId("owner", "b");
    expect(next).not.toBe(state.airshipId);
    expect(repository.nextId("owner", "b")).toBe(next);

    host.values.set("skyknights:airship_index_v1", "{");
    expect(() => repository.ids()).toThrow(/corrupt/);
    expect(() =>
      repository.save({
        ...state,
        airshipId: "airship_b",
        blueprint: { ...state.blueprint, airshipId: "airship_b" },
      }),
    ).toThrow(/corrupt/);
  });

  it("rejects dock coordinates and crew policy that could escape authority", () => {
    const repository = new AirshipRepository(new MemoryHost());
    expect(() =>
      repository.save({
        ...state,
        dockedHelmPosition: {
          x: 99,
          y: 0,
          z: 0,
          dimensionId: "minecraft:overworld",
        },
      }),
    ).toThrow(/invalid Skycraft record/u);
    expect(() =>
      repository.save({
        ...state,
        crew: [{ playerId: "owner", roles: ["owner"] }],
      }),
    ).toThrow(/invalid Skycraft record/u);
  });
});
