import assert from "node:assert/strict";

import { patchGameTestLevelDat } from "./level-dat.mjs";
import { TAG, readLevelDat, writeLevelDat } from "./nbt.mjs";

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
      ["cheatsEnabled", { type: TAG.Byte, value: 0 }],
      ["commandsEnabled", { type: TAG.Byte, value: 0 }],
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
