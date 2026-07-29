/**
 * Compact on-disk form for the generated-island set.
 *
 * The world document stores every generated island twice: once as a string in
 * `generatedIslandIds` and once as a key in `islandVersions`. Measured, that is
 * exactly 20 bytes per island, so a 1,500-island world spends 29,903 of the
 * 30,000-byte budget and leaves 97 bytes of headroom — about five islands.
 *
 * `a3` ids are `a3_<base36 index>` over a dense index space, and every a3
 * island shares one content version. "Which islands exist" is therefore a
 * bitset, not a list of strings: 2,563 sites is 321 raw bytes, 428 base64,
 * fixed regardless of how many are generated. That is 61x smaller than 1,500
 * strings and it does not grow with island count.
 *
 * Compaction applies only at the serialisation boundary. `WorldState` keeps its
 * `string[]` shape in memory, so no consumer changes.
 */

const A3_ID = /^a3_([0-9a-z]+)$/u;
const BASE64_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

interface CompactA3 {
  /** Shared content version for every island in the bitset. */
  v: number;
  /** Base64 bitset, least-significant bit first within each byte. */
  b: string;
}

export function encodeBase64(bytes: Uint8Array): string {
  let out = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = bytes[index + 1];
    const c = bytes[index + 2];
    out += BASE64_ALPHABET[a >> 2];
    out += BASE64_ALPHABET[((a & 3) << 4) | ((b ?? 0) >> 4)];
    out +=
      b === undefined
        ? "="
        : BASE64_ALPHABET[((b & 15) << 2) | ((c ?? 0) >> 6)];
    out += c === undefined ? "=" : BASE64_ALPHABET[c & 63];
  }

  return out;
}

export function decodeBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/u, "");
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let byteIndex = 0;
  let accumulator = 0;
  let bits = 0;

  for (const character of clean) {
    const value = BASE64_ALPHABET.indexOf(character);

    if (value < 0) {
      throw new Error(`Invalid base64 character ${character}.`);
    }

    accumulator = (accumulator << 6) | value;
    bits += 6;

    if (bits >= 8) {
      bits -= 8;
      bytes[byteIndex] = (accumulator >> bits) & 0xff;
      byteIndex += 1;
    }
  }

  return bytes.subarray(0, byteIndex);
}

function a3Index(id: string): number | undefined {
  const match = A3_ID.exec(id);

  if (match === null) {
    return undefined;
  }

  const index = Number.parseInt(match[1], 36);
  return Number.isSafeInteger(index) && index >= 0 ? index : undefined;
}

/**
 * Replaces the a3 entries of a world document with a bitset.
 *
 * Compaction is skipped whenever the a3 islands do not share a single content
 * version, because the bitset cannot express per-island versions. Returning the
 * document unchanged is always correct, just larger.
 */
export function compactWorldDocument(document: unknown): unknown {
  if (document === null || typeof document !== "object") {
    return document;
  }

  const source = document as Record<string, unknown>;
  const ids = source.generatedIslandIds;
  const versions = source.islandVersions;

  if (
    !Array.isArray(ids) ||
    versions === null ||
    typeof versions !== "object"
  ) {
    return document;
  }

  const versionMap = versions as Record<string, number>;
  const retained: string[] = [];
  const indices: number[] = [];
  let sharedVersion: number | undefined;

  for (const entry of ids) {
    if (typeof entry !== "string") {
      return document;
    }

    const index = a3Index(entry);

    if (index === undefined) {
      retained.push(entry);
      continue;
    }

    const version = versionMap[entry];

    if (typeof version !== "number") {
      retained.push(entry);
      continue;
    }

    if (sharedVersion === undefined) {
      sharedVersion = version;
    } else if (sharedVersion !== version) {
      return document;
    }

    indices.push(index);
  }

  if (indices.length === 0 || sharedVersion === undefined) {
    return document;
  }

  const highest = Math.max(...indices);
  const bytes = new Uint8Array(Math.floor(highest / 8) + 1);

  for (const index of indices) {
    bytes[index >> 3] |= 1 << (index & 7);
  }

  const remainingVersions: Record<string, number> = {};

  for (const key of Object.keys(versionMap)) {
    if (a3Index(key) === undefined) {
      remainingVersions[key] = versionMap[key];
    }
  }

  const compact: CompactA3 = {
    v: sharedVersion,
    b: encodeBase64(bytes),
  };

  return {
    ...source,
    generatedIslandIds: retained,
    islandVersions: remainingVersions,
    a3: compact,
  };
}

/** Restores the string form a compacted document was written from. */
export function expandWorldDocument(document: unknown): unknown {
  if (document === null || typeof document !== "object") {
    return document;
  }

  const source = document as Record<string, unknown>;
  const compact = source.a3;

  if (compact === null || typeof compact !== "object") {
    return document;
  }

  const { v, b } = compact as Partial<CompactA3>;

  if (typeof v !== "number" || typeof b !== "string") {
    return document;
  }

  const ids = Array.isArray(source.generatedIslandIds)
    ? [...(source.generatedIslandIds as string[])]
    : [];
  const versions: Record<string, number> =
    source.islandVersions !== null && typeof source.islandVersions === "object"
      ? { ...(source.islandVersions as Record<string, number>) }
      : {};
  const bytes = decodeBase64(b);

  for (let index = 0; index < bytes.length * 8; index += 1) {
    if ((bytes[index >> 3] & (1 << (index & 7))) === 0) {
      continue;
    }

    const id = `a3_${index.toString(36)}`;
    ids.push(id);
    versions[id] = v;
  }

  const expanded = {
    ...source,
    generatedIslandIds: ids,
    islandVersions: versions,
  };
  delete (expanded as Record<string, unknown>).a3;
  return expanded;
}
