import { describe, expect, it } from "vitest";

import {
  ABOVE_CAP_DIMENSIONS,
  BATCH_BAND_HEIGHT,
  BATCH_TOTAL_HEIGHT,
  CEILING_HEIGHTS,
  EXPECTED_METRIC_BY_TEST_ID,
  FOOTPRINT,
  LEGACY_FILL_CAP_BLOCKS,
  MARKER_PREFIX,
  METRIC_NAMES,
  REGION,
  TEST_IDS,
  UNLOADED_OFFSET_BLOCKS,
  parseBdsVersion,
  parseEnvironmentFile,
  parseFillBlocksMarkers,
  patchServerProperties,
  rectangularVolumeBlocks,
  summarizeFillBlocksMarkers,
  volumeBlocks,
} from "../tools/bds/fillblocks-plan.mjs";

describe("fillBlocks benchmark plan", () => {
  it("parses the approved version from timestamped BDS output", () => {
    expect(
      parseBdsVersion("[2026-07-29 08:21:25:618 INFO] Version: 1.26.34.3"),
    ).toBe("1.26.34.3");
    expect(parseBdsVersion("Server started.")).toBeUndefined();
  });

  it("parses the ignored repository env file", () => {
    expect(
      parseEnvironmentFile(
        [
          "# local BDS root",
          "SKY_KNIGHTS_BDS_ROOT='D:\\\\Minecraft\\\\bedrock-server'",
          "IGNORED_LINE",
          "",
        ].join("\n"),
      ),
    ).toEqual({
      SKY_KNIGHTS_BDS_ROOT: "D:\\\\Minecraft\\\\bedrock-server",
    });
  });

  it("uses isolated 16x16 columns for every trial", () => {
    expect(REGION.size).toBeGreaterThanOrEqual(128);
    expect(REGION.size % FOOTPRINT).toBe(0);
    expect(REGION.minX + REGION.size).toBeLessThan(
      REGION.minX + UNLOADED_OFFSET_BLOCKS,
    );
  });

  it("covers the documented ceiling and equal batch/bulk total", () => {
    expect(
      CEILING_HEIGHTS.map((height) => volumeBlocks(FOOTPRINT, height)),
    ).toStrictEqual([4_096, 10_240, 32_768, 40_960, 65_536, 98_304]);
    expect(CEILING_HEIGHTS).toContain(BATCH_TOTAL_HEIGHT);
    expect(BATCH_TOTAL_HEIGHT % BATCH_BAND_HEIGHT).toBe(0);
    expect(CEILING_HEIGHTS).toContain(
      LEGACY_FILL_CAP_BLOCKS / (FOOTPRINT * FOOTPRINT),
    );
    expect(rectangularVolumeBlocks(ABOVE_CAP_DIMENSIONS)).toBe(
      LEGACY_FILL_CAP_BLOCKS + 1,
    );
  });

  it("forces authenticated allowlisted network settings", () => {
    const patched = patchServerProperties(
      ["online-mode=false", "allow-list=false", "server-port=19132", ""].join(
        "\n",
      ),
      {
        "online-mode": "true",
        "allow-list": "true",
        "server-port": "19156",
        "enable-lan-visibility": "false",
      },
    );

    expect(patched).toContain("online-mode=true");
    expect(patched).toContain("allow-list=true");
    expect(patched).toContain("server-port=19156");
    expect(patched).toContain("enable-lan-visibility=false");
    expect(patched).not.toContain("online-mode=false");
    expect(patched).not.toContain("allow-list=false");
  });

  it("requires one distinct named metric for every GameTest", () => {
    expect(TEST_IDS).toHaveLength(4);
    expect([...EXPECTED_METRIC_BY_TEST_ID.keys()]).toStrictEqual(TEST_IDS);
    expect(new Set(EXPECTED_METRIC_BY_TEST_ID.values()).size).toBe(4);
  });

  it("parses only object marker lines and represents missing metrics as null", () => {
    const markers = parseFillBlocksMarkers(
      `${MARKER_PREFIX}{"metric":"volume_ceiling"}\n${MARKER_PREFIX}null\n${MARKER_PREFIX}{`,
    );
    expect(markers).toStrictEqual([{ metric: METRIC_NAMES.volumeCeiling }]);
    expect(summarizeFillBlocksMarkers(markers)).toMatchObject({
      volumeCeiling: markers[0],
      batchVsBulkCost: null,
    });
  });
});
