import { canonicalBlueprint, migrateBlueprint } from "../blueprint";
import {
  AirshipState,
  AirshipTransactionState,
  CertificationId,
  CrewRole,
} from "../types";

export interface DynamicPropertyHost {
  getDynamicProperty(identifier: string): string | undefined;
  setDynamicProperty(identifier: string, value?: string): void;
}

interface IndexV1 {
  schemaVersion: 1;
  ids: readonly string[];
}

const INDEX_KEY = "skyknights:airship_index_v1";
const CHUNK_SIZE = 7_000;
const MAX_RECORD_CHUNKS = 16;
const MAX_AIRSHIPS = 128;
const CREW_ROLES: ReadonlySet<CrewRole> = new Set([
  "builder",
  "pilot",
  "navigator",
  "gunner",
  "mechanic",
  "passenger",
]);
const CERTIFICATIONS: ReadonlySet<CertificationId> = new Set([
  "apprentice_raft",
  "ember_skiff",
  "specialist_airframe",
  "expedition_skycraft",
  "masterwork_skycraft",
]);

function recordKey(id: string, chunk: number): string {
  return `skyknights:airship_v1:${id}:${chunk}`;
}

function safeId(value: string): string {
  return value.replace(/[^a-z0-9_-]/giu, "_").slice(0, 48);
}

function parseIndex(value: string | undefined): IndexV1 {
  if (value === undefined) {
    return { schemaVersion: 1, ids: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Skycraft fleet index is corrupt.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    (parsed as { schemaVersion?: unknown }).schemaVersion !== 1 ||
    !Array.isArray((parsed as { ids?: unknown }).ids) ||
    !(parsed as { ids: unknown[] }).ids.every(
      (id) => typeof id === "string" && id === safeId(id),
    )
  ) {
    throw new Error("Skycraft fleet index has an unsupported schema.");
  }

  const ids = [...(parsed as { ids: string[] }).ids].sort();
  if (ids.length > MAX_AIRSHIPS || new Set(ids).size !== ids.length) {
    throw new Error("Skycraft fleet index violates its bounded contract.");
  }

  return { schemaVersion: 1, ids };
}

function validTransaction(value: unknown): value is AirshipTransactionState {
  return (
    value === "docked" ||
    value === "validating" ||
    value === "launching" ||
    value === "in_flight" ||
    value === "docking" ||
    value === "recovery_required"
  );
}

function finiteNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    Number.isFinite(value) &&
    value >= 0
  );
}

function validPosition(
  value: unknown,
): value is { x: number; y: number; z: number } {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const position = value as { x?: unknown; y?: unknown; z?: unknown };
  return (
    typeof position.x === "number" &&
    Number.isFinite(position.x) &&
    Number.isInteger(position.x) &&
    typeof position.y === "number" &&
    Number.isFinite(position.y) &&
    Number.isInteger(position.y) &&
    typeof position.z === "number" &&
    Number.isFinite(position.z) &&
    Number.isInteger(position.z)
  );
}

function validLocation(
  value: unknown,
): value is { x: number; y: number; z: number; dimensionId: string } {
  return (
    validPosition(value) &&
    typeof (value as { dimensionId?: unknown }).dimensionId === "string"
  );
}

function componentKey(component: {
  typeId: string;
  x: number;
  y: number;
  z: number;
}): string {
  return `${component.typeId}@${component.x},${component.y},${component.z}`;
}

export function parseAirshipState(value: unknown): AirshipState | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const state = value as Partial<AirshipState>;
  const blueprint = migrateBlueprint(state.blueprint);
  const cargo = state.cargo;
  const damage = state.damage;
  const crewIds = Array.isArray(state.crew)
    ? state.crew.map((member) => member.playerId)
    : [];
  const dockedHelmPosition = state.dockedHelmPosition;
  const allowedDamageComponents =
    blueprint === undefined
      ? new Set<string>()
      : new Set(blueprint.components.map(componentKey));

  if (
    state.schemaVersion !== 1 ||
    typeof state.airshipId !== "string" ||
    state.airshipId.length === 0 ||
    typeof state.ownerPlayerId !== "string" ||
    state.ownerPlayerId.length === 0 ||
    !validTransaction(state.transaction) ||
    blueprint === undefined ||
    blueprint.airshipId !== state.airshipId ||
    !validLocation(dockedHelmPosition) ||
    dockedHelmPosition.dimensionId !== blueprint.berth.dimensionId ||
    blueprint.blocks.some((block) => {
      const x = dockedHelmPosition.x + block.x;
      const y = dockedHelmPosition.y + block.y;
      const z = dockedHelmPosition.z + block.z;
      return (
        x < blueprint.berth.origin.x ||
        x >= blueprint.berth.origin.x + blueprint.berth.size.x ||
        y < blueprint.berth.origin.y ||
        y >= blueprint.berth.origin.y + blueprint.berth.size.y ||
        z < blueprint.berth.origin.z ||
        z >= blueprint.berth.origin.z + blueprint.berth.size.z
      );
    }) ||
    (state.lastSafeLocation !== undefined &&
      !validLocation(state.lastSafeLocation)) ||
    !Array.isArray(state.crew) ||
    new Set(crewIds).size !== crewIds.length ||
    crewIds.includes(state.ownerPlayerId) ||
    !state.crew.every(
      (member) =>
        typeof member.playerId === "string" &&
        member.playerId.length > 0 &&
        Array.isArray(member.roles) &&
        new Set(member.roles).size === member.roles.length &&
        member.roles.every(
          (role: unknown) =>
            typeof role === "string" && CREW_ROLES.has(role as CrewRole),
        ),
    ) ||
    (state.certificationId !== undefined &&
      !CERTIFICATIONS.has(state.certificationId)) ||
    cargo === undefined ||
    (cargo.authority !== "disabled" &&
      cargo.authority !== "flight_inventory" &&
      cargo.authority !== "docked_container") ||
    !finiteNonNegativeInteger(cargo.reservedMassSubunits) ||
    damage === undefined ||
    !finiteNonNegativeInteger(damage.hullDamage) ||
    !Array.isArray(damage.damagedComponents) ||
    new Set(damage.damagedComponents).size !==
      damage.damagedComponents.length ||
    !damage.damagedComponents.every(
      (component) =>
        typeof component === "string" && allowedDamageComponents.has(component),
    ) ||
    (state.transaction === "docked" && state.flightEntityId !== undefined) ||
    (state.transaction === "in_flight" &&
      (typeof state.flightEntityId !== "string" ||
        state.flightEntityId.length === 0)) ||
    (state.transaction === "docking" &&
      (typeof state.flightEntityId !== "string" ||
        state.flightEntityId.length === 0)) ||
    (state.transaction === "recovery_required"
      ? state.recoveryFrom === undefined
      : state.recoveryFrom !== undefined)
  ) {
    return undefined;
  }

  return {
    ...state,
    schemaVersion: 1,
    blueprint,
    crew: state.crew.map((member) => ({
      playerId: member.playerId,
      roles: [...member.roles].sort(),
    })),
    damage: {
      hullDamage: damage.hullDamage,
      damagedComponents: [...damage.damagedComponents].sort(),
    },
  } as AirshipState;
}

function canonicalAirshipState(state: AirshipState): AirshipState {
  return {
    ...state,
    crew: [...state.crew]
      .map((member) => ({
        playerId: member.playerId,
        roles: [...member.roles].sort(),
      }))
      .sort((left, right) => left.playerId.localeCompare(right.playerId)),
    blueprint: canonicalBlueprint(state.blueprint),
    damage: {
      hullDamage: state.damage.hullDamage,
      damagedComponents: [...state.damage.damagedComponents].sort(),
    },
  };
}

export class AirshipRepository {
  public constructor(private readonly host: DynamicPropertyHost) {}

  public ids(): readonly string[] {
    return parseIndex(this.host.getDynamicProperty(INDEX_KEY)).ids;
  }

  public load(id: string): AirshipState | undefined {
    if (id !== safeId(id)) {
      return undefined;
    }

    const chunks: string[] = [];
    for (let index = 0; index < MAX_RECORD_CHUNKS; index += 1) {
      const chunk = this.host.getDynamicProperty(recordKey(id, index));
      if (chunk === undefined) {
        break;
      }
      chunks.push(chunk);
    }
    if (chunks.length === 0) {
      return undefined;
    }

    try {
      return parseAirshipState(JSON.parse(chunks.join("")));
    } catch {
      return undefined;
    }
  }

  public save(state: AirshipState): void {
    const id = safeId(state.airshipId);
    if (id !== state.airshipId) {
      throw new Error("Airship id is not storage-safe.");
    }

    const valid = parseAirshipState(canonicalAirshipState(state));
    if (valid === undefined) {
      throw new Error("Refusing to persist an invalid Skycraft record.");
    }

    const serialized = JSON.stringify(canonicalAirshipState(valid));
    const chunks = Math.ceil(serialized.length / CHUNK_SIZE);
    if (chunks > MAX_RECORD_CHUNKS) {
      throw new Error("Airship record exceeds bounded storage.");
    }

    const index = parseIndex(this.host.getDynamicProperty(INDEX_KEY));
    if (!index.ids.includes(id) && index.ids.length >= MAX_AIRSHIPS) {
      throw new Error("Airship fleet index is full.");
    }

    for (let part = 0; part < chunks; part += 1) {
      this.host.setDynamicProperty(
        recordKey(id, part),
        serialized.slice(part * CHUNK_SIZE, (part + 1) * CHUNK_SIZE),
      );
    }
    for (let part = chunks; part < MAX_RECORD_CHUNKS; part += 1) {
      this.host.setDynamicProperty(recordKey(id, part));
    }
    if (!index.ids.includes(id)) {
      this.host.setDynamicProperty(
        INDEX_KEY,
        JSON.stringify({
          schemaVersion: 1,
          ids: [...index.ids, id].sort(),
        }),
      );
    }
  }

  public remove(id: string): void {
    const index = parseIndex(this.host.getDynamicProperty(INDEX_KEY));
    if (!index.ids.includes(id)) {
      return;
    }

    for (let part = 0; part < MAX_RECORD_CHUNKS; part += 1) {
      this.host.setDynamicProperty(recordKey(id, part));
    }
    this.host.setDynamicProperty(
      INDEX_KEY,
      JSON.stringify({
        schemaVersion: 1,
        ids: index.ids.filter((candidate) => candidate !== id),
      }),
    );
  }

  public nextId(ownerPlayerId: string, berthId: string): string {
    const existing = new Set(this.ids());
    for (let serial = 1; serial <= MAX_AIRSHIPS; serial += 1) {
      const id = deterministicAirshipId(ownerPlayerId, berthId, serial);
      if (!existing.has(id)) {
        return id;
      }
    }
    throw new Error("No bounded Skycraft id is available.");
  }
}

export function deterministicAirshipId(
  ownerPlayerId: string,
  berthId: string,
  serial = 0,
): string {
  let hash = 2166136261;
  for (const character of `${ownerPlayerId}:${berthId}:${serial}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `airship_${(hash >>> 0).toString(36)}`;
}
