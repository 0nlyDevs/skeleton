/**
 * F77/F78 — staying usable when many residents connect at once.
 *
 * The server measures itself (requests in flight, recent response time, event
 * loop delay). Past a threshold it switches to "essential mode" by itself:
 * the non-essential endpoints (assistant, recommendations, social feed,
 * people search, exports) answer "come back in a minute" at once instead of
 * queueing, so requests, alerts, services and the official message keep
 * answering fast. An administrator can also force the mode (feature flag
 * `load.essential_mode`). The mode ends by itself when the load drops.
 */

import { monitorEventLoopDelay } from "node:perf_hooks";

import { prisma } from "@/lib/db/prisma";

export type LoadLevel = "normal" | "busy" | "essential";

/** What can wait while the platform is under load. */
const SHEDDABLE_PREFIXES = ["/api/ai", "/api/search", "/api/discover", "/api/feed", "/api/map", "/api/exports", "/api/stats", "/api/users/search"] as const;

const LIMITS = { busyInFlight: 40, essentialInFlight: 90, busyLatencyMs: 900, essentialLatencyMs: 2_500, busyLagMs: 120, essentialLagMs: 350 } as const;
/** Once in essential mode, stay there this long after the last overload sample: no flapping. */
const HOLD_MS = 45_000;
export const FLAG_KEY = "load.essential_mode";

interface State {
  inFlight: number;
  latencyMs: number;
  served: number;
  shed: number;
  lastOverloadAt: number;
  forced: boolean;
  forcedReadAt: number;
  histogram: ReturnType<typeof monitorEventLoopDelay> | null;
}

// One state per process, surviving hot reloads in development.
const holder = globalThis as unknown as { __bubbleLoad?: State };
const state: State = (holder.__bubbleLoad ??= { inFlight: 0, latencyMs: 0, served: 0, shed: 0, lastOverloadAt: 0, forced: false, forcedReadAt: 0, histogram: null });

function lagMs(): number {
  if (!state.histogram) {
    state.histogram = monitorEventLoopDelay({ resolution: 20 });
    state.histogram.enable();
  }
  const lag = state.histogram.mean / 1e6;
  // Read then forget, so the figure follows the present, not the whole uptime.
  if (state.histogram.count > 200) state.histogram.reset();
  return Number.isFinite(lag) ? Math.max(0, lag - 20) : 0;
}

async function refreshForced(now: number): Promise<void> {
  if (now - state.forcedReadAt < 15_000) return;
  state.forcedReadAt = now;
  try {
    const flag = await prisma.featureFlag.findUnique({ where: { key: FLAG_KEY }, select: { enabled: true } });
    state.forced = flag?.enabled ?? false;
  } catch {
    // The database is the thing that is slow: keep the last known value.
  }
}

export interface LoadSnapshot {
  readonly level: LoadLevel;
  readonly forced: boolean;
  readonly inFlight: number;
  readonly latencyMs: number;
  readonly eventLoopLagMs: number;
  readonly served: number;
  readonly shed: number;
}

export function loadSnapshot(now = Date.now()): LoadSnapshot {
  const lag = lagMs();
  const overloaded = state.inFlight >= LIMITS.essentialInFlight || state.latencyMs >= LIMITS.essentialLatencyMs || lag >= LIMITS.essentialLagMs;
  if (overloaded) state.lastOverloadAt = now;
  const held = now - state.lastOverloadAt < HOLD_MS;
  const busy = state.inFlight >= LIMITS.busyInFlight || state.latencyMs >= LIMITS.busyLatencyMs || lag >= LIMITS.busyLagMs;
  const level: LoadLevel = state.forced || overloaded || held ? "essential" : busy ? "busy" : "normal";
  return { level, forced: state.forced, inFlight: state.inFlight, latencyMs: Math.round(state.latencyMs), eventLoopLagMs: Math.round(lag), served: state.served, shed: state.shed };
}

export function isSheddable(pathname: string): boolean {
  return SHEDDABLE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Called at the start of every API request. Returns `shed: true` when the
 * request must be refused at once, and the function to call when it ends.
 */
export async function enterRequest(pathname: string): Promise<{ shed: boolean; leave: () => void }> {
  const startedAt = Date.now();
  await refreshForced(startedAt);
  if (isSheddable(pathname) && loadSnapshot(startedAt).level === "essential") {
    state.shed += 1;
    return { shed: true, leave: () => undefined };
  }
  state.inFlight += 1;
  let left = false;
  return {
    shed: false,
    leave: () => {
      if (left) return;
      left = true;
      state.inFlight = Math.max(0, state.inFlight - 1);
      state.served += 1;
      // Moving average: the last twenty requests weigh the most.
      state.latencyMs = state.latencyMs === 0 ? Date.now() - startedAt : state.latencyMs * 0.95 + (Date.now() - startedAt) * 0.05;
    },
  };
}

/** After an administrator flips the switch: apply it without waiting for the cache. */
export function setForcedEssential(forced: boolean): void {
  state.forced = forced;
  state.forcedReadAt = Date.now();
}
