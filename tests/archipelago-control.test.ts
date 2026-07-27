import { afterEach, describe, expect, it } from "vitest";

import {
  isArchipelagoGenerationPaused,
  pauseArchipelagoGeneration,
  resumeArchipelagoGeneration,
} from "../scripts/generation/archipelago-control";

describe("archipelago development control", () => {
  afterEach(() => resumeArchipelagoGeneration());

  it("pauses and resumes only new ambient-island queueing", () => {
    expect(isArchipelagoGenerationPaused()).toBe(false);

    pauseArchipelagoGeneration();
    expect(isArchipelagoGenerationPaused()).toBe(true);

    resumeArchipelagoGeneration();
    expect(isArchipelagoGenerationPaused()).toBe(false);
  });
});
