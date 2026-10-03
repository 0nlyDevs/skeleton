/**
 * When the next wave arrives, from the last successful sync. The API gives
 * "minutes until next wave" at fetch time, so the estimate is anchored on that
 * moment rather than shown as a number that silently goes stale.
 */
export function nextWaveAt(minutesUntilNext: number | null | undefined, lastSuccessAt: string | null): Date | null {
  if (typeof minutesUntilNext !== "number" || !lastSuccessAt) return null;
  const anchor = Date.parse(lastSuccessAt);
  if (Number.isNaN(anchor)) return null;
  return new Date(anchor + minutesUntilNext * 60_000);
}

/** Whole minutes left before `at`, never negative. */
export function minutesUntil(at: Date | null, now: number = Date.now()): number | null {
  if (!at) return null;
  return Math.max(0, Math.ceil((at.getTime() - now) / 60_000));
}
