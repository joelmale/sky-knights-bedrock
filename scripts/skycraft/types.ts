export const SKYCRAFT_BLUEPRINT_SCHEMA_VERSION = 1;
export const SKYCRAFT_AIRSHIP_SCHEMA_VERSION = 1;

export interface BlockPosition {
  x: number;
  y: number;
  z: number;
}
export interface RelativeBlock extends BlockPosition {
  typeId: string;
  states: Readonly<Record<string, string | number | boolean>>;
}
export interface BlueprintBlock extends RelativeBlock {}
export type ComponentKind =
  | "helm"
  | "core"
  | "engine"
  | "lift"
  | "seat"
  | "cargo"
  | "hardpoint"
  | "control"
  | "armor"
  | "repair";
export interface BlueprintComponent extends RelativeBlock {
  kind: ComponentKind;
  facing?: Direction;
}
export type Direction = "north" | "south" | "east" | "west" | "up" | "down";

export interface DockBerth {
  id: string;
  dimensionId: string;
  origin: BlockPosition;
  size: BlockPosition;
  orientation: Direction;
}
export type CrewRole =
  | "owner"
  | "builder"
  | "pilot"
  | "navigator"
  | "gunner"
  | "mechanic"
  | "passenger";
export interface CrewMember {
  playerId: string;
  roles: readonly CrewRole[];
}
export interface AirshipBlueprint {
  schemaVersion: 1;
  airshipId: string;
  revision: number;
  berth: DockBerth;
  helm: RelativeBlock;
  blocks: readonly BlueprintBlock[];
  components: readonly BlueprintComponent[];
  engineeringVersion: number;
}
export type AirshipTransactionState =
  | "docked"
  | "validating"
  | "launching"
  | "in_flight"
  | "docking"
  | "recovery_required";
export type CargoAuthority =
  "disabled" | "flight_inventory" | "docked_container";
export interface CargoReference {
  authority: CargoAuthority;
  referenceId?: string;
  reservedMassSubunits: number;
}
export interface DamageState {
  hullDamage: number;
  damagedComponents: readonly string[];
}
export interface AirshipState {
  schemaVersion: 1;
  airshipId: string;
  ownerPlayerId: string;
  displayName?: string;
  certificationId?: CertificationId;
  referenceBlueprintId?: string;
  crew: readonly CrewMember[];
  activePilotId?: string;
  transaction: AirshipTransactionState;
  recoveryFrom?: Exclude<AirshipTransactionState, "recovery_required">;
  blueprint: AirshipBlueprint;
  flightEntityId?: string;
  dockedHelmPosition?: BlockPosition & { dimensionId: string };
  lastSafeLocation?: BlockPosition & { dimensionId: string };
  cargo: CargoReference;
  damage: DamageState;
}
export type CertificationId =
  | "apprentice_raft"
  | "ember_skiff"
  | "specialist_airframe"
  | "expedition_skycraft"
  | "masterwork_skycraft";
export interface Certification {
  id: CertificationId;
  berthSize: BlockPosition;
  blockCap: number;
  massCapSubunits: number;
  engineCap: number;
  seatCap: number;
  hardpointCap: number;
  provisional: true;
}
export interface ScanDiagnostic {
  code: string;
  message: string;
  position?: BlockPosition;
}
export interface ScanResult {
  blocks: readonly BlueprintBlock[];
  components: readonly BlueprintComponent[];
  helm?: RelativeBlock;
  diagnostics: readonly ScanDiagnostic[];
  byteSize: number;
}
export interface EngineeringReport {
  allowed: boolean;
  dryMassSubunits: number;
  crewMassSubunits: number;
  cargoMassSubunits: number;
  massSubunits: number;
  requiredLiftSubunits: number;
  liftSubunits: number;
  liftReserveSubunits: number;
  forwardThrust: number;
  brakingThrust: number;
  lateralControl: number;
  hullPoints: number;
  seatCount: number;
  cargoSlots: number;
  hardpointCount: number;
  handling: "refused" | "heavy" | "normal" | "agile";
  diagnostics: readonly string[];
}
