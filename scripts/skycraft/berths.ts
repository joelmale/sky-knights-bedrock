import { SKYCRAFT_CERTIFICATIONS } from "./config";
import { CertificationId, DockBerth } from "./types";

export interface SkycraftBerthDefinition {
  certification: CertificationId;
  berth: DockBerth;
  platformY: number;
  walkwayFromZ: number;
}

/**
 * Fixed, bounded starter-dock berths. Advanced pads are prepared only after
 * their certification is unlocked, so a fresh world presents one readable
 * Apprentice construction area rather than a wall of inactive platforms.
 */
export const SKYCRAFT_BERTHS: readonly SkycraftBerthDefinition[] = [
  {
    certification: "apprentice_raft",
    berth: {
      id: "starter_apprentice",
      dimensionId: "minecraft:overworld",
      origin: { x: 20, y: 161, z: -3 },
      size: SKYCRAFT_CERTIFICATIONS.apprentice_raft.berthSize,
      orientation: "north",
    },
    platformY: 160,
    walkwayFromZ: 0,
  },
  {
    certification: "ember_skiff",
    berth: {
      id: "starter_ember",
      dimensionId: "minecraft:overworld",
      origin: { x: 20, y: 161, z: 7 },
      size: SKYCRAFT_CERTIFICATIONS.ember_skiff.berthSize,
      orientation: "north",
    },
    platformY: 160,
    walkwayFromZ: 1,
  },
  {
    certification: "specialist_airframe",
    berth: {
      id: "starter_specialist",
      dimensionId: "minecraft:overworld",
      origin: { x: 20, y: 161, z: 19 },
      size: SKYCRAFT_CERTIFICATIONS.specialist_airframe.berthSize,
      orientation: "north",
    },
    platformY: 160,
    walkwayFromZ: 16,
  },
  {
    certification: "expedition_skycraft",
    berth: {
      id: "starter_expedition",
      dimensionId: "minecraft:overworld",
      origin: { x: 20, y: 161, z: 33 },
      size: SKYCRAFT_CERTIFICATIONS.expedition_skycraft.berthSize,
      orientation: "north",
    },
    platformY: 160,
    walkwayFromZ: 30,
  },
  {
    certification: "masterwork_skycraft",
    berth: {
      id: "starter_masterwork",
      dimensionId: "minecraft:overworld",
      origin: { x: 20, y: 161, z: 49 },
      size: SKYCRAFT_CERTIFICATIONS.masterwork_skycraft.berthSize,
      orientation: "north",
    },
    platformY: 160,
    walkwayFromZ: 46,
  },
];

export function skycraftBerth(
  certification: CertificationId,
): SkycraftBerthDefinition {
  const definition = SKYCRAFT_BERTHS.find(
    (candidate) => candidate.certification === certification,
  );

  if (definition === undefined) {
    throw new Error(`No Skycraft berth for ${certification}.`);
  }

  return {
    ...definition,
    berth: {
      ...definition.berth,
      origin: { ...definition.berth.origin },
      size: { ...definition.berth.size },
    },
  };
}

export function berthContains(
  berth: DockBerth,
  position: { x: number; y: number; z: number },
): boolean {
  return (
    position.x >= berth.origin.x &&
    position.x < berth.origin.x + berth.size.x &&
    position.y >= berth.origin.y &&
    position.y < berth.origin.y + berth.size.y &&
    position.z >= berth.origin.z &&
    position.z < berth.origin.z + berth.size.z
  );
}

export function berthBlockCount(berth: DockBerth): number {
  return berth.size.x * berth.size.y * berth.size.z;
}
