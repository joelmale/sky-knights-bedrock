import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { strFromU8, unzipSync } from "fflate";
import { afterEach, describe, expect, it } from "vitest";

import { TAG, writeLevelDat } from "../tools/bds/nbt.mjs";
import { patchVoidLevelDat } from "../tools/bds/void-level-dat.mjs";
import { packageWorldTemplate } from "../tools/package-world-template.mjs";

const roots: string[] = [];
const ids = {
  template: "3e26f44e-29f4-48d1-8316-1341fda5c7c6",
  module: "fcb9165b-bbb7-423b-b97b-2c9214c42af3",
  behavior: "11111111-1111-4111-8111-111111111111",
  resource: "22222222-2222-4222-8222-222222222222",
};
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});
const FIXTURE_VERSION = [0, 3, 5];

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "sky-template-"));
  roots.push(root);
  const write = async (relative: string, value: string | Uint8Array) => {
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, value);
  };
  const pack = (uuid: string) =>
    JSON.stringify({
      format_version: 2,
      header: { uuid, version: FIXTURE_VERSION },
    });
  // The packager reads its expected template version from the repository root
  // it is given, so the fixture root must carry one.
  await write(
    "package.json",
    JSON.stringify({ version: FIXTURE_VERSION.join(".") }),
  );
  await write("behavior_packs/sk_bp/manifest.json", pack(ids.behavior));
  await write("resource_packs/sk_rp/manifest.json", pack(ids.resource));
  await write("dist/scripts/main.js", "export {};");
  await write(
    "world_templates/manifest.json",
    JSON.stringify({
      format_version: 2,
      header: {
        name: "pack.name",
        description: "pack.description",
        version: FIXTURE_VERSION,
        uuid: ids.template,
        base_game_version: [1, 26, 30],
        lock_template_options: true,
      },
      modules: [
        { type: "world_template", version: FIXTURE_VERSION, uuid: ids.module },
      ],
    }),
  );
  await write(
    "world_templates/texts/en_US.lang",
    "pack.name=Sky Knights\npack.description=Void",
  );
  await write("world_templates/texts/languages.json", '["en_US"]');
  const baseLevelDat = writeLevelDat({
    storageVersion: 10,
    rootName: "",
    root: new Map([
      ["Generator", { type: TAG.Int, value: 1 }],
      [
        "FlatWorldLayers",
        {
          type: TAG.String,
          value:
            '{"biome_id":1,"block_layers":[{"block_name":"minecraft:air","count":1}],"encoding_version":6,"preset_id":null,"structure_options":null,"world_version":"version.post_1_18"}\n',
        },
      ],
      ["RandomSeed", { type: TAG.Long, value: (globalThis as any).BigInt(42) }],
      ["GameType", { type: TAG.Int, value: 1 }],
      ["ForceGameType", { type: TAG.Byte, value: 0 }],
      ["cheatsEnabled", { type: TAG.Byte, value: 0 }],
      ["commandsEnabled", { type: TAG.Byte, value: 0 }],
      ["LevelName", { type: TAG.String, value: "Fixture" }],
      ["SpawnX", { type: TAG.Int, value: -2_147_483_648 }],
      ["SpawnY", { type: TAG.Int, value: -2_147_483_648 }],
      ["SpawnZ", { type: TAG.Int, value: -2_147_483_648 }],
      [
        "experiments",
        {
          type: TAG.Compound,
          value: new Map([
            ["experiments_ever_used", { type: TAG.Byte, value: 0 }],
            ["saved_with_toggled_experiments", { type: TAG.Byte, value: 0 }],
          ]),
        },
      ],
    ]),
  });
  const levelDat = patchVoidLevelDat(baseLevelDat);
  await write("source/level.dat", levelDat);
  await write("source/level.dat_old", levelDat);
  await write("source/levelname.txt", "Sky Knights: Void Realm\n");
  await write("source/db/CURRENT", "db");
  await write("source/behavior_packs/stale/old.txt", "old");
  await write("source/world_behavior_pack_history.json", "old");
  return {
    root,
    source: path.join(root, "source"),
    output: path.join(root, "output"),
  };
}
describe("world template packager", () => {
  it("packages exact root assets and strips stale source bindings", async () => {
    const paths = await fixture();
    const result = await packageWorldTemplate({
      rootDirectory: paths.root,
      sourceWorld: paths.source,
      outputRoot: paths.output,
    });
    const entries = unzipSync(
      new Uint8Array(await readFile(result.templatePath)),
    );
    expect(JSON.parse(strFromU8(entries["manifest.json"])).header.uuid).toBe(
      ids.template,
    );
    expect(entries["texts/en_US.lang"]).toBeDefined();
    expect(entries["behavior_packs/sk_bp/manifest.json"]).toBeDefined();
    expect(entries["resource_packs/sk_rp/manifest.json"]).toBeDefined();
    expect(entries["behavior_packs/stale/old.txt"]).toBeUndefined();
    expect(entries["world_behavior_pack_history.json"]).toBeUndefined();
    expect(JSON.parse(strFromU8(entries["world_behavior_packs.json"]))).toEqual(
      [{ pack_id: ids.behavior, version: FIXTURE_VERSION }],
    );
    expect(
      strFromU8(
        await readFile(path.join(paths.source, "behavior_packs/stale/old.txt")),
      ),
    ).toBe("old");
    expect(Object.keys(entries)).toEqual([...Object.keys(entries)].sort());
  });
  // A SHA-256 recorded as evidence is worthless if repacking identical content
  // changes it. fflate stamps the current time onto every entry unless told
  // otherwise, so this pins the archive to a fixed timestamp.
  it("packages identical content to a byte-identical archive", async () => {
    const paths = await fixture();
    const build = async () =>
      readFile(
        (
          await packageWorldTemplate({
            rootDirectory: paths.root,
            sourceWorld: paths.source,
            outputRoot: paths.output,
          })
        ).templatePath,
      );

    const first = new Uint8Array(await build());
    const second = new Uint8Array(await build());

    expect(second.length).toBe(first.length);
    expect([...second]).toEqual([...first]);
  });

  it("rejects incomplete sources and overlap", async () => {
    const paths = await fixture();
    await rm(path.join(paths.source, "level.dat"));
    await expect(
      packageWorldTemplate({
        rootDirectory: paths.root,
        sourceWorld: paths.source,
        outputRoot: paths.output,
      }),
    ).rejects.toThrow(/Bedrock world/);
    await writeFile(path.join(paths.source, "level.dat"), "level");
    await rm(path.join(paths.source, "db"), { recursive: true });
    await expect(
      packageWorldTemplate({
        rootDirectory: paths.root,
        sourceWorld: paths.source,
        outputRoot: paths.output,
      }),
    ).rejects.toThrow(/complete Bedrock/);
    await expect(
      packageWorldTemplate({
        rootDirectory: paths.root,
        sourceWorld: paths.output,
        outputRoot: paths.output,
      }),
    ).rejects.toThrow(/overlap/);
  });
  it("rejects unsafe source metadata and live-world locks", async () => {
    const paths = await fixture();
    await writeFile(path.join(paths.source, "session.lock"), "live");
    await expect(
      packageWorldTemplate({
        rootDirectory: paths.root,
        sourceWorld: paths.source,
        outputRoot: paths.output,
      }),
    ).rejects.toThrow(/live or uncleanly closed/);
    await rm(path.join(paths.source, "session.lock"));
    await writeFile(path.join(paths.source, "level.dat"), "not nbt");
    await expect(
      packageWorldTemplate({
        rootDirectory: paths.root,
        sourceWorld: paths.source,
        outputRoot: paths.output,
      }),
    ).rejects.toThrow();
  });
});
