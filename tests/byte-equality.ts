import { expect } from "vitest";

/**
 * Asserts two generated structure buffers are byte-identical.
 *
 * Vitest's `toEqual` walks a typed array element by element and builds diff
 * metadata as it goes. On the ~280 KB buffers the large ambient tiers produce
 * that costs about 2.2 seconds per file, which pushed
 * `archipelago-tier-scale.test.ts` past the 5 s default timeout whenever the
 * suite ran in parallel — a failure that looked like a generator bug and was
 * really an assertion-cost bug. A length check plus a byte scan is the same
 * assertion in about 5 ms.
 */
export function expectByteIdentical(
  actual: Uint8Array,
  expected: Uint8Array,
  label: string,
): void {
  expect(actual.length, `${label} length`).toBe(expected.length);

  let firstDifference = -1;

  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index] !== expected[index]) {
      firstDifference = index;
      break;
    }
  }

  expect(
    firstDifference,
    firstDifference < 0
      ? label
      : `${label} first differs at byte ${firstDifference}: ` +
          `${String(actual[firstDifference])} !== ${String(expected[firstDifference])}`,
  ).toBe(-1);
}
