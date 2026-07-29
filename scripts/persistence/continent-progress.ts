import { CONTINENT_FIELD_VERSION } from "../generation/continent-field";
import { parseContinentStreamingId } from "../generation/continent-streaming";
import { DynamicPropertyHost } from "./repositories";

export const CONTINENT_PROGRESS_PROPERTY_KEY =
  "skyknights:continent_progress_v1";
export const CURRENT_CONTINENT_PROGRESS_SCHEMA_VERSION = 1;

export interface ContinentProgressState {
  readonly schemaVersion: typeof CURRENT_CONTINENT_PROGRESS_SCHEMA_VERSION;
  readonly worldSeed: number;
  readonly fieldVersion: number;
  readonly chunks: Readonly<Record<string, string>>;
  /**
   * Persisted before the first fill call. A retry may finish only this exact
   * chunk through an occupied volume; unrelated occupied chunks are skipped.
   */
  readonly activeChunk?: {
    readonly continentId: string;
    readonly chunkIndex: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function sortedChunks(
  chunks: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  const sorted: Record<string, string> = {};

  for (const id of Object.keys(chunks).sort()) {
    sorted[id] = chunks[id];
  }

  return sorted;
}

function activeChunk(
  value: unknown,
): { readonly continentId: string; readonly chunkIndex: number } | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    !isRecord(value) ||
    typeof value.continentId !== "string" ||
    parseContinentStreamingId(value.continentId) === undefined ||
    typeof value.chunkIndex !== "number" ||
    !Number.isSafeInteger(value.chunkIndex) ||
    value.chunkIndex < 0
  ) {
    throw new Error("Continent active chunk is invalid.");
  }

  return {
    continentId: value.continentId,
    chunkIndex: value.chunkIndex,
  };
}

export function createContinentProgressState(
  worldSeed: number,
): ContinentProgressState {
  if (
    !Number.isSafeInteger(worldSeed) ||
    worldSeed < 0 ||
    worldSeed > 0xffff_ffff
  ) {
    throw new RangeError("worldSeed must be an unsigned 32-bit integer");
  }

  return {
    schemaVersion: CURRENT_CONTINENT_PROGRESS_SCHEMA_VERSION,
    worldSeed,
    fieldVersion: CONTINENT_FIELD_VERSION,
    chunks: {},
  };
}

export function parseContinentProgressState(
  value: unknown,
  worldSeed: number,
): ContinentProgressState {
  if (value === undefined) {
    return createContinentProgressState(worldSeed);
  }

  if (!isRecord(value)) {
    throw new Error("Continent progress must be a serialized object.");
  }

  if (value.schemaVersion !== CURRENT_CONTINENT_PROGRESS_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported continent progress schema: ${String(value.schemaVersion)}`,
    );
  }

  if (value.worldSeed !== worldSeed) {
    throw new Error("Continent progress belongs to a different world seed.");
  }

  if (value.fieldVersion !== CONTINENT_FIELD_VERSION) {
    throw new Error(
      `Unsupported continent field version: ${String(value.fieldVersion)}`,
    );
  }

  if (!isRecord(value.chunks)) {
    throw new Error("Continent progress chunks must be an object.");
  }

  const chunks: Record<string, string> = {};

  for (const id of Object.keys(value.chunks)) {
    const encoded = value.chunks[id];
    if (
      parseContinentStreamingId(id) === undefined ||
      typeof encoded !== "string"
    ) {
      throw new Error(`Invalid continent progress entry ${id}.`);
    }

    chunks[id] = encoded;
  }
  const parsedActiveChunk = activeChunk(value.activeChunk);

  return {
    schemaVersion: CURRENT_CONTINENT_PROGRESS_SCHEMA_VERSION,
    worldSeed,
    fieldVersion: CONTINENT_FIELD_VERSION,
    chunks: sortedChunks(chunks),
    ...(parsedActiveChunk === undefined
      ? {}
      : { activeChunk: parsedActiveChunk }),
  };
}

export function beginContinentChunkProgress(
  state: ContinentProgressState,
  continentId: string,
  chunkIndex: number,
): ContinentProgressState {
  if (parseContinentStreamingId(continentId) === undefined) {
    throw new Error(`Invalid formula continent id ${continentId}.`);
  }

  if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0) {
    throw new RangeError("chunkIndex must be a non-negative safe integer.");
  }

  if (state.activeChunk !== undefined) {
    if (
      state.activeChunk.continentId === continentId &&
      state.activeChunk.chunkIndex === chunkIndex
    ) {
      return state;
    }

    throw new Error(
      `Cannot begin ${continentId}/${chunkIndex}; ${state.activeChunk.continentId}/${state.activeChunk.chunkIndex} is active.`,
    );
  }

  return {
    ...state,
    activeChunk: { continentId, chunkIndex },
  };
}

export function completeContinentChunkProgress(
  state: ContinentProgressState,
  continentId: string,
  chunkIndex: number,
  encoded: string,
): ContinentProgressState {
  if (parseContinentStreamingId(continentId) === undefined) {
    throw new Error(`Invalid formula continent id ${continentId}.`);
  }

  if (encoded.length === 0) {
    throw new Error("Continent chunk progress must not be empty.");
  }

  if (
    state.activeChunk?.continentId !== continentId ||
    state.activeChunk.chunkIndex !== chunkIndex
  ) {
    throw new Error(
      `Cannot complete inactive continent chunk ${continentId}/${chunkIndex}.`,
    );
  }

  const { activeChunk: _completed, ...remaining } = state;

  return {
    ...remaining,
    chunks: sortedChunks({
      ...state.chunks,
      [continentId]: encoded,
    }),
  };
}

export class ContinentProgressRepository {
  public constructor(
    private readonly host: DynamicPropertyHost,
    private readonly worldSeed: number,
  ) {}

  public load(): ContinentProgressState {
    const serialized = this.host.getDynamicProperty(
      CONTINENT_PROGRESS_PROPERTY_KEY,
    );

    if (serialized !== undefined && typeof serialized !== "string") {
      throw new Error(
        `Dynamic property ${CONTINENT_PROGRESS_PROPERTY_KEY} must contain serialized JSON.`,
      );
    }

    const state = parseContinentProgressState(
      serialized === undefined
        ? undefined
        : (JSON.parse(serialized) as unknown),
      this.worldSeed,
    );
    const canonical = JSON.stringify(state);

    if (serialized !== canonical) {
      this.host.setDynamicProperty(CONTINENT_PROGRESS_PROPERTY_KEY, canonical);
    }

    return state;
  }

  public save(state: ContinentProgressState): void {
    const canonical = parseContinentProgressState(state, this.worldSeed);
    this.host.setDynamicProperty(
      CONTINENT_PROGRESS_PROPERTY_KEY,
      JSON.stringify(canonical),
    );
  }
}
