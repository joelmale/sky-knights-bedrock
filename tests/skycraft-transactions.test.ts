import { describe, expect, it } from "vitest";
import {
  planAdvance,
  planFailure,
  planRecovery,
} from "../scripts/skycraft/transactions";
describe("skycraft transactions", () => {
  it("never selects two authorities during recovery", () => {
    expect(planAdvance("docked").next).toBe("validating");
    expect(planFailure("launching").next).toBe("recovery_required");
    expect(planRecovery("launching", true, false).authority).toBe(
      "docked_blueprint",
    );
    expect(planRecovery("launching", true, true).safe).toBe(false);
  });

  it("pins destructive launch and dock actions after their persistence gates", () => {
    expect(planAdvance("validating").actions).toEqual(["persist_blueprint"]);
    expect(planAdvance("launching").actions).toEqual([
      "clear_dock",
      "spawn_flight",
      "configure_flight",
      "persist_in_flight",
    ]);
    expect(planAdvance("docking").actions).toEqual([
      "restore_dock",
      "verify_dock",
      "remove_flight",
      "persist_docked",
      "unlock_berth",
    ]);
  });
});
