/**
 * Visible sign-in protection.
 *
 * The form and the admin page only show what the limiter decides, so these
 * tests pin the pieces they depend on: the counter keys must be the ones the
 * successful sign-in clears, addresses are truncated before display, and the
 * "attack" status needs several accounts, not one resident's typos.
 */

import { describe, expect, it } from "vitest";

import { rateLimitKey } from "@/lib/rate-limit/keys";
import { RATE_LIMITS } from "@/lib/rate-limit/rules";
import { accountCounterKey, ipCounterKey, isSignInPath } from "@/modules/login-protection/login-protection.service";
import { maskIp, protectionStatus, WAVE_THRESHOLDS } from "@/modules/login-protection/login-protection.stats";

describe("sign-in counter keys", () => {
  it("match the keys a successful sign-in clears", () => {
    expect(accountCounterKey("/sign-in/email", " Hei.Colombe@Gmail.com ")).toBe(
      rateLimitKey("auth:/sign-in/email:account", "hei.colombe@gmail.com"),
    );
    expect(ipCounterKey("/sign-in/username", "203.0.113.7")).toBe(rateLimitKey("auth:/sign-in/username:ip", "203.0.113.7"));
  });

  it("recognises only the password sign-in endpoints", () => {
    expect(isSignInPath("/sign-in/email")).toBe(true);
    expect(isSignInPath("/sign-in/username")).toBe(true);
    expect(isSignInPath("/sign-up/email")).toBe(false);
    expect(isSignInPath("/sign-in/social")).toBe(false);
  });

  it("never counts sign-ins per IP for every attempt, only failures across accounts", async () => {
    const { GUARDED_AUTH_PATHS } = await import("@/lib/auth/auth-hooks");
    const signIn = GUARDED_AUTH_PATHS.filter((entry) => isSignInPath(entry.path));
    expect(signIn).toHaveLength(2);
    expect(signIn.every((entry) => entry.byAccount && !entry.byIp)).toBe(true);
  });

  it("gives the cross-account IP budget more room than one account", () => {
    expect(RATE_LIMITS.loginFailuresPerIp.limit).toBeGreaterThan(RATE_LIMITS.login.limit);
  });
});

describe("maskIp", () => {
  it("keeps the network part of an IPv4 address only", () => {
    expect(maskIp("203.0.113.42")).toBe("203.0.113.x");
  });

  it("keeps the first three groups of an IPv6 address", () => {
    expect(maskIp("2001:db8:85a3:0:0:8a2e:370:7334")).toBe("2001:db8:85a3::x");
  });

  it("never echoes something that is not an address", () => {
    expect(maskIp(null)).toBe("—");
    expect(maskIp("unknown")).toBe("—");
  });
});

describe("protectionStatus", () => {
  it("stays normal for a resident mistyping a password", () => {
    expect(protectionStatus({ failures: 4, accounts: 1 })).toBe("NORMAL");
  });

  it("flags many failures on one account as unusual, not as an attack", () => {
    expect(protectionStatus({ failures: 30, accounts: 1 })).toBe("ELEVATED");
  });

  it("calls failures across several accounts an attack", () => {
    expect(
      protectionStatus({ failures: WAVE_THRESHOLDS.attackFailures, accounts: WAVE_THRESHOLDS.attackAccounts }),
    ).toBe("ATTACK");
  });
});
