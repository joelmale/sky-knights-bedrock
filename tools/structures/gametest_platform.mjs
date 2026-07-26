// Holding platform used by the GameTest profile. Not an island body, so it
// skips `shape.mjs` entirely and writes indices directly.

import { structureBuffer } from "./nbt.mjs";

const SIZE = [5, 3, 5];

const PALETTE = ["minecraft:air", "minecraft:stone"];

const BLOCK = {
  air: 0,
  stone: 1,
};

function build() {
  const [width, height, depth] = SIZE;
  const indices = [];

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        indices.push(y === 0 ? BLOCK.stone : BLOCK.air);
      }
    }
  }

  return structureBuffer(SIZE, PALETTE, indices);
}

export const island = {
  id: "gametest_platform",
  family: undefined,
  tier: 0,
  structureId: "skyknights_tests:platform",
  outputPath: [
    "profiles",
    "gametest",
    "behavior_pack",
    "structures",
    "skyknights_tests",
    "platform.mcstructure",
  ],
  size: SIZE,
  palette: PALETTE,
  body: undefined,
  anchors: {
    safeDock: { x: 2.5, y: 1, z: 2.5 },
  },
  integrityBlocks: [
    { offset: { x: 2, y: 0, z: 2 }, typeId: "minecraft:stone" },
  ],
  build,
};
