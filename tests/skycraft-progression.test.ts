import { describe, expect, it } from "vitest";

import {
  SKYCRAFT_EXPERIMENTAL_CERTIFICATION_TAG,
  activatedCertifications,
  canUseReferenceBlueprint,
  createBlueprintMetadata,
  planBlueprintOverwrite,
  unlockedCertifications,
} from "../scripts/skycraft/progression";
import { AirshipBlueprint } from "../scripts/skycraft/types";
import { componentAvailableAtCertification } from "../scripts/skycraft/config";

const blueprint: AirshipBlueprint = {
  schemaVersion: 1,
  airshipId: "airship-1",
  revision: 1,
  berth: {
    id: "dock",
    dimensionId: "minecraft:overworld",
    origin: { x: 0, y: 0, z: 0 },
    size: { x: 7, y: 5, z: 7 },
    orientation: "north",
  },
  helm: { x: 0, y: 0, z: 0, typeId: "skyknights:basic_helm", states: {} },
  blocks: [{ x: 0, y: 0, z: 0, typeId: "skyknights:basic_helm", states: {} }],
  components: [],
  engineeringVersion: 1,
};

describe("Skycraft progression and blueprint save policy", () => {
  it("prevents advanced components from bypassing berth certification", () => {
    expect(
      componentAvailableAtCertification(
        "skyknights:coal_thruster",
        "apprentice_raft",
      ),
    ).toBe(true);
    expect(
      componentAvailableAtCertification(
        "skyknights:aether_thruster",
        "apprentice_raft",
      ),
    ).toBe(false);
    expect(
      componentAvailableAtCertification(
        "skyknights:aether_thruster",
        "ember_skiff",
      ),
    ).toBe(true);
    expect(
      componentAvailableAtCertification(
        "skyknights:repair_station",
        "specialist_airframe",
      ),
    ).toBe(false);
  });

  it("keeps unmeasured certification caps behind an explicit tester tag", () => {
    const milestones = new Set([
      "starter:resources_ready",
      "discovery:ember_outpost",
      "unlock:skycutter_blueprint",
    ] as const);

    expect(
      activatedCertifications(milestones, false).map((entry) => entry.id),
    ).toEqual(["apprentice_raft"]);
    expect(
      activatedCertifications(milestones, true).map((entry) => entry.id),
    ).toEqual([
      "apprentice_raft",
      "ember_skiff",
      "specialist_airframe",
      "expedition_skycraft",
      "masterwork_skycraft",
    ]);
    expect(SKYCRAFT_EXPERIMENTAL_CERTIFICATION_TAG).toBe(
      "skyknights.skycraft_experimental",
    );
  });

  it("keeps advanced reference ships behind explicit material milestones", () => {
    const starter = new Set(["starter:resources_ready"] as const);
    expect(unlockedCertifications(starter).map((entry) => entry.id)).toEqual([
      "apprentice_raft",
    ]);
    expect(canUseReferenceBlueprint("grand_cruiser", starter)).toBe(false);
    expect(canUseReferenceBlueprint("minnow", starter)).toBe(true);
  });

  it("allows only owner, revision-matched, bounded blueprint overwrites", () => {
    const metadata = createBlueprintMetadata("owner", blueprint, "Minnow");
    expect(
      planBlueprintOverwrite(
        metadata,
        "guest",
        1,
        { ...blueprint, revision: 2 },
        "X",
      ),
    ).toEqual({ allowed: false, reason: "not_owner" });
    expect(
      planBlueprintOverwrite(
        metadata,
        "owner",
        1,
        { ...blueprint, revision: 2 },
        "Refit",
      ),
    ).toMatchObject({
      allowed: true,
      metadata: { name: "Refit", revision: 2 },
    });
    expect(
      planBlueprintOverwrite(
        metadata,
        "owner",
        2,
        { ...blueprint, revision: 2 },
        "Refit",
      ),
    ).toEqual({ allowed: false, reason: "revision_conflict" });
  });
});
