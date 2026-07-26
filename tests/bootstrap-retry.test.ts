import { describe, expect, it } from "vitest";

import { initialPlayerRetryDelayTicks } from "../scripts/bootstrap/retry";

describe("initial player bootstrap retry", () => {
  it("polls quickly during normal island generation", () => {
    expect(initialPlayerRetryDelayTicks(0, 120)).toBe(5);
    expect(initialPlayerRetryDelayTicks(119, 120)).toBe(5);
  });

  it("continues at a bounded interval instead of timing out permanently", () => {
    expect(initialPlayerRetryDelayTicks(120, 120)).toBe(20);
    expect(initialPlayerRetryDelayTicks(10_000, 120)).toBe(20);
  });
});
