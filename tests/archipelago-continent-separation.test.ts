import { describe, expect, it } from "vitest";

import {
  ARCHIPELAGO_LAYOUT_VERSION,
  STABLE_ARCHIPELAGO_DIMENSION,
  archipelagoContinentConflict,
  nextArchipelagoGenerationJob,
} from "../scripts/generation/archipelago-runtime";
import { planArchipelago } from "../scripts/generation/archipelago";
import { planArchipelagoV3 } from "../scripts/generation/archipelago-v3";
import { REQUIRED_ISLANDS } from "../scripts/config/constants";
import { WorldState, createWorldState } from "../scripts/persistence/schema";

const SEEDS = [0, 1, 7, 42, 512, 2026, 99_991, 4_294_967_290];

function readyState(seed: number): WorldState {
  const initial = createWorldState(seed);
  const islandVersions: Record<string, number> = {};

  for (const island of REQUIRED_ISLANDS) {
    islandVersions[island.id] = island.contentVersion;
  }

  return {
    ...initial,
    generatedIslandIds: REQUIRED_ISLANDS.map((island) => island.id),
    islandVersions,
  };
}

// Must be the DERIVED world seed, not the base seed handed to createWorldState.
// Planning continents from one and a3 islands from the other compares unrelated
// geometry and invents overlaps that do not exist.
function continents(worldSeed: number) {
  return planArchipelago(worldSeed, ARCHIPELAGO_LAYOUT_VERSION).filter(
    (island) => island.tier === "continent",
  );
}

// The a3 planner has no knowledge of the six a2 continent sites. Nothing in
// buildPlan excludes them, so this predicate is the only thing standing between
// a new solo island and a continent. It had no test and, until the edge gap was
// added, no clearance margin either.
describe("a3 islands never collide with a2 continents", () => {
  it("finds genuine conflicts to guard against", () => {
    let conflicts = 0;

    for (const seed of SEEDS) {
      const state = readyState(seed);

      for (const island of planArchipelagoV3(state.worldSeed)) {
        if (archipelagoContinentConflict(state.worldSeed, island)) {
          conflicts += 1;
        }
      }
    }

    // If this ever reaches zero the guard has stopped guarding anything and the
    // rest of this suite would pass vacuously.
    expect(conflicts).toBeGreaterThan(0);
  });

  it("never queues a solo island that overlaps a continent", () => {
    for (const seed of SEEDS) {
      const state = readyState(seed);

      for (const continent of continents(state.worldSeed)) {
        // Stand a player on the continent so its neighbourhood is exactly what
        // the planner is choosing from.
        const job = nextArchipelagoGenerationJob(state, [
          {
            dimensionId: STABLE_ARCHIPELAGO_DIMENSION,
            x: continent.x,
            z: continent.z,
          },
        ]);

        if (job === undefined || !job.id.startsWith("a3_")) {
          continue;
        }

        const island = planArchipelagoV3(state.worldSeed).find(
          (candidate) => candidate.id === job.id,
        );

        expect(island, `${seed}/${job.id}`).toBeDefined();
        expect(
          archipelagoContinentConflict(state.worldSeed, island!),
          `seed ${seed} queued ${job.id} over a continent`,
        ).toBeUndefined();
      }
    }
  });

  it("keeps a real gap rather than allowing islands to touch exactly", () => {
    let closest = Number.POSITIVE_INFINITY;

    for (const seed of SEEDS) {
      const state = readyState(seed);
      const reserved = continents(state.worldSeed);

      for (const island of planArchipelagoV3(state.worldSeed)) {
        if (archipelagoContinentConflict(state.worldSeed, island)) {
          continue;
        }

        for (const continent of reserved) {
          const dx = island.x - continent.x;
          const dz = island.z - continent.z;
          const centerY = island.y + Math.floor(island.size.y / 2);
          const continentY = continent.y + Math.floor(continent.size.y / 2);
          const verticallyApart =
            Math.abs(centerY - continentY) >=
            island.heightRadius + continent.heightRadius;

          // Vertically separated islands are legal at any lateral distance;
          // only co-planar pairs have to prove horizontal clearance.
          if (verticallyApart) {
            continue;
          }

          closest = Math.min(
            closest,
            Math.sqrt(dx * dx + dz * dz) - (island.radius + continent.radius),
          );
        }
      }
    }

    expect(closest).toBeGreaterThan(0);
  });
});
