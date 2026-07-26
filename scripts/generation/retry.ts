const RETRY_BASE_DELAY_TICKS = 20;
const RETRY_MAX_DELAY_TICKS = 20 * 16;

/**
 * Returns a bounded exponential delay for a generation job retry. The retry
 * count is runtime-local on purpose: the persisted job remains immediately
 * resumable after a world reload instead of inheriting a stale long delay.
 */
export function generationRetryDelayTicks(retryCount: number): number {
  const normalizedRetryCount = Number.isFinite(retryCount)
    ? Math.max(1, Math.trunc(retryCount))
    : 1;
  const exponent = normalizedRetryCount - 1;
  return Math.min(
    RETRY_BASE_DELAY_TICKS * 2 ** exponent,
    RETRY_MAX_DELAY_TICKS,
  );
}
