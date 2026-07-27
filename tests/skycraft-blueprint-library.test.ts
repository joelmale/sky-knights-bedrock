import { describe, expect, it } from "vitest";

import {
  BlueprintLibrary,
  normalizeBlueprintName,
} from "../scripts/skycraft/runtime/blueprint-library";
import { AirshipBlueprint } from "../scripts/skycraft/types";

class Host {
  public readonly values = new Map<string, string>();

  public getDynamicProperty(key: string): string | undefined {
    return this.values.get(key);
  }

  public setDynamicProperty(key: string, value?: string): void {
    if (value === undefined) {
      this.values.delete(key);
    } else {
      this.values.set(key, value);
    }
  }
}

const blueprint: AirshipBlueprint = {
  schemaVersion: 1,
  airshipId: "source",
  revision: 7,
  berth: {
    id: "berth",
    dimensionId: "minecraft:overworld",
    origin: { x: 0, y: 0, z: 0 },
    size: { x: 7, y: 5, z: 7 },
    orientation: "north",
  },
  helm: {
    x: 0,
    y: 0,
    z: 0,
    typeId: "skyknights:basic_helm",
    states: {},
  },
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
};

describe("skycraft blueprint library", () => {
  it("normalizes names and blocks unauthorized or conflicting writes", () => {
    const library = new BlueprintLibrary(new Host());
    expect(normalizeBlueprintName("  My  Raft ")).toBe("my raft");
    expect(
      library.save("guest", "owner", "My Raft", blueprint),
    ).toBeUndefined();
    expect(library.save("owner", "owner", "My Raft", blueprint)?.revision).toBe(
      1,
    );
    expect(
      library.save("owner", "owner", "My Raft", blueprint),
    ).toBeUndefined();
  });

  it("requires a matching revision and materializes a fresh immutable copy", () => {
    const library = new BlueprintLibrary(new Host());
    library.save("owner", "owner", "Raft", blueprint);
    expect(library.save("owner", "owner", "Raft", blueprint, 1)?.revision).toBe(
      2,
    );

    const copy = library.materialize("owner", "owner", "Raft", "new_ship");
    expect(copy?.airshipId).toBe("new_ship");
    expect(copy?.revision).toBe(1);
    expect(copy?.blocks).not.toBe(blueprint.blocks);
  });

  it("fails closed when an owner index or indexed record is corrupt", () => {
    const host = new Host();
    const library = new BlueprintLibrary(host);
    library.save("owner", "owner", "Raft", blueprint);

    const indexKey = [...host.values.keys()].find((key) =>
      key.includes("blueprint_index"),
    );
    expect(indexKey).toBeDefined();
    host.values.set(indexKey!, "{bad");
    expect(() => library.list("owner", "owner")).toThrow(/corrupt/u);

    host.values.clear();
    library.save("owner", "owner", "Raft", blueprint);
    const recordKey = [...host.values.keys()].find((key) =>
      key.includes("blueprint_v1"),
    );
    expect(recordKey).toBeDefined();
    host.values.set(recordKey!, "{}");
    expect(() => library.load("owner", "owner", "Raft")).toThrow(/corrupt/u);
  });
});
