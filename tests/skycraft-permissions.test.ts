import { describe, expect, it } from "vitest";
import {
  canOccupyNextSeat,
  canPerform,
  choosePilot,
} from "../scripts/skycraft/permissions";
describe("skycraft permissions", () => {
  const state = {
    ownerPlayerId: "owner",
    crew: [
      { playerId: "pilot", roles: ["pilot" as const] },
      { playerId: "builder", roles: ["builder" as const] },
    ],
  };
  it("enforces roles and one active pilot", () => {
    expect(canPerform(state, "pilot", "launch")).toBe(false);
    expect(canPerform(state, "pilot", "pilot")).toBe(true);
    expect(canPerform(state, "builder", "edit")).toBe(true);
    expect(canPerform(state, "builder", "launch")).toBe(false);
    expect(canOccupyNextSeat(state, "builder", 0, 2)).toBe(false);
    expect(canOccupyNextSeat(state, "builder", 1, 2)).toBe(true);
    expect(canOccupyNextSeat(state, "guest", 1, 2)).toBe(false);
    expect(choosePilot(state, "pilot", "owner").allowed).toBe(false);
  });

  it("rejects an assigned rider before native mount when certified seats are full", () => {
    expect(canOccupyNextSeat(state, "builder", 1, 1)).toBe(false);
  });
});
