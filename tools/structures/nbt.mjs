// Minimal little-endian NBT writer for Bedrock `.mcstructure` files.
//
// Byte-for-byte output stability is a hard requirement: live test worlds keep
// their placed islands only while the generated structures do not change. Never
// reorder the tags written by `structureBuffer`.

export const Tag = {
  End: 0,
  Int: 3,
  String: 8,
  List: 9,
  Compound: 10,
};

export class BinaryWriter {
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

export const int = (value) => ({ type: Tag.Int, value });
export const string = (value) => ({ type: Tag.String, value });
export const list = (childType, value) => ({
  type: Tag.List,
  childType,
  value,
});
export const compound = (value) => ({ type: Tag.Compound, value });

export function writeNamedTag(writer, name, tag) {
  writer.byte(tag.type);
  writer.string(name);
  writePayload(writer, tag);
}

export function writePayload(writer, tag) {
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

export function structureBuffer(size, palette, primaryIndices) {
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

// Bedrock structure indices are Z-fastest, then Y, then X (ZYX order).
export function zyxIndex(size, x, y, z) {
  return x * size[1] * size[2] + y * size[2] + z;
}
