const INITIAL_PLAYER_FAST_RETRY_TICKS = 5;
const INITIAL_PLAYER_SLOW_RETRY_TICKS = 20;

/**
 * First-player arrival never reaches a terminal timeout. It polls quickly
 * during normal bootstrap, then continues once per second while an automatic
 * generation retry is recovering the starter island.
 */
export function initialPlayerRetryDelayTicks(
  attempt: number,
  fastRetryAttempts: number,
): number {
  return attempt < fastRetryAttempts
    ? INITIAL_PLAYER_FAST_RETRY_TICKS
    : INITIAL_PLAYER_SLOW_RETRY_TICKS;
}
