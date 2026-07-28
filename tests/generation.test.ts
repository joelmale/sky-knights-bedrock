import { describe, expect, it } from "vitest";

import {
  advancePartCursor,
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

const multipartJob = {
  ...job,
  id: "continent_a2_p24_p0",
  parts: [
    {
      structureId: "skyknights:comp_plain",
      origin: { x: 0, y: 96, z: 0 },
      rotation: "None" as const,
      row: 0,
      integrityBlock: {
        offset: { x: 15, y: 20, z: 15 },
        typeId: "minecraft:grass_block",
      },
    },
    {
      structureId: "skyknights:comp_ridge",
      origin: { x: 30, y: 96, z: 0 },
      rotation: "Rotate90" as const,
      row: 0,
      integrityBlock: {
        offset: { x: 15, y: 20, z: 15 },
        typeId: "minecraft:stone",
      },
    },
  ],
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

  it("advances multipart cursors monotonically without changing legacy jobs", () => {
    const queued = queueGeneration(createWorldState(12), multipartJob);
    const advanced = advancePartCursor(queued, multipartJob.id, 1);
    const unchanged = advancePartCursor(advanced, multipartJob.id, 0);
    const completed = advancePartCursor(unchanged, multipartJob.id, 99);
    const legacy = queueGeneration(createWorldState(12), job);

    expect(advanced.activeGeneration?.partCursor).toBe(1);
    expect(unchanged).toBe(advanced);
    expect(completed.activeGeneration?.partCursor).toBe(2);
    expect(advancePartCursor(legacy, job.id, 1)).toBe(legacy);
  });
});
