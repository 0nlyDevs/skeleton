/**
 * Public environment values that are safe to inline into the browser bundle.
 *
 * Next.js replaces `process.env.NEXT_PUBLIC_*` at build time, so these must be
 * read as static property accesses — no destructuring of `process.env`.
 */

export type RealtimeMode = "auto" | "socket" | "polling";

function readRealtimeMode(): RealtimeMode {
  const value = process.env.NEXT_PUBLIC_REALTIME_MODE;
  return value === "socket" || value === "polling" ? value : "auto";
}

export const publicEnv = {
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, ""),
  realtimeMode: readRealtimeMode(),
} as const;

/**
 * Absolute URL for a path, used in emails and OAuth redirects.
 * Falls back to a relative path when the origin is unknown (e.g. in tests).
 */
export function absoluteUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${publicEnv.appUrl}${normalized}`;
}
