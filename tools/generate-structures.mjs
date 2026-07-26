import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const Tag = {
  End: 0,
  Int: 3,
  String: 8,
  List: 9,
  Compound: 10,
};

class BinaryWriter {
  chunks = [];

  byte(value) {
    const buffer = Buffer.allocUnsafe(1);
    buffer.writeUInt8(value);
    this.chunks.push(buffer);
  }

  int(value) {
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeInt32LE(value);
    this.chunks.push(buffer);
  }

  string(value) {
    const encoded = Buffer.from(value, "utf8");
    const length = Buffer.allocUnsafe(2);
    length.writeUInt16LE(encoded.length);
    this.chunks.push(length, encoded);
  }

  finish() {
    return Buffer.concat(this.chunks);
  }
}

const int = (value) => ({ type: Tag.Int, value });
const string = (value) => ({ type: Tag.String, value });
const list = (childType, value) => ({ type: Tag.List, childType, value });
const compound = (value) => ({ type: Tag.Compound, value });

function writeNamedTag(writer, name, tag) {
  writer.byte(tag.type);
  writer.string(name);
  writePayload(writer, tag);
}

function writePayload(writer, tag) {
  switch (tag.type) {
    case Tag.Int:
      writer.int(tag.value);
      break;
    case Tag.String:
      writer.string(tag.value);
      break;
    case Tag.List:
      writer.byte(tag.childType);
      writer.int(tag.value.length);
      for (const item of tag.value) {
        writePayload(
          writer,
          tag.childType === Tag.List
            ? {
                type: tag.childType,
                value: item.value,
                childType: item.childType,
              }
            : {
                type: tag.childType,
                value: item,
              },
        );
      }
      break;
    case Tag.Compound:
      for (const [name, child] of Object.entries(tag.value)) {
        writeNamedTag(writer, name, child);
      }
      writer.byte(Tag.End);
      break;
    default:
      throw new Error(`Unsupported NBT tag type ${tag.type}.`);
  }
}

function structureBuffer(size, palette, primaryIndices) {
  const expectedBlockCount = size[0] * size[1] * size[2];

  if (primaryIndices.length !== expectedBlockCount) {
    throw new Error(
      `Structure has ${primaryIndices.length} indices; expected ${expectedBlockCount}.`,
    );
  }

  const writer = new BinaryWriter();
  const secondaryIndices = new Array(primaryIndices.length).fill(-1);
  const blockPalette = palette.map((name) => ({
    name: string(name),
    states: compound({}),
    version: int(18168865),
  }));
  const document = compound({
    format_version: int(1),
    size: list(Tag.Int, size),
    structure: compound({
      block_indices: list(Tag.List, [
        { childType: Tag.Int, value: primaryIndices },
        { childType: Tag.Int, value: secondaryIndices },
      ]),
      entities: list(Tag.Compound, []),
      palette: compound({
        default: compound({
          block_palette: list(Tag.Compound, blockPalette),
          block_position_data: compound({}),
        }),
      }),
    }),
    structure_world_origin: list(Tag.Int, [0, 0, 0]),
  });

  writeNamedTag(writer, "", document);
  return writer.finish();
}

function zyxIndex(size, x, y, z) {
  return x * size[1] * size[2] + y * size[2] + z;
}

function starterIsland() {
  const size = [31, 16, 23];
  const [width, height, depth] = size;
  const indices = [];
  const centerX = 12;
  const centerZ = 10;

  // Bedrock structure indices are Z-fastest, then Y, then X (ZYX order).
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        const dx = x - centerX;
        const dz = z - centerZ;
        let block = -1;

        if (y <= 11) {
          const radiusX = 3 + Math.floor((y * 8) / 11);
          const radiusZ = 2 + Math.floor((y * 7) / 11);
          const inIsland =
            (dx * dx) / (radiusX * radiusX) + (dz * dz) / (radiusZ * radiusZ) <=
            1;

          if (inIsland) {
            if (y === 11) {
              block = 2;
            } else if (y >= 9) {
              block = 1;
            } else {
              block = 0;
            }

            if (
              y >= 4 &&
              y <= 7 &&
              ((dx === -3 && dz === 1) ||
                (dx === 4 && dz === -2) ||
                (dx === 1 && dz === 4))
            ) {
              block = 4;
            }

            if (
              y >= 3 &&
              y <= 6 &&
              ((dx === -1 && dz === -3) || (dx === 3 && dz === 2))
            ) {
              block = 5;
            }
          }
        }

        if (y === 11 && x >= 22 && z >= 9 && z <= 11) {
          block = 3;
        }

        if (y === 10 && x >= 23 && x <= 29 && (z === 9 || z === 11)) {
          block = 3;
        }

        if (y === 12 && x >= 6 && x <= 9 && z >= 6 && z <= 8) {
          block = 6;
        }

        indices.push(block);
      }
    }
  }

  for (let y = 0; y <= 11; y += 1) {
    const radiusX = 3 + Math.floor((y * 8) / 11);
    const radiusZ = 2 + Math.floor((y * 7) / 11);

    for (let x = 0; x < width; x += 1) {
      for (let z = 0; z < depth; z += 1) {
        const dx = x - centerX;
        const dz = z - centerZ;
        const belongsToBody =
          (dx * dx) / (radiusX * radiusX) + (dz * dz) / (radiusZ * radiusZ) <=
          1;

        if (belongsToBody && indices[zyxIndex(size, x, y, z)] === -1) {
          throw new Error(
            `Starter island contains a body gap at ${x},${y},${z}.`,
          );
        }
      }
    }
  }

  return structureBuffer(
    size,
    [
      "minecraft:stone",
      "minecraft:dirt",
      "minecraft:grass_block",
      "minecraft:oak_planks",
      "minecraft:coal_ore",
      "minecraft:iron_ore",
      "minecraft:oak_log",
    ],
    indices,
  );
}

function emberOutpost() {
  const size = [25, 14, 21];
  const [width, height, depth] = size;
  const centerX = 12;
  const centerZ = 10;
  const indices = [];

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        const dx = x - centerX;
        const dz = z - centerZ;
        let block = -1;

        if (y <= 9) {
          const radiusX = 3 + Math.floor((y * 8) / 9);
          const radiusZ = 2 + Math.floor((y * 7) / 9);
          const inIsland =
            (dx * dx) / (radiusX * radiusX) + (dz * dz) / (radiusZ * radiusZ) <=
            1;

          if (inIsland) {
            block = y === 9 ? 1 : y >= 7 ? 2 : 0;
          }
        }

        if (y === 9 && x <= 4 && z >= 9 && z <= 11) {
          block = 3;
        }

        const ruinEdge =
          y >= 10 &&
          y <= 12 &&
          x >= 8 &&
          x <= 16 &&
          z >= 6 &&
          z <= 14 &&
          (x === 8 || x === 16 || z === 6 || z === 14);

        if (ruinEdge && !((z === 6 || z === 14) && x >= 11 && x <= 13)) {
          block = (x + y + z) % 4 === 0 ? 5 : 4;
        }

        if (y === 10 && x === 12 && z === 10) {
          block = 6;
        }

        if (
          y === 9 &&
          ((dx === -5 && dz === 3) ||
            (dx === 5 && dz === -3) ||
            (dx === 2 && dz === 6))
        ) {
          block = 7;
        }

        indices.push(block);
      }
    }
  }

  return structureBuffer(
    size,
    [
      "minecraft:blackstone",
      "minecraft:netherrack",
      "minecraft:basalt",
      "minecraft:polished_blackstone_bricks",
      "minecraft:stone_bricks",
      "minecraft:cracked_stone_bricks",
      "minecraft:chest",
      "minecraft:magma",
    ],
    indices,
  );
}

function frostspire() {
  const size = [27, 15, 23];
  const [width, height, depth] = size;
  const centerX = 13;
  const centerZ = 11;
  const indices = [];

  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      for (let z = 0; z < depth; z += 1) {
        const dx = x - centerX;
        const dz = z - centerZ;
        let block = -1;

        if (y <= 10) {
          const radiusX = 3 + Math.floor((y * 9) / 10);
          const radiusZ = 2 + Math.floor((y * 8) / 10);
          const inIsland =
            (dx * dx) / (radiusX * radiusX) + (dz * dz) / (radiusZ * radiusZ) <=
            1;

          if (inIsland) {
            block = y === 10 ? 2 : y >= 8 ? 1 : 0;
          }
        }

        if (y === 10 && x <= 4 && z >= 10 && z <= 12) {
          block = 3;
        }

        const towerWall =
          y >= 11 &&
          y <= 13 &&
          x >= 9 &&
          x <= 17 &&
          z >= 7 &&
          z <= 15 &&
          (x === 9 || x === 17 || z === 7 || z === 15);

        if (towerWall && !(z === 7 && x >= 12 && x <= 14)) {
          block = (x + y + z) % 5 === 0 ? 6 : 4;
        }

        if (y === 11 && x === 13 && z === 11) {
          block = 5;
        }

        if (
          y === 10 &&
          ((dx === -6 && dz === 4) ||
            (dx === 6 && dz === -4) ||
            (dx === 3 && dz === 7))
        ) {
          block = 6;
        }

        indices.push(block);
      }
    }
  }

  for (let y = 0; y <= 10; y += 1) {
    const radiusX = 3 + Math.floor((y * 9) / 10);
    const radiusZ = 2 + Math.floor((y * 8) / 10);

    for (let x = 0; x < width; x += 1) {
      for (let z = 0; z < depth; z += 1) {
        const dx = x - centerX;
        const dz = z - centerZ;
        const belongsToBody =
          (dx * dx) / (radiusX * radiusX) + (dz * dz) / (radiusZ * radiusZ) <=
          1;

        if (belongsToBody && indices[zyxIndex(size, x, y, z)] === -1) {
          throw new Error(`Frostspire contains a body gap at ${x},${y},${z}.`);
        }
      }
    }
  }

  return structureBuffer(
    size,
    [
      "minecraft:stone",
      "minecraft:packed_ice",
      "minecraft:snow_block",
      "minecraft:spruce_planks",
      "minecraft:stone_bricks",
      "minecraft:chest",
      "minecraft:blue_ice",
    ],
    indices,
  );
}

function gameTestPlatform() {
  const size = [5, 3, 5];
  const indices = [];

  for (let x = 0; x < size[0]; x += 1) {
    for (let y = 0; y < size[1]; y += 1) {
      for (let z = 0; z < size[2]; z += 1) {
        indices.push(y === 0 ? 1 : 0);
      }
    }
  }

  return structureBuffer(size, ["minecraft:air", "minecraft:stone"], indices);
}

const outputs = [
  {
    path: path.join(
      root,
      "behavior_packs",
      "sk_bp",
      "structures",
      "skyknights",
      "frostspire.mcstructure",
    ),
    data: frostspire(),
  },
  {
    path: path.join(
      root,
      "behavior_packs",
      "sk_bp",
      "structures",
      "skyknights",
      "ember_outpost.mcstructure",
    ),
    data: emberOutpost(),
  },
  {
    path: path.join(
      root,
      "behavior_packs",
      "sk_bp",
      "structures",
      "skyknights",
      "starter_island.mcstructure",
    ),
    data: starterIsland(),
  },
  {
    path: path.join(
      root,
      "profiles",
      "gametest",
      "behavior_pack",
      "structures",
      "skyknights_tests",
      "platform.mcstructure",
    ),
    data: gameTestPlatform(),
  },
];

for (const output of outputs) {
  await mkdir(path.dirname(output.path), { recursive: true });
  await writeFile(output.path, output.data);
  process.stdout.write(
    `Generated ${path.relative(root, output.path)} (${output.data.length} bytes)\n`,
  );
}
