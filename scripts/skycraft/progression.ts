import { ReferenceBlueprintId } from "./catalog";
import { SKYCRAFT_LIMITS } from "./config";
import { blueprintByteSize } from "./blueprint";
import { AirshipBlueprint } from "./types";
import { CertificationId } from "./types";

export type SkycraftMilestone =
  | "starter:resources_ready"
  | "discovery:ember_outpost"
  | "unlock:skycutter_blueprint"
  | "discovery:sunspire_reach"
  | "discovery:verdant_hollow"
  | "discovery:frostspire"
  | "objective:combat_complete"
  | "material:gold_copper"
  | "material:froststeel"
  | "material:relic_shards_2"
  | "material:aether_core";

/**
 * Later certification caps remain developer-gated until the roadmap's BDS,
 * multiplayer, and target-device measurements are recorded. Testers can opt
 * in with `/tag @s add skyknights.skycraft_experimental`.
 */
export const SKYCRAFT_EXPERIMENTAL_CERTIFICATION_TAG =
  "skyknights.skycraft_experimental";

export interface SkycraftCertification {
  id: CertificationId;
  requiresAll: readonly SkycraftMilestone[];
  requiresAny?: readonly (readonly SkycraftMilestone[])[];
  maxMass: number;
  maxBlocks: number;
  referenceBlueprints: readonly ReferenceBlueprintId[];
}

export const SKYCRAFT_CERTIFICATION_LADDER: readonly SkycraftCertification[] = [
  {
    id: "apprentice_raft",
    requiresAll: ["starter:resources_ready"],
    maxMass: 24,
    maxBlocks: 24,
    referenceBlueprints: ["minnow"],
  },
  {
    id: "ember_skiff",
    requiresAll: [
      "starter:resources_ready",
      "discovery:ember_outpost",
      "unlock:skycutter_blueprint",
    ],
    maxMass: 56,
    maxBlocks: 56,
    referenceBlueprints: ["dart", "cargo_punt"],
  },
  {
    id: "specialist_airframe",
    requiresAll: ["starter:resources_ready"],
    requiresAny: [
      [
        "discovery:sunspire_reach",
        "discovery:verdant_hollow",
        "material:gold_copper",
      ],
      ["discovery:frostspire", "material:froststeel"],
    ],
    maxMass: 112,
    maxBlocks: 96,
    referenceBlueprints: ["cloudwhale", "aether_disc", "frostwing"],
  },
  {
    id: "expedition_skycraft",
    requiresAll: [
      "starter:resources_ready",
      "material:relic_shards_2",
      "objective:combat_complete",
    ],
    maxMass: 160,
    maxBlocks: 160,
    referenceBlueprints: ["surveyor"],
  },
  {
    id: "masterwork_skycraft",
    requiresAll: ["material:relic_shards_2", "material:aether_core"],
    maxMass: 240,
    maxBlocks: 240,
    referenceBlueprints: ["grand_cruiser"],
  },
];

export function certification(id: CertificationId): SkycraftCertification {
  const found = SKYCRAFT_CERTIFICATION_LADDER.find(
    (candidate) => candidate.id === id,
  );

  if (found === undefined) {
    throw new Error(`Unknown Skycraft certification: ${id}`);
  }

  return {
    ...found,
    requiresAll: [...found.requiresAll],
    requiresAny: found.requiresAny?.map((group) => [...group]),
    referenceBlueprints: [...found.referenceBlueprints],
  };
}

export function unlockedCertifications(
  milestones: ReadonlySet<SkycraftMilestone>,
): readonly SkycraftCertification[] {
  return SKYCRAFT_CERTIFICATION_LADDER.filter((candidate) => {
    if (
      !candidate.requiresAll.every((requirement) => milestones.has(requirement))
    ) {
      return false;
    }

    return (
      candidate.requiresAny === undefined ||
      candidate.requiresAny.some((group) =>
        group.every((requirement) => milestones.has(requirement)),
      )
    );
  });
}

export function activatedCertifications(
  milestones: ReadonlySet<SkycraftMilestone>,
  experimentalAccess: boolean,
): readonly SkycraftCertification[] {
  return experimentalAccess
    ? SKYCRAFT_CERTIFICATION_LADDER
    : unlockedCertifications(milestones).filter(
        (candidate) => candidate.id === "apprentice_raft",
      );
}

const REFERENCE_REQUIREMENTS: Readonly<
  Partial<Record<ReferenceBlueprintId, readonly SkycraftMilestone[]>>
> = {
  cloudwhale: [
    "discovery:sunspire_reach",
    "discovery:verdant_hollow",
    "material:gold_copper",
  ],
  aether_disc: ["discovery:frostspire", "material:froststeel"],
  frostwing: ["discovery:frostspire", "material:froststeel"],
  surveyor: ["material:relic_shards_2"],
  grand_cruiser: ["material:aether_core"],
};

export function canUseReferenceBlueprint(
  referenceId: ReferenceBlueprintId,
  milestones: ReadonlySet<SkycraftMilestone>,
): boolean {
  const branchRequirements = REFERENCE_REQUIREMENTS[referenceId] ?? [];
  return (
    branchRequirements.every((requirement) => milestones.has(requirement)) &&
    unlockedCertifications(milestones).some((candidate) =>
      candidate.referenceBlueprints.includes(referenceId),
    )
  );
}

export interface PlayerBlueprintMetadata {
  ownerPlayerId: string;
  airshipId: string;
  name: string;
  referenceId?: ReferenceBlueprintId;
  revision: number;
  savedByteSize: number;
}

export type BlueprintOverwriteResult =
  | { allowed: true; metadata: PlayerBlueprintMetadata }
  | {
      allowed: false;
      reason: "not_owner" | "byte_limit" | "revision_conflict";
    };

export function createBlueprintMetadata(
  ownerPlayerId: string,
  blueprint: AirshipBlueprint,
  name: string,
  referenceId?: ReferenceBlueprintId,
): PlayerBlueprintMetadata {
  return {
    ownerPlayerId,
    airshipId: blueprint.airshipId,
    name: name.trim().slice(0, 32) || "Untitled Airship",
    referenceId,
    revision: blueprint.revision,
    savedByteSize: blueprintByteSize(blueprint),
  };
}

export function planBlueprintOverwrite(
  current: PlayerBlueprintMetadata,
  actorPlayerId: string,
  expectedRevision: number,
  next: AirshipBlueprint,
  name: string,
): BlueprintOverwriteResult {
  if (current.ownerPlayerId !== actorPlayerId) {
    return { allowed: false, reason: "not_owner" };
  }

  if (
    current.revision !== expectedRevision ||
    next.revision <= current.revision
  ) {
    return { allowed: false, reason: "revision_conflict" };
  }

  const savedByteSize = blueprintByteSize(next);

  if (savedByteSize > SKYCRAFT_LIMITS.blueprintByteCap) {
    return { allowed: false, reason: "byte_limit" };
  }

  return {
    allowed: true,
    metadata: {
      ...current,
      name: name.trim().slice(0, 32) || current.name,
      revision: next.revision,
      savedByteSize,
    },
  };
}
