import { describe, expect, it } from "vitest";

import {
  islandDefinition,
  islandPlacement,
  planIslandLayout,
} from "../scripts/config/islands";
import { structureBounds } from "../scripts/generation/bounds";
import {
  destinationGenerationRequest,
  discoverDestination,
  evaluateDestinationReadiness,
  islandLayoutRecordAtBlock,
  plannedIslandLayoutRecords,
  requestDestinationGeneration,
  shouldHoldForDestination,
} from "../scripts/generation/discovery";
import {
  completeGeneration,
  markStructurePlaced,
  queueGeneration,
} from "../scripts/generation/state";
import {
  createWorldState,
  recordIslandLayout,
} from "../scripts/persistence/schema";

const WORLD_SEED = 1234;

describe("destinationGenerationRequest", () => {
  it("uses the shipped pinned origin for a pinned island regardless of world state", () => {
    const state = createWorldState(WORLD_SEED);
    const request = destinationGenerationRequest(state, "ember_outpost");

    expect(request).toEqual({
      id: "ember_outpost",
      contentVersion: islandDefinition("ember_outpost").contentVersion,
      structureId: islandDefinition("ember_outpost").structureId,
      dimensionId: islandDefinition("ember_outpost").dimensionId,
      origin: { x: 72, y: 151, z: -10 },
    });
  });

  it("prefers a previously recorded layout origin for a seeded island", () => {
    const state = createWorldState(WORLD_SEED);
    const definition = islandDefinition("sunspire_reach");
    const recordedOrigin = { x: 999, y: 200, z: -999 };
    const withRecord = recordIslandLayout(state, [
      {
        id: definition.id,
        structureId: definition.structureId,
        dimensionId: definition.dimensionId,
        placement: definition.placement,
        origin: recordedOrigin,
        size: definition.size,
        reserved: structureBounds(recordedOrigin, definition.size),
        playerModified: false,
      },
    ]);

    expect(
      destinationGenerationRequest(withRecord, "sunspire_reach").origin,
    ).toEqual(recordedOrigin);
  });

  it("keeps a persisted origin even if a pinned registry origin changes", () => {
    const state = createWorldState(WORLD_SEED);
    const definition = islandDefinition("ember_outpost");
    const recordedOrigin = { x: 997, y: 200, z: -997 };
    const withRecord = recordIslandLayout(state, [
      {
        id: definition.id,
        structureId: definition.structureId,
        dimensionId: definition.dimensionId,
        placement: definition.placement,
        origin: recordedOrigin,
        size: definition.size,
        reserved: structureBounds(recordedOrigin, definition.size),
        playerModified: false,
      },
    ]);

    expect(
      destinationGenerationRequest(withRecord, "ember_outpost").origin,
    ).toEqual(recordedOrigin);
  });

  it("falls back to a fresh layout computation for a seeded island with no record", () => {
    const state = createWorldState(WORLD_SEED);
    const expected = islandPlacement(
      planIslandLayout(state.worldSeed, state.layoutVersion),
      "sunspire_reach",
    ).origin;

    expect(
      destinationGenerationRequest(state, "sunspire_reach").origin,
    ).toEqual(expected);
  });
});

describe("plannedIslandLayoutRecords", () => {
  it("turns the complete deterministic registry plan into persistent records", () => {
    const state = createWorldState(WORLD_SEED);
    const records = plannedIslandLayoutRecords(state);
    const layout = planIslandLayout(state.worldSeed, state.layoutVersion);

    expect(records.map((record) => record.id)).toEqual(
      layout.placements.map((placement) => placement.id),
    );
    expect(
      records.find((record) => record.id === "sunspire_reach"),
    ).toMatchObject({
      origin: islandPlacement(layout, "sunspire_reach").origin,
      reserved: islandPlacement(layout, "sunspire_reach").reserved,
    });
  });
});

describe("islandLayoutRecordAtBlock", () => {
  it("finds edits inside the placed structure but not its padding", () => {
    const state = createWorldState(WORLD_SEED);
    const withLayout = recordIslandLayout(
      state,
      plannedIslandLayoutRecords(state),
    );
    const starter = withLayout.islandLayout.starter_island;

    expect(
      islandLayoutRecordAtBlock(withLayout, starter.dimensionId, starter.origin)
        ?.id,
    ).toBe("starter_island");
    expect(
      islandLayoutRecordAtBlock(withLayout, starter.dimensionId, {
        x: starter.origin.x - 1,
        y: starter.origin.y,
        z: starter.origin.z,
      }),
    ).toBeUndefined();
    expect(
      islandLayoutRecordAtBlock(withLayout, "minecraft:nether", starter.origin),
    ).toBeUndefined();
  });
});

describe("evaluateDestinationReadiness", () => {
  const destination = { id: "ember_outpost", contentVersion: 4 };

  it("reports not_started when nothing has been queued or generated", () => {
    const state = createWorldState(WORLD_SEED);
    expect(evaluateDestinationReadiness(state, destination).status).toBe(
      "not_started",
    );
  });

  it("reports generating while the destination itself occupies the queue", () => {
    const state = queueGeneration(createWorldState(WORLD_SEED), {
      id: "ember_outpost",
      contentVersion: 4,
      structureId: "skyknights:ember_outpost",
      dimensionId: "minecraft:overworld",
      origin: { x: 72, y: 151, z: -10 },
    });

    expect(evaluateDestinationReadiness(state, destination)).toMatchObject({
      status: "generating",
      activeJobId: "ember_outpost",
      stage: "queued",
    });
  });

  it("reports waiting when a different island currently occupies the queue", () => {
    const state = queueGeneration(createWorldState(WORLD_SEED), {
      id: "frostspire",
      contentVersion: 2,
      structureId: "skyknights:frostspire",
      dimensionId: "minecraft:overworld",
      origin: { x: 240, y: 150, z: -11 },
    });

    expect(evaluateDestinationReadiness(state, destination)).toMatchObject({
      status: "waiting",
      activeJobId: "frostspire",
    });
  });

  it("reports ready once generated at the current content version", () => {
    let state = queueGeneration(createWorldState(WORLD_SEED), {
      id: "ember_outpost",
      contentVersion: 4,
      structureId: "skyknights:ember_outpost",
      dimensionId: "minecraft:overworld",
      origin: { x: 72, y: 151, z: -10 },
    });
    state = completeGeneration(markStructurePlaced(state));

    expect(evaluateDestinationReadiness(state, destination).status).toBe(
      "ready",
    );
  });

  it("never demands regeneration over a player-modified island (ADR-007)", () => {
    const definition = islandDefinition("sunspire_reach");
    let state = createWorldState(WORLD_SEED);
    state = {
      ...state,
      generatedIslandIds: ["sunspire_reach"],
      islandVersions: { sunspire_reach: 1 },
    };
    state = recordIslandLayout(state, [
      {
        id: definition.id,
        structureId: definition.structureId,
        dimensionId: definition.dimensionId,
        placement: definition.placement,
        origin: { x: 0, y: 0, z: 0 },
        size: definition.size,
        reserved: structureBounds({ x: 0, y: 0, z: 0 }, definition.size),
        playerModified: true,
      },
    ]);

    // Content version bumped (e.g. loot retuned) after the player already
    // edited the island; readiness must still be "ready", never a requeue.
    const bumpedDestination = { id: "sunspire_reach", contentVersion: 2 };
    expect(evaluateDestinationReadiness(state, bumpedDestination).status).toBe(
      "ready",
    );
  });
});

describe("requestDestinationGeneration", () => {
  const emberDestination = {
    id: "ember_outpost",
    contentVersion: 4,
    structureId: "skyknights:ember_outpost",
    dimensionId: "minecraft:overworld",
    origin: { x: 72, y: 151, z: -10 },
  };

  it("queues generation when the destination has not started", () => {
    const state = createWorldState(WORLD_SEED);
    const next = requestDestinationGeneration(state, emberDestination);

    expect(next.activeGeneration).toMatchObject({
      id: "ember_outpost",
      stage: "queued",
    });
  });

  it("never disturbs a queue already occupied by another island", () => {
    const state = queueGeneration(createWorldState(WORLD_SEED), {
      id: "frostspire",
      contentVersion: 2,
      structureId: "skyknights:frostspire",
      dimensionId: "minecraft:overworld",
      origin: { x: 240, y: 150, z: -11 },
    });

    const next = requestDestinationGeneration(state, emberDestination);

    expect(next).toBe(state);
    expect(next.activeGeneration?.id).toBe("frostspire");
  });

  it("is a no-op once the destination is already ready", () => {
    let state = queueGeneration(createWorldState(WORLD_SEED), emberDestination);
    state = markStructurePlaced(state);
    state = {
      ...state,
      generatedIslandIds: ["ember_outpost"],
      islandVersions: { ember_outpost: 4 },
      activeGeneration: undefined,
    };

    expect(requestDestinationGeneration(state, emberDestination)).toBe(state);
  });

  it("force-requeues a generated island whose content version has moved on", () => {
    const state = {
      ...createWorldState(WORLD_SEED),
      generatedIslandIds: ["ember_outpost"],
      islandVersions: { ember_outpost: 3 },
    };

    const next = requestDestinationGeneration(state, emberDestination);

    expect(next.activeGeneration).toMatchObject({
      id: "ember_outpost",
      stage: "queued",
    });
    expect(next.generatedIslandIds).not.toContain("ember_outpost");
  });
});

describe("discoverDestination", () => {
  it("does not queue an island that is absent from the registry", () => {
    const state = createWorldState(WORLD_SEED);
    const outcome = discoverDestination(state, "unknown_island");

    expect(outcome.state).toBe(state);
    expect(outcome.readiness.status).toBe("excluded");
    expect(shouldHoldForDestination(outcome.readiness)).toBe(false);
  });

  it("queues newly gameplay-ready seeded islands", () => {
    const state = createWorldState(WORLD_SEED);
    const outcome = discoverDestination(state, "sunspire_reach");

    expect(outcome.state.activeGeneration?.id).toBe("sunspire_reach");
    expect(outcome.readiness.status).toBe("generating");
    expect(shouldHoldForDestination(outcome.readiness)).toBe(true);
  });

  it("queues an undiscovered destination and reports it not yet ready", () => {
    const state = createWorldState(WORLD_SEED);
    const outcome = discoverDestination(state, "ember_outpost");

    expect(outcome.state.activeGeneration?.id).toBe("ember_outpost");
    expect(outcome.readiness.status).toBe("generating");
    expect(shouldHoldForDestination(outcome.readiness)).toBe(true);
  });

  it("reports ready without touching state once generation has completed", () => {
    let state = createWorldState(WORLD_SEED);
    const definition = islandDefinition("ember_outpost");
    state = queueGeneration(state, {
      id: definition.id,
      contentVersion: definition.contentVersion,
      structureId: definition.structureId,
      dimensionId: definition.dimensionId,
      origin: definition.pinnedOrigin!,
    });
    state = markStructurePlaced(state);
    state = {
      ...state,
      generatedIslandIds: ["ember_outpost"],
      islandVersions: { ember_outpost: definition.contentVersion },
      activeGeneration: undefined,
    };

    const outcome = discoverDestination(state, "ember_outpost");

    expect(outcome.state).toBe(state);
    expect(outcome.readiness.status).toBe("ready");
    expect(shouldHoldForDestination(outcome.readiness)).toBe(false);
  });

  it("holds the player while a different destination occupies the queue", () => {
    const state = queueGeneration(createWorldState(WORLD_SEED), {
      id: "frostspire",
      contentVersion: 2,
      structureId: "skyknights:frostspire",
      dimensionId: "minecraft:overworld",
      origin: { x: 240, y: 150, z: -11 },
    });

    const outcome = discoverDestination(state, "ember_outpost");

    expect(outcome.state).toBe(state);
    expect(outcome.readiness).toMatchObject({
      status: "waiting",
      activeJobId: "frostspire",
    });
    expect(shouldHoldForDestination(outcome.readiness)).toBe(true);
  });
});
