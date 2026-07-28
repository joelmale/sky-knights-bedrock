import assert from "node:assert/strict";

import { patchGameTestLevelDat } from "./level-dat.mjs";
import { TAG, readLevelDat, writeLevelDat } from "./nbt.mjs";
import {
  CANONICAL_VOID_LAYERS,
  inspectVoidLevelDat,
  patchVoidLevelDat,
  VOID_SOURCE_METADATA,
} from "./void-level-dat.mjs";

const DEFAULT_FLAT_WORLD_LAYERS =
  '{"biome_id":1,"block_layers":[{"block_name":"minecraft:bedrock","count":1},{"block_name":"minecraft:dirt","count":2},{"block_name":"minecraft:grass_block","count":1}],"encoding_version":6,"structure_options":null,"world_version":"version.post_1_18"}\n';

function fixture({ experimentKey } = {}) {
  const experiments = new Map([
    ["experiments_ever_used", { type: TAG.Byte, value: 0 }],
    ["saved_with_toggled_experiments", { type: TAG.Byte, value: 0 }],
  ]);

  if (experimentKey !== undefined) {
    experiments.set(experimentKey, { type: TAG.Byte, value: 0 });
  }

  return writeLevelDat({
    storageVersion: 10,
    rootName: "",
    root: new Map([
      ["Generator", { type: TAG.Int, value: 1 }],
      [
        "FlatWorldLayers",
        { type: TAG.String, value: DEFAULT_FLAT_WORLD_LAYERS },
      ],
      ["RandomSeed", { type: TAG.Long, value: 42n }],
      ["GameType", { type: TAG.Int, value: 1 }],
      ["ForceGameType", { type: TAG.Byte, value: 0 }],
      ["cheatsEnabled", { type: TAG.Byte, value: 0 }],
      ["commandsEnabled", { type: TAG.Byte, value: 0 }],
      ["LevelName", { type: TAG.String, value: "NBT fixture" }],
      ["SpawnX", { type: TAG.Int, value: -2_147_483_648 }],
      ["SpawnY", { type: TAG.Int, value: -2_147_483_648 }],
      ["SpawnZ", { type: TAG.Int, value: -2_147_483_648 }],
      ["experiments", { type: TAG.Compound, value: experiments }],
    ]),
  });
}

const original = fixture({ experimentKey: "gametest" });
assert.deepEqual(writeLevelDat(readLevelDat(original)), original);

const patched = patchGameTestLevelDat(original);
const parsed = readLevelDat(patched.buffer);
assert.equal(parsed.root.get("Generator")?.value, 2);
assert.equal(parsed.root.get("cheatsEnabled")?.value, 1);
assert.equal(parsed.root.get("commandsEnabled")?.value, 1);
assert.equal(parsed.root.get("experiments")?.value.get("gametest")?.value, 1);
const bootstrap = readLevelDat(patchGameTestLevelDat(fixture()).buffer);
assert.equal(
  bootstrap.root.get("experiments")?.value.get("gametest")?.value,
  1,
);

const voidPatched = patchVoidLevelDat(original);
const voidLevel = readLevelDat(voidPatched);
assert.equal(voidLevel.root.get("Generator")?.value, 2);
assert.equal(
  voidLevel.root.get("FlatWorldLayers")?.value,
  CANONICAL_VOID_LAYERS,
);
assert.deepEqual(inspectVoidLevelDat(voidPatched), {
  storageVersion: 10,
  generator: 2,
  flatWorldLayers: CANONICAL_VOID_LAYERS,
  layers: {
    biome_id: 1,
    block_layers: [{ block_name: "minecraft:air", count: 1 }],
    encoding_version: 6,
    preset_id: null,
    structure_options: null,
    world_version: "version.post_1_18",
  },
  experiments: {
    experiments_ever_used: 0,
    saved_with_toggled_experiments: 0,
    gametest: 0,
  },
  ...VOID_SOURCE_METADATA,
});
assert.equal(voidLevel.root.get("RandomSeed")?.type, TAG.Long);
assert.equal(
  voidLevel.root.get("RandomSeed")?.value,
  BigInt(VOID_SOURCE_METADATA.randomSeed),
);
assert.equal(voidLevel.root.get("GameType")?.value, 0);
assert.equal(voidLevel.root.get("ForceGameType")?.value, 1);
assert.equal(voidLevel.root.get("cheatsEnabled")?.value, 1);
assert.equal(voidLevel.root.get("commandsEnabled")?.value, 1);
assert.equal(
  voidLevel.root.get("LevelName")?.value,
  VOID_SOURCE_METADATA.levelName,
);
assert.equal(voidLevel.root.get("SpawnX")?.value, 10);
assert.equal(voidLevel.root.get("SpawnY")?.value, 161);
assert.equal(voidLevel.root.get("SpawnZ")?.value, 1);
assert.deepEqual(patchVoidLevelDat(voidPatched), voidPatched);

const malformedLayers = readLevelDat(original);
malformedLayers.root.get("FlatWorldLayers").value = "{";
assert.throws(
  () => patchVoidLevelDat(writeLevelDat(malformedLayers)),
  /not valid JSON/,
);

const wrongLayerType = readLevelDat(original);
wrongLayerType.root.set("FlatWorldLayers", { type: TAG.Int, value: 0 });
assert.throws(
  () => patchVoidLevelDat(writeLevelDat(wrongLayerType)),
  /Expected level\.dat FlatWorldLayers/,
);

const nonVoidLayers = readLevelDat(voidPatched);
nonVoidLayers.root.get("FlatWorldLayers").value = CANONICAL_VOID_LAYERS.replace(
  "minecraft:air",
  "minecraft:grass_block",
);
assert.throws(
  () => inspectVoidLevelDat(writeLevelDat(nonVoidLayers)),
  /minecraft:air layer/,
);

const changedSpawn = readLevelDat(voidPatched);
changedSpawn.root.get("SpawnY").value = 32767;
const changedSpawnBuffer = writeLevelDat(changedSpawn);
assert.throws(() => inspectVoidLevelDat(changedSpawnBuffer), /client metadata/);
assert.equal(
  inspectVoidLevelDat(changedSpawnBuffer, {
    requireClientMetadata: false,
  }).spawn.y,
  32767,
);

const enabledExperiment = readLevelDat(voidPatched);
enabledExperiment.root.get("experiments").value.get("gametest").value = 1;
assert.throws(
  () => inspectVoidLevelDat(writeLevelDat(enabledExperiment)),
  /must remain disabled/,
);

const missingExperimentBookkeeping = readLevelDat(voidPatched);
missingExperimentBookkeeping.root
  .get("experiments")
  .value.delete("experiments_ever_used");
assert.throws(
  () => inspectVoidLevelDat(writeLevelDat(missingExperimentBookkeeping)),
  /bookkeeping flag/,
);

assert.throws(
  () => readLevelDat(Buffer.concat([original, Buffer.from([0])])),
  /declares/,
);
assert.throws(
  () => readLevelDat(original.subarray(0, original.length - 1)),
  /declares/,
);

const trailing = Buffer.concat([original, Buffer.from([0])]);
trailing.writeInt32LE(trailing.length - 8, 4);
assert.throws(() => readLevelDat(trailing), /trailing NBT bytes/);

const truncated = Buffer.from(original.subarray(0, original.length - 1));
truncated.writeInt32LE(truncated.length - 8, 4);
assert.throws(() => readLevelDat(truncated), /Truncated NBT/);

const invalidArrayLength = Buffer.from([
  10, 0, 0, 7, 1, 0, 97, 255, 255, 255, 255, 0,
]);
const invalidArrayLevel = Buffer.alloc(8 + invalidArrayLength.length);
invalidArrayLevel.writeInt32LE(10, 0);
invalidArrayLevel.writeInt32LE(invalidArrayLength.length, 4);
invalidArrayLength.copy(invalidArrayLevel, 8);
assert.throws(
  () => readLevelDat(invalidArrayLevel),
  /Invalid byte-array length/,
);
assert.throws(
  () =>
    writeLevelDat({
      storageVersion: 10,
      rootName: "x".repeat(65_536),
      root: new Map(),
    }),
  /maximum is 65535/,
);
assert.throws(
  () =>
    writeLevelDat({
      storageVersion: 10,
      rootName: "",
      root: new Map([["invalid", { type: TAG.Byte, value: 128 }]]),
    }),
  /Invalid byte value/,
);
assert.throws(
  () =>
    writeLevelDat({
      storageVersion: 10,
      rootName: "",
      root: new Map([
        [
          "invalid",
          {
            type: TAG.IntArray,
            value: new Array(1_000_001),
          },
        ],
      ]),
    }),
  /Invalid int-array length/,
);

process.stdout.write("BDS NBT fixture tests passed.\n");
