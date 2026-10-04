/**
 * A shared hourly allowance of model calls for the features that run on text
 * anyone can type (finding a service, explaining a passage). When it is used
 * up, those features answer from their local rules until the hour turns:
 * they keep working, and the provider quota can never be drained from outside.
 */

const PER_HOUR = 400;
const holder = globalThis as unknown as { __aiBudget?: { hour: number; used: number } };

/** True when a model call may be made now; counts it. */
export function takeAiBudget(now = Date.now()): boolean {
  const hour = Math.floor(now / 3_600_000);
  const state = (holder.__aiBudget ??= { hour, used: 0 });
  if (state.hour !== hour) {
    state.hour = hour;
    state.used = 0;
  }
  if (state.used >= PER_HOUR) return false;
  state.used += 1;
  return true;
}
