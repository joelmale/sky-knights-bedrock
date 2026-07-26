import { describe, expect, it } from "vitest";

import {
  completeGeneration,
  markStructurePlaced,
  queueGeneration,
} from "../scripts/generation/state";
import { createWorldState } from "../scripts/persistence/schema";

const job = {
  id: "starter_island",
  contentVersion: 3,
  structureId: "skyknights:starter_island",
  dimensionId: "minecraft:overworld",
  origin: { x: -7, y: 154, z: -7 },
};

describe("generation checkpoints", () => {
  it("resumes from the structure-placed checkpoint without losing the job", () => {
    const queued = queueGeneration(createWorldState(12), job);
    const placed = markStructurePlaced(queued);
    const resumed = queueGeneration(placed, job);

    expect(resumed).toBe(placed);
    expect(resumed.activeGeneration).toMatchObject({
      id: "starter_island",
      stage: "structure_placed",
      attempts: 1,
    });

    const completed = completeGeneration(resumed);
    expect(completed.activeGeneration).toBeUndefined();
    expect(completed.generatedIslandIds).toEqual(["starter_island"]);
    expect(completed.islandVersions).toEqual({ starter_island: 3 });
  });

  it("does not queue an already generated island unless forced", () => {
    const completed = completeGeneration(
      markStructurePlaced(queueGeneration(createWorldState(12), job)),
    );

    expect(queueGeneration(completed, job)).toBe(completed);
    expect(queueGeneration(completed, job, true).activeGeneration?.stage).toBe(
      "queued",
    );
  });
});
