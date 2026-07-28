import { describe, expect, it } from "vitest";

import {
  DOCK_DECK_BLOCK,
  resolveDockDeck,
  shouldEnsureDockmaster,
} from "../scripts/gameplay/dockyard-materials";

interface DeckInput {
  islandRecorded: boolean;
  dockSupportTypeId: string | undefined;
  firstShipBuilt: boolean;
  mood: "steward" | "wrathful";
}

// Spread rather than destructuring defaults: a destructured default fires on
// an explicitly passed `undefined`, which would silently turn the
// unloaded-chunk cases into intact-deck cases.
function outcome(overrides: Partial<DeckInput> = {}) {
  return resolveDockDeck({
    islandRecorded: true,
    dockSupportTypeId: DOCK_DECK_BLOCK,
    firstShipBuilt: false,
    mood: "steward",
    ...overrides,
  });
}

describe("dock deck decision", () => {
  it("stations the steward while the deck is intact", () => {
    expect(outcome()).toBe("station");
    expect(outcome({ firstShipBuilt: true })).toBe("station");
  });

  // D-1: the Dockmaster has gravity and a damage sensor that blocks every
  // source including the void, so before this decision existed a broken deck
  // meant it fell forever while the sweep teleported it back every ten
  // seconds. No input may produce that combination again.
  it("never asks to station a Dockmaster whose deck is gone", () => {
    for (const firstShip of [false, true]) {
      for (const mood of ["steward", "wrathful"] as const) {
        expect(
          outcome({
            dockSupportTypeId: "minecraft:air",
            firstShipBuilt: firstShip,
            mood,
          }),
          `firstShip=${firstShip} mood=${mood}`,
        ).not.toBe("station");
      }
    }
  });

  it("rebuilds the deck instead of punishing a player without a ship", () => {
    expect(outcome({ dockSupportTypeId: "minecraft:air" })).toBe(
      "restore_deck",
    );
    expect(outcome({ dockSupportTypeId: undefined })).toBe("wait");
  });

  it("turns the steward only once the player already has a ship", () => {
    expect(
      outcome({ dockSupportTypeId: "minecraft:air", firstShipBuilt: true }),
    ).toBe("provoke");
  });

  it("never restores the steward once it has turned", () => {
    for (const support of [DOCK_DECK_BLOCK, "minecraft:air", undefined]) {
      expect(
        outcome({ dockSupportTypeId: support, mood: "wrathful" }),
        String(support),
      ).toBe("leave_wrathful");
    }
  });

  it("waits while the dock chunk is unavailable", () => {
    expect(
      outcome({ islandRecorded: false, dockSupportTypeId: undefined }),
    ).toBe("wait");
  });

  it("keeps the original station predicate intact", () => {
    expect(shouldEnsureDockmaster(true, undefined)).toBe(true);
    expect(shouldEnsureDockmaster(false, DOCK_DECK_BLOCK)).toBe(true);
    expect(shouldEnsureDockmaster(false, "minecraft:air")).toBe(false);
  });
});
