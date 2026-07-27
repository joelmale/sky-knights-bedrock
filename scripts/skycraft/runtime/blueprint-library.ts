import {
  blueprintByteSize,
  canonicalBlueprint,
  migrateBlueprint,
} from "../blueprint";
import { AirshipBlueprint } from "../types";
import { DynamicPropertyHost } from "./repository";

export const BLUEPRINT_LIBRARY_ENTRY_CAP = 24;
export const BLUEPRINT_LIBRARY_BYTE_CAP = 12_000;

const RECORD_CHUNK_SIZE = 6_000;
const RECORD_CHUNK_CAP = 3;

interface LibraryIndex {
  schemaVersion: 1;
  ownerPlayerId: string;
  names: readonly string[];
}

interface LibraryRecord {
  schemaVersion: 1;
  ownerPlayerId: string;
  name: string;
  nameKey: string;
  blueprint: AirshipBlueprint;
}

function fnv(value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function ownerKey(ownerPlayerId: string): string {
  return `skyknights:blueprint_index_v1:${fnv(ownerPlayerId)}`;
}

function recordKey(
  ownerPlayerId: string,
  nameKey: string,
  part: number,
): string {
  return `skyknights:blueprint_v1:${fnv(ownerPlayerId)}:${fnv(nameKey)}:${part}`;
}

function parseIndex(
  value: string | undefined,
  ownerPlayerId: string,
): LibraryIndex {
  if (value === undefined) {
    return { schemaVersion: 1, ownerPlayerId, names: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Skycraft blueprint-library index is corrupt.");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Skycraft blueprint-library index is invalid.");
  }

  const index = parsed as Partial<LibraryIndex>;
  if (
    index.schemaVersion !== 1 ||
    index.ownerPlayerId !== ownerPlayerId ||
    !Array.isArray(index.names) ||
    !index.names.every(
      (name) =>
        typeof name === "string" && normalizeBlueprintName(name) === name,
    )
  ) {
    throw new Error("Skycraft blueprint-library index is invalid.");
  }

  const names = [...index.names].sort();
  if (
    names.length > BLUEPRINT_LIBRARY_ENTRY_CAP ||
    new Set(names).size !== names.length
  ) {
    throw new Error("Skycraft blueprint-library index exceeds its bounds.");
  }

  return { schemaVersion: 1, ownerPlayerId, names };
}

function parseRecord(value: unknown): LibraryRecord | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Partial<LibraryRecord>;
  const blueprint = migrateBlueprint(record.blueprint);
  if (
    record.schemaVersion !== 1 ||
    typeof record.ownerPlayerId !== "string" ||
    typeof record.name !== "string" ||
    typeof record.nameKey !== "string" ||
    blueprint === undefined ||
    normalizeBlueprintName(record.name) !== record.nameKey ||
    blueprintByteSize(blueprint) > BLUEPRINT_LIBRARY_BYTE_CAP
  ) {
    return undefined;
  }

  return {
    schemaVersion: 1,
    ownerPlayerId: record.ownerPlayerId,
    name: record.name,
    nameKey: record.nameKey,
    blueprint,
  };
}

export function normalizeBlueprintName(value: string): string | undefined {
  const normalized = value.trim().replace(/\s+/gu, " ").toLowerCase();
  return /^[a-z0-9][a-z0-9 _-]{0,30}[a-z0-9]$/u.test(normalized) ||
    /^[a-z0-9]$/u.test(normalized)
    ? normalized
    : undefined;
}

function copyBlueprint(
  blueprint: AirshipBlueprint,
  airshipId: string,
  revision: number,
): AirshipBlueprint {
  return canonicalBlueprint({
    ...blueprint,
    airshipId,
    revision,
    blocks: blueprint.blocks.map((block) => ({
      ...block,
      states: { ...block.states },
    })),
    components: blueprint.components.map((component) => ({
      ...component,
      states: { ...component.states },
    })),
  });
}

export class BlueprintLibrary {
  public constructor(private readonly host: DynamicPropertyHost) {}

  public list(
    actorPlayerId: string,
    ownerPlayerId: string,
  ): readonly string[] | undefined {
    if (actorPlayerId !== ownerPlayerId) {
      return undefined;
    }
    return parseIndex(
      this.host.getDynamicProperty(ownerKey(ownerPlayerId)),
      ownerPlayerId,
    ).names;
  }

  public load(
    actorPlayerId: string,
    ownerPlayerId: string,
    name: string,
  ): AirshipBlueprint | undefined {
    if (actorPlayerId !== ownerPlayerId) {
      return undefined;
    }

    const nameKey = normalizeBlueprintName(name);
    if (nameKey === undefined) {
      return undefined;
    }

    const index = parseIndex(
      this.host.getDynamicProperty(ownerKey(ownerPlayerId)),
      ownerPlayerId,
    );
    if (!index.names.includes(nameKey)) {
      return undefined;
    }

    const chunks: string[] = [];
    for (let part = 0; part < RECORD_CHUNK_CAP; part += 1) {
      const chunk = this.host.getDynamicProperty(
        recordKey(ownerPlayerId, nameKey, part),
      );
      if (chunk === undefined) {
        break;
      }
      chunks.push(chunk);
    }
    if (chunks.length === 0) {
      throw new Error(`Saved Skycraft blueprint ${nameKey} is missing.`);
    }

    let record: LibraryRecord | undefined;
    try {
      record = parseRecord(JSON.parse(chunks.join("")));
    } catch {
      record = undefined;
    }
    if (
      record === undefined ||
      record.ownerPlayerId !== ownerPlayerId ||
      record.nameKey !== nameKey
    ) {
      throw new Error(`Saved Skycraft blueprint ${nameKey} is corrupt.`);
    }

    return copyBlueprint(
      record.blueprint,
      record.blueprint.airshipId,
      record.blueprint.revision,
    );
  }

  public save(
    actorPlayerId: string,
    ownerPlayerId: string,
    name: string,
    blueprint: AirshipBlueprint,
    expectedRevision?: number,
  ): AirshipBlueprint | undefined {
    if (actorPlayerId !== ownerPlayerId) {
      return undefined;
    }

    const nameKey = normalizeBlueprintName(name);
    const parsed = migrateBlueprint(blueprint);
    if (
      nameKey === undefined ||
      parsed === undefined ||
      blueprintByteSize(parsed) > BLUEPRINT_LIBRARY_BYTE_CAP
    ) {
      return undefined;
    }

    const index = parseIndex(
      this.host.getDynamicProperty(ownerKey(ownerPlayerId)),
      ownerPlayerId,
    );
    const collidingName = index.names.find(
      (candidate) => candidate !== nameKey && fnv(candidate) === fnv(nameKey),
    );
    if (collidingName !== undefined) {
      throw new Error(
        `Blueprint names ${collidingName} and ${nameKey} share a storage key.`,
      );
    }

    const existing = index.names.includes(nameKey)
      ? this.load(ownerPlayerId, ownerPlayerId, nameKey)
      : undefined;
    if (
      existing === undefined
        ? expectedRevision !== undefined
        : expectedRevision !== existing.revision
    ) {
      return undefined;
    }
    if (
      existing === undefined &&
      index.names.length >= BLUEPRINT_LIBRARY_ENTRY_CAP
    ) {
      return undefined;
    }

    const next = copyBlueprint(
      parsed,
      parsed.airshipId,
      existing === undefined ? 1 : existing.revision + 1,
    );
    const displayName = name.trim().replace(/\s+/gu, " ");
    const serialized = JSON.stringify({
      schemaVersion: 1,
      ownerPlayerId,
      name: displayName,
      nameKey,
      blueprint: next,
    } satisfies LibraryRecord);
    const chunks = Math.ceil(serialized.length / RECORD_CHUNK_SIZE);
    if (chunks > RECORD_CHUNK_CAP) {
      return undefined;
    }

    for (let part = 0; part < chunks; part += 1) {
      this.host.setDynamicProperty(
        recordKey(ownerPlayerId, nameKey, part),
        serialized.slice(
          part * RECORD_CHUNK_SIZE,
          (part + 1) * RECORD_CHUNK_SIZE,
        ),
      );
    }
    for (let part = chunks; part < RECORD_CHUNK_CAP; part += 1) {
      this.host.setDynamicProperty(recordKey(ownerPlayerId, nameKey, part));
    }
    if (existing === undefined) {
      this.host.setDynamicProperty(
        ownerKey(ownerPlayerId),
        JSON.stringify({
          schemaVersion: 1,
          ownerPlayerId,
          names: [...index.names, nameKey].sort(),
        } satisfies LibraryIndex),
      );
    }

    return next;
  }

  public materialize(
    actorPlayerId: string,
    ownerPlayerId: string,
    name: string,
    newAirshipId: string,
  ): AirshipBlueprint | undefined {
    if (
      newAirshipId.length === 0 ||
      newAirshipId !== newAirshipId.replace(/[^a-zA-Z0-9_-]/gu, "_")
    ) {
      return undefined;
    }

    const saved = this.load(actorPlayerId, ownerPlayerId, name);
    return saved === undefined
      ? undefined
      : copyBlueprint(saved, newAirshipId, 1);
  }
}
