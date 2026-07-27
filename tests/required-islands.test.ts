import { describe, expect, it } from "vitest";

import { plannedIslandLayoutRecords } from "../scripts/generation/discovery";
import { queueNextRequiredIsland } from "../scripts/generation/required-islands";
import {
  completeGeneration,
  markStructurePlaced,
} from "../scripts/generation/state";
import {
  createWorldState,
  markIslandPlayerModified,
  recordIslandLayout,
} from "../scripts/persistence/schema";

function realmState() {
  const initial = createWorldState(2026);
  return recordIslandLayout(initial, plannedIslandLayoutRecords(initial));
}

describe("required-island bootstrap sequence", () => {
  it("queues starter, Ember, and Frostspire in released progression order", () => {
    let state = realmState();
    const queuedIds: string[] = [];

    for (let index = 0; index < 3; index += 1) {
      state = queueNextRequiredIsland(state);
      queuedIds.push(state.activeGeneration?.id ?? "none");
      state = completeGeneration(markStructurePlaced(state));
    }

    expect(queuedIds).toEqual([
      "starter_island",
      "ember_outpost",
      "frostspire",
    ]);
    expect(state.generatedIslandIds).toEqual(queuedIds);
    expect(queueNextRequiredIsland(state)).toBe(state);
  });

  it("keeps a persisted active job instead of replacing it", () => {
    const queued = queueNextRequiredIsland(realmState());

    expect(queueNextRequiredIsland(queued)).toBe(queued);
    expect(queued.activeGeneration?.id).toBe("starter_island");
  });

  it("refreshes an interrupted queued job to the packaged content version", () => {
    const queued = queueNextRequiredIsland(realmState());
    const stale = {
      ...queued,
      activeGeneration: {
        ...queued.activeGeneration!,
        contentVersion: 3,
      },
    };
    const refreshed = queueNextRequiredIsland(stale);

    expect(refreshed.activeGeneration).toEqual({
      ...queued.activeGeneration,
      contentVersion: 4,
    });
  });

  it("does not restamp a player-modified island after a version mismatch", () => {
    let state = realmState();

    for (let index = 0; index < 3; index += 1) {
      state = completeGeneration(
        markStructurePlaced(queueNextRequiredIsland(state)),
      );
    }

    state = markIslandPlayerModified(state, "starter_island");
    state = {
      ...state,
      islandVersions: {
        ...state.islandVersions,
        starter_island: 0,
      },
    };

    expect(queueNextRequiredIsland(state)).toBe(state);
  });
});
