import { describe, expect, it } from "vitest";

import { generationRetryDelayTicks } from "../scripts/generation/retry";

describe("generation retry delays", () => {
  it("backs off exponentially from the first retry", () => {
    expect(generationRetryDelayTicks(1)).toBe(20);
    expect(generationRetryDelayTicks(2)).toBe(40);
    expect(generationRetryDelayTicks(3)).toBe(80);
  });

  it("bounds malformed and repeated retry counts", () => {
    expect(generationRetryDelayTicks(0)).toBe(20);
    expect(generationRetryDelayTicks(Number.NaN)).toBe(20);
    expect(generationRetryDelayTicks(999)).toBe(320);
  });
});
