// Host-side contract for the opt-in fillBlocks GameTest benchmark. These
// values are deliberately mirrored in profiles/gametest/scripts/main.ts.
export const MARKER_PREFIX = "SKY_KNIGHTS_FILLBLOCKS ";
export const REGION = { minX: 1_000_000, minZ: 1_000_000, size: 128 };
export const UNLOADED_OFFSET_BLOCKS = 4_096;
export const TICKING_AREA_NAME = "sk_fillblocks_loaded";
export const FOOTPRINT = 16;
export const CEILING_HEIGHTS = [16, 40, 128, 160, 256, 384];
export const LEGACY_FILL_CAP_BLOCKS = 32_768;
export const ABOVE_CAP_DIMENSIONS = { x: 9, y: 331, z: 11 };
export const REALISTIC_BAND_HEIGHT = 40;
export const REALISTIC_SAMPLE_COUNT = 6;
export const BATCH_TOTAL_HEIGHT = 128;
export const BATCH_BAND_HEIGHT = 32;
export const TEST_IDS = [
  "skyknights:fillblocks_volume_ceiling",
  "skyknights:fillblocks_realistic_column_throughput",
  "skyknights:fillblocks_ignore_chunk_bound_errors",
  "skyknights:fillblocks_batch_vs_bulk_cost",
];
export const METRIC_NAMES = {
  volumeCeiling: "volume_ceiling",
  realisticColumnThroughput: "realistic_column_throughput",
  ignoreChunkBoundErrors: "ignore_chunk_bound_errors",
  batchVsBulkCost: "batch_vs_bulk_cost",
};
export const EXPECTED_METRIC_BY_TEST_ID = new Map([
  [TEST_IDS[0], METRIC_NAMES.volumeCeiling],
  [TEST_IDS[1], METRIC_NAMES.realisticColumnThroughput],
  [TEST_IDS[2], METRIC_NAMES.ignoreChunkBoundErrors],
  [TEST_IDS[3], METRIC_NAMES.batchVsBulkCost],
]);

export function volumeBlocks(footprint, height) {
  return footprint * footprint * height;
}

export function rectangularVolumeBlocks({ x, y, z }) {
  return x * y * z;
}

export function patchServerProperties(original, values) {
  return Object.entries(values).reduce((output, [key, value]) => {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const line = new RegExp(`^${escapedKey}=.*$`, "mu");
    return line.test(output)
      ? output.replace(line, `${key}=${value}`)
      : `${output.trimEnd()}\n${key}=${value}\n`;
  }, original);
}

export function parseBdsVersion(output) {
  return output.match(/version\s*:\s*([0-9]+(?:\.[0-9]+){2,3})/iu)?.[1];
}

export function parseEnvironmentFile(contents) {
  const values = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");

    if (separator < 1) {
      continue;
    }

    values[line.slice(0, separator)] = line
      .slice(separator + 1)
      .trim()
      .replace(/^["']|["']$/gu, "");
  }

  return values;
}

export function parseFillBlocksMarkers(output) {
  const markers = [];
  for (const line of output.split(/\r?\n/u)) {
    const index = line.indexOf(MARKER_PREFIX);
    if (index < 0) continue;
    try {
      const marker = JSON.parse(line.slice(index + MARKER_PREFIX.length));
      if (marker !== null && typeof marker === "object") markers.push(marker);
    } catch {
      // A partial final BDS log line is not a metric.
    }
  }
  return markers;
}

export function summarizeFillBlocksMarkers(markers) {
  const byMetric = new Map(markers.map((marker) => [marker.metric, marker]));
  return {
    volumeCeiling: byMetric.get(METRIC_NAMES.volumeCeiling) ?? null,
    realisticColumnThroughput:
      byMetric.get(METRIC_NAMES.realisticColumnThroughput) ?? null,
    ignoreChunkBoundErrors:
      byMetric.get(METRIC_NAMES.ignoreChunkBoundErrors) ?? null,
    batchVsBulkCost: byMetric.get(METRIC_NAMES.batchVsBulkCost) ?? null,
  };
}
