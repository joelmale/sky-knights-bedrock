import { describe, expect, it } from "vitest";

import { Logger, LogRecord } from "../scripts/diagnostics/logger";

describe("Logger", () => {
  it("emits structured scope, tick, and fields", () => {
    const records: LogRecord[] = [];
    const logger = new Logger(
      "runtime",
      (record) => records.push(record),
      () => 81,
    );

    logger.child("generation").info("checkpoint", { stage: "placed" });

    expect(records).toEqual([
      {
        level: "info",
        scope: "runtime.generation",
        message: "checkpoint",
        tick: 81,
        fields: { stage: "placed" },
      },
    ]);
  });
});
