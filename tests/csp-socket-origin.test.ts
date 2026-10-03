import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The CSP socket origin.
 *
 * This exists because of a bug that shipped and hid itself: the production
 * policy carried `connect-src 'self' wss://0.0.0.0:3000`, so every WebSocket
 * was refused and realtime silently ran on the polling fallback. Nothing
 * errored, so it read as a design choice rather than a broken header.
 *
 * Two properties are being defended, and they pull in opposite directions:
 *   - it must not come from the request, which is both unreliable behind
 *     Passenger and attacker-controllable;
 *   - it must not come from `NEXT_PUBLIC_APP_URL`, which Next inlines at build
 *     time and which therefore cannot be corrected without a rebuild.
 */
describe("CSP socket origin", () => {
  const saved = { auth: process.env.BETTER_AUTH_URL, app: process.env.NEXT_PUBLIC_APP_URL };

  beforeEach(() => {
    delete process.env.BETTER_AUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  afterEach(() => {
    if (saved.auth === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = saved.auth;
    if (saved.app === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = saved.app;
  });

  it("reads the runtime origin, so a running server needs no rebuild", async () => {
    process.env.BETTER_AUTH_URL = "https://judge.example.test";
    const { socketOrigin } = await import("@/proxy");

    expect(socketOrigin(false)).toBe("wss://judge.example.test");
  });

  it("prefers the runtime origin over the build-time public one", async () => {
    // This is the production case: the bundle carries a stale or placeholder
    // NEXT_PUBLIC_APP_URL, and only the runtime variable is correct.
    process.env.NEXT_PUBLIC_APP_URL = "http://0.0.0.0:3000";
    process.env.BETTER_AUTH_URL = "https://real.example.test";
    const { socketOrigin } = await import("@/proxy");

    expect(socketOrigin(false)).toBe("wss://real.example.test");
  });

  it("ignores a trailing slash so the policy has no double slash", async () => {
    process.env.BETTER_AUTH_URL = "https://example.test/";
    const { socketOrigin } = await import("@/proxy");

    expect(socketOrigin(false)).toBe("wss://example.test");
  });

  it("upgrades a plain-http origin to wss in production", async () => {
    // `ws:` would be blocked by `upgrade-insecure-requests` anyway.
    process.env.BETTER_AUTH_URL = "http://example.test";
    const { socketOrigin } = await import("@/proxy");

    expect(socketOrigin(false)).toBe("wss://example.test");
  });

  it("allows ws: in development, where the local server is plain http", async () => {
    process.env.BETTER_AUTH_URL = "http://localhost:3000";
    const { socketOrigin } = await import("@/proxy");

    expect(socketOrigin(true)).toBe("ws://localhost:3000");
  });

  it("narrows to same-origin rather than emitting a broken origin", async () => {
    // A malformed or hostile value must not widen the policy, and must not
    // leak the literal string into a security header.
    for (const bad of ["not a url", "javascript:alert(1)", "wss://ok.test", "https://", ""]) {
      process.env.BETTER_AUTH_URL = bad;
      vi.resetModules();
      const { socketOrigin } = await import("@/proxy");

      expect(socketOrigin(false)).toBe("");
    }
  });

  it("never returns a path, only an origin", async () => {
    process.env.BETTER_AUTH_URL = "https://example.test/some/path?q=1#frag";
    const { socketOrigin } = await import("@/proxy");

    expect(socketOrigin(false)).toBe("wss://example.test");
  });
});