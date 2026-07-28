// Little-endian Bedrock NBT reader and writer.
//
// This is a FULL codec (all 12 tag types) used to patch a Bedrock Dedicated
// Server `level.dat`. It is deliberately separate from `tools/structures/nbt.mjs`,
// which is a write-only encoder for authoring `.mcstructure` payloads.
//
// Round-trip fidelity is a hard requirement: reading a `level.dat` and writing
// it back unmodified MUST reproduce the original bytes. Tags are therefore kept
// as explicit `{ type, value }` records rather than being collapsed into plain
// JavaScript values, so a Byte never silently becomes an Int and a Float never
// silently becomes a Double. `tools/bds/test-nbt.mjs` asserts this.

export const TAG = {
  End: 0,
  Byte: 1,
  Short: 2,
  Int: 3,
  Long: 4,
  Float: 5,
  Double: 6,
  ByteArray: 7,
  String: 8,
  List: 9,
  Compound: 10,
  IntArray: 11,
  LongArray: 12,
};

const MAX_COLLECTION_LENGTH = 1_000_000;
const MAX_NESTING_DEPTH = 64;
const MAX_LEVEL_DAT_BYTES = 64 * 1024 * 1024;

function integerInRange(value, minimum, maximum, context) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `Invalid ${context} value ${String(value)}; expected ${minimum}..${maximum}.`,
    );
  }
}

function collectionForWrite(value, context) {
  if (!Array.isArray(value) || value.length > MAX_COLLECTION_LENGTH) {
    throw new Error(
      `Invalid ${context} length: ${String(value?.length ?? "non-array")}.`,
    );
  }
}

class Reader {
  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }

  require(length, context) {
    if (length < 0 || this.offset + length > this.buffer.length) {
      throw new Error(
        `Truncated NBT while reading ${context} at offset ${this.offset}.`,
      );
    }
  }

  byte() {
    this.require(1, "byte");
    const value = this.buffer.readInt8(this.offset);
    this.offset += 1;
    return value;
  }

  short() {
    this.require(2, "short");
    const value = this.buffer.readInt16LE(this.offset);
    this.offset += 2;
    return value;
  }

  int() {
    this.require(4, "int");
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  long() {
    this.require(8, "long");
    const value = this.buffer.readBigInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  float() {
    this.require(4, "float");
    const value = this.buffer.readFloatLE(this.offset);
    this.offset += 4;
    return value;
  }

  double() {
    this.require(8, "double");
    const value = this.buffer.readDoubleLE(this.offset);
    this.offset += 8;
    return value;
  }

  string() {
    this.require(2, "string length");
    const length = this.buffer.readUInt16LE(this.offset);
    this.offset += 2;
    this.require(length, "string payload");
    const value = this.buffer.toString(
      "utf8",
      this.offset,
      this.offset + length,
    );
    this.offset += length;
    return value;
  }
}

function collectionLength(reader, context) {
  const length = reader.int();

  if (length < 0 || length > MAX_COLLECTION_LENGTH) {
    throw new Error(`Invalid ${context} length: ${length}.`);
  }

  return length;
}

function readPayload(reader, type, depth = 0) {
  if (depth > MAX_NESTING_DEPTH) {
    throw new Error(
      `NBT exceeds maximum nesting depth of ${MAX_NESTING_DEPTH}.`,
    );
  }

  switch (type) {
    case TAG.Byte:
      return reader.byte();
    case TAG.Short:
      return reader.short();
    case TAG.Int:
      return reader.int();
    case TAG.Long:
      return reader.long();
    case TAG.Float:
      return reader.float();
    case TAG.Double:
      return reader.double();
    case TAG.ByteArray: {
      const length = collectionLength(reader, "byte-array");
      const value = [];
      for (let index = 0; index < length; index += 1) {
        value.push(reader.byte());
      }
      return value;
    }
    case TAG.String:
      return reader.string();
    case TAG.List: {
      const childType = reader.byte();
      const length = collectionLength(reader, "list");

      if (childType === TAG.End && length > 0) {
        throw new Error("NBT list cannot contain TAG_End entries.");
      }

      const value = [];
      for (let index = 0; index < length; index += 1) {
        value.push(readPayload(reader, childType, depth + 1));
      }
      return { childType, value };
    }
    case TAG.Compound: {
      const value = new Map();
      for (;;) {
        const childType = reader.byte();
        if (childType === TAG.End) {
          break;
        }
        const name = reader.string();
        value.set(name, {
          type: childType,
          value: readPayload(reader, childType, depth + 1),
        });
      }
      return value;
    }
    case TAG.IntArray: {
      const length = collectionLength(reader, "int-array");
      const value = [];
      for (let index = 0; index < length; index += 1) {
        value.push(reader.int());
      }
      return value;
    }
    case TAG.LongArray: {
      const length = collectionLength(reader, "long-array");
      const value = [];
      for (let index = 0; index < length; index += 1) {
        value.push(reader.long());
      }
      return value;
    }
    default:
      throw new Error(
        `Unsupported NBT tag type ${type} at offset ${reader.offset}.`,
      );
  }
}

class Writer {
  constructor() {
    this.chunks = [];
  }

  raw(buffer) {
    this.chunks.push(buffer);
  }

  byte(value) {
    integerInRange(value, -128, 127, "byte");
    const buffer = Buffer.allocUnsafe(1);
    buffer.writeInt8(value);
    this.chunks.push(buffer);
  }

  short(value) {
    integerInRange(value, -32_768, 32_767, "short");
    const buffer = Buffer.allocUnsafe(2);
    buffer.writeInt16LE(value);
    this.chunks.push(buffer);
  }

  int(value) {
    integerInRange(value, -2_147_483_648, 2_147_483_647, "int");
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeInt32LE(value);
    this.chunks.push(buffer);
  }

  long(value) {
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeBigInt64LE(BigInt(value));
    this.chunks.push(buffer);
  }

  float(value) {
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeFloatLE(value);
    this.chunks.push(buffer);
  }

  double(value) {
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeDoubleLE(value);
    this.chunks.push(buffer);
  }

  string(value) {
    const encoded = Buffer.from(value, "utf8");

    if (encoded.length > 65_535) {
      throw new Error(
        `NBT string encodes to ${encoded.length} bytes; maximum is 65535.`,
      );
    }

    const length = Buffer.allocUnsafe(2);
    length.writeUInt16LE(encoded.length);
    this.chunks.push(length, encoded);
  }

  finish() {
    return Buffer.concat(this.chunks);
  }
}

function writePayload(writer, type, value) {
  switch (type) {
    case TAG.Byte:
      writer.byte(value);
      break;
    case TAG.Short:
      writer.short(value);
      break;
    case TAG.Int:
      writer.int(value);
      break;
    case TAG.Long:
      writer.long(value);
      break;
    case TAG.Float:
      writer.float(value);
      break;
    case TAG.Double:
      writer.double(value);
      break;
    case TAG.ByteArray:
      collectionForWrite(value, "byte-array");
      writer.int(value.length);
      for (const entry of value) {
        writer.byte(entry);
      }
      break;
    case TAG.String:
      writer.string(value);
      break;
    case TAG.List:
      collectionForWrite(value.value, "list");
      writer.byte(value.childType);
      writer.int(value.value.length);
      for (const entry of value.value) {
        writePayload(writer, value.childType, entry);
      }
      break;
    case TAG.Compound:
      for (const [name, tag] of value) {
        writer.byte(tag.type);
        writer.string(name);
        writePayload(writer, tag.type, tag.value);
      }
      writer.byte(TAG.End);
      break;
    case TAG.IntArray:
      collectionForWrite(value, "int-array");
      writer.int(value.length);
      for (const entry of value) {
        writer.int(entry);
      }
      break;
    case TAG.LongArray:
      collectionForWrite(value, "long-array");
      writer.int(value.length);
      for (const entry of value) {
        writer.long(entry);
      }
      break;
    default:
      throw new Error(`Unsupported NBT tag type ${type}.`);
  }
}

/**
 * Parse a Bedrock `level.dat`, which is an 8-byte header (storage version and
 * payload length, both little-endian int32) followed by an unnamed root compound.
 */
export function readLevelDat(buffer) {
  if (buffer.length < 8) {
    throw new Error("level.dat is too small to contain its header.");
  }

  if (buffer.length > MAX_LEVEL_DAT_BYTES) {
    throw new Error(
      `level.dat is ${buffer.length} bytes; maximum supported size is ${MAX_LEVEL_DAT_BYTES}.`,
    );
  }

  const storageVersion = buffer.readInt32LE(0);
  const declaredLength = buffer.readInt32LE(4);

  if (declaredLength < 0 || declaredLength !== buffer.length - 8) {
    throw new Error(
      `level.dat header declares ${declaredLength} payload bytes but the file holds ${buffer.length - 8}.`,
    );
  }

  const reader = new Reader(buffer.subarray(8));
  const rootType = reader.byte();

  if (rootType !== TAG.Compound) {
    throw new Error(
      `level.dat root tag must be a compound; found type ${rootType}.`,
    );
  }

  const rootName = reader.string();
  const root = readPayload(reader, TAG.Compound);

  if (reader.offset !== reader.buffer.length) {
    throw new Error(
      `level.dat contains ${reader.buffer.length - reader.offset} trailing NBT bytes.`,
    );
  }

  return { storageVersion, rootName, root };
}

/** Serialize a parsed `level.dat` back to bytes, header included. */
export function writeLevelDat({ storageVersion, rootName, root }) {
  const writer = new Writer();
  writer.byte(TAG.Compound);
  writer.string(rootName);
  writePayload(writer, TAG.Compound, root);
  const payload = writer.finish();

  if (payload.length > MAX_LEVEL_DAT_BYTES - 8) {
    throw new Error(
      `level.dat payload is ${payload.length} bytes; maximum supported size is ${MAX_LEVEL_DAT_BYTES - 8}.`,
    );
  }

  const header = Buffer.allocUnsafe(8);
  header.writeInt32LE(storageVersion, 0);
  header.writeInt32LE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

/** Read a typed tag's raw value from a compound, or undefined when absent. */
export function tagValue(compound, name) {
  return compound.get(name)?.value;
}

/** Set a Byte tag, preserving insertion order when the key already exists. */
export function setByte(compound, name, value) {
  compound.set(name, { type: TAG.Byte, value: value ? 1 : 0 });
}

/** Set a String tag. */
export function setString(compound, name, value) {
  compound.set(name, { type: TAG.String, value });
}

/** Set an Int tag. */
export function setInt(compound, name, value) {
  compound.set(name, { type: TAG.Int, value });
}

/** Set a Long tag from a BigInt-compatible value. */
export function setLong(compound, name, value) {
  compound.set(name, { type: TAG.Long, value: BigInt(value) });
}
