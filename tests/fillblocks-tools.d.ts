declare module "*bds/fillblocks-plan.mjs" {
  export const MARKER_PREFIX: string;
  export const REGION: { minX: number; minZ: number; size: number };
  export const UNLOADED_OFFSET_BLOCKS: number;
  export const TICKING_AREA_NAME: string;
  export const FOOTPRINT: number;
  export const CEILING_HEIGHTS: number[];
  export const LEGACY_FILL_CAP_BLOCKS: number;
  export const ABOVE_CAP_DIMENSIONS: { x: number; y: number; z: number };
  export const REALISTIC_BAND_HEIGHT: number;
  export const REALISTIC_SAMPLE_COUNT: number;
  export const BATCH_TOTAL_HEIGHT: number;
  export const BATCH_BAND_HEIGHT: number;
  export const TEST_IDS: string[];
  export const METRIC_NAMES: Record<string, string>;
  export const EXPECTED_METRIC_BY_TEST_ID: Map<string, string>;
  export function volumeBlocks(footprint: number, height: number): number;
  export function rectangularVolumeBlocks(dimensions: {
    x: number;
    y: number;
    z: number;
  }): number;
  export function patchServerProperties(
    original: string,
    values: Record<string, string>,
  ): string;
  export function parseBdsVersion(output: string): string | undefined;
  export function parseEnvironmentFile(
    contents: string,
  ): Record<string, string>;
  export function parseFillBlocksMarkers(
    output: string,
  ): Array<Record<string, unknown>>;
  export function summarizeFillBlocksMarkers(
    markers: Array<Record<string, unknown>>,
  ): Record<string, Record<string, unknown> | null>;
}
