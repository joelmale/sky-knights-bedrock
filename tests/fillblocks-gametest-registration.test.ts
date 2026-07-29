import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { TEST_IDS } from "../tools/bds/fillblocks-plan.mjs";

const MAIN_TS_PATH = path.resolve("profiles", "gametest", "scripts", "main.ts");

describe("fillBlocks GameTest registration", () => {
  it("registers exactly the planned benchmark tests, all outside the default suite", async () => {
    const source = await readFile(MAIN_TS_PATH, "utf8");
    const benchmarkSection = source.slice(
      source.indexOf("// fillBlocks benchmark registrations"),
    );
    const registered = [
      ...benchmarkSection.matchAll(
        /register\(\s*"skyknights",\s*"(fillblocks_[^"]+)"/gu,
      ),
    ].map((match) => `skyknights:${match[1]}`);

    expect(registered).toStrictEqual(TEST_IDS);
    expect(benchmarkSection).not.toContain("Tags.suiteDefault");
    expect([
      ...benchmarkSection.matchAll(
        /\.tag\("skyknights:fillblocks_benchmark"\)/gu,
      ),
    ]).toHaveLength(TEST_IDS.length);
  });

  it("retains the four existing default-suite registrations", async () => {
    const source = await readFile(MAIN_TS_PATH, "utf8");
    for (const id of [
      "skiff_has_pilot_and_passenger_seats",
      "skycutter_advanced_cargo_has_27_slots",
      "sky_raider_has_120_hull",
      "skycutter_has_four_seats_and_cargo",
    ]) {
      expect(source).toContain(`"${id}"`);
    }
  });
});
