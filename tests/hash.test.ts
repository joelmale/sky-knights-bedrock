import { describe, expect, it } from "vitest";

import { fnv1a32 } from "../scripts/util/hash";

describe("fnv1a32", () => {
  it("keeps the canonical empty-string offset basis", () => {
    expect(fnv1a32("")).toBe(0x811c9dc5);
  });

  it("is deterministic and input-sensitive", () => {
    expect(fnv1a32("skyknights")).toBe(fnv1a32("skyknights"));
    expect(fnv1a32("skyknights")).not.toBe(fnv1a32("sky-knights"));
  });
});
