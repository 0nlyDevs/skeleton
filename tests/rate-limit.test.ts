/**
 * Rate-limit identity.
 *
 * A limiter is only as good as the key it counts on. These tests pin the two
 * properties that broke in practice:
 *
 *   * a client must not be able to choose its own identity from a header, and
 *   * every path that resolves an IP must agree, or a successful sign-in clears a
 *     counter nobody is reading and legitimate users stay locked out.
 */

import { describe, expect, it } from "vitest";

import { normalizeIp, resolveClientIp, UNKNOWN_IP } from "@/lib/http/client-ip";
import { accountAndIpKeys, hashIdentifier, rateLimitKey } from "@/lib/rate-limit/keys";

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("resolveClientIp", () => {
  it("uses the socket address the server injected", () => {
    expect(resolveClientIp(headers({ "x-connection-ip": "203.0.113.7" }), false)).toBe("203.0.113.7");
  });

  it("ignores X-Forwarded-For when no proxy is trusted", () => {
    // Any client can send this header; believing it would let a brute-forcer
    // reset its own counter on every request.
    expect(resolveClientIp(headers({ "x-forwarded-for": "1.2.3.4" }), false)).toBe(UNKNOWN_IP);
  });

  it("reads X-Forwarded-For only when a proxy is trusted, taking the first valid entry", () => {
    expect(resolveClientIp(headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }), true)).toBe("9.9.9.9");
    // A leading value that is not an IP must be skipped, not returned.
    expect(resolveClientIp(headers({ "x-forwarded-for": "not-an-ip, 10.0.0.1" }), true)).toBe("10.0.0.1");
  });

  it("normalises the forms the same address arrives in", () => {
    expect(normalizeIp("::ffff:127.0.0.1")).toBe("127.0.0.1");
    expect(normalizeIp(" 127.0.0.1 ")).toBe("127.0.0.1");
    expect(normalizeIp("127.0.0.1:5555")).toBe("127.0.0.1");
    // A bare IPv6 address has colons of its own; it must survive untouched.
    expect(normalizeIp("::1")).toBe("::1");
  });

  it("resolves the same address identically from the socket and from a session record", () => {
    const fromHeaders = resolveClientIp(headers({ "x-connection-ip": "::ffff:127.0.0.1" }), false);
    expect(fromHeaders).toBe(normalizeIp("127.0.0.1"));
  });
});

describe("rate-limit keys", () => {
  it("is stable for the same input and different per part order", () => {
    expect(rateLimitKey("login", "ip", "1.2.3.4")).toBe(rateLimitKey("login", "ip", "1.2.3.4"));
    expect(rateLimitKey("login", "ip", "1.2.3.4")).not.toBe(rateLimitKey("login", "1.2.3.4", "ip"));
  });

  it("does not put an email or an IP in the key in the clear", () => {
    const key = rateLimitKey("auth", "account", "someone@example.com");
    expect(key).not.toContain("someone@example.com");
    expect(key).not.toContain("example.com");
    expect(key).toMatch(/^auth:[0-9a-f]{40}$/);
  });

  it("separates the account counter from the IP counter", () => {
    const { accountKey, ipKey } = accountAndIpKeys("auth:/sign-in/email", "Alice@Example.com", "1.2.3.4");
    expect(accountKey).not.toBe(ipKey);
    // Case-folding keeps "Alice@" and "alice@" on one counter.
    expect(accountKey).toBe(accountAndIpKeys("auth:/sign-in/email", "alice@example.com", "5.6.7.8").accountKey);
  });

  it("bounds the key length whatever the identifier", () => {
    expect(hashIdentifier("x".repeat(10_000))).toHaveLength(40);
  });
});
