/**
 * Input rules.
 *
 * The theme running through these: user input never reaches a query or a
 * response unchecked. Limits are enforced server-side, sort fields are resolved
 * against an allowlist, and the password rule is a length floor plus a blocklist
 * rather than decoration.
 */

import { describe, expect, it } from "vitest";

import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  estimatePasswordStrength,
  findPasswordViolation,
  passwordSchema,
} from "@/lib/auth/password-policy";
import {
  PAGINATION_DEFAULT_LIMIT,
  PAGINATION_MAX_LIMIT,
  buildPageMeta,
  paginationQuerySchema,
  resolveSortField,
  resolveSortOrder,
  toPagination,
} from "@/lib/pagination";

describe("password policy", () => {
  it("accepts a password with every character class", () => {
    expect(passwordSchema.safeParse("Correct-Horse-42").success).toBe(true);
    expect(passwordSchema.safeParse("Webcup-2026!jury").success).toBe(true);
  });

  it("requires lower, upper, digit and symbol", () => {
    expect(passwordSchema.safeParse("correct horse battery staple").success).toBe(false);
    expect(passwordSchema.safeParse("CORRECT-HORSE-42").success).toBe(false);
    expect(passwordSchema.safeParse("Correct-Horse-xx").success).toBe(false);
    expect(passwordSchema.safeParse("CorrectHorse42x").success).toBe(false);
  });

  it("rejects short passwords and decorated common ones", () => {
    expect(passwordSchema.safeParse("Ab1!".padEnd(PASSWORD_MIN_LENGTH - 1, "x")).success).toBe(false);
    // Case and decoration must not be an escape hatch.
    expect(passwordSchema.safeParse("Password123!").success).toBe(false);
    expect(passwordSchema.safeParse("!Azerty2024").success).toBe(false);
    expect(passwordSchema.safeParse("Aaaaaaaa1!").success).toBe(false);
  });

  it("refuses a password built from the account identity", () => {
    expect(findPasswordViolation("Jdupont-2026!", { email: "jdupont@example.com" })).not.toBeNull();
    expect(findPasswordViolation("Tr4in-Station!", { email: "jdupont@example.com" })).toBeNull();
  });

  it("rejects whitespace-only input and anything past the ceiling", () => {
    expect(passwordSchema.safeParse("        ").success).toBe(false);
    expect(passwordSchema.safeParse("a".repeat(PASSWORD_MAX_LENGTH + 1)).success).toBe(false);
  });

  it("scores repetition as weak, not as long-and-strong", () => {
    expect(estimatePasswordStrength("aaaaaaaaaaaaaaaa").score).toBeLessThanOrEqual(1);
    expect(estimatePasswordStrength("password123").score).toBe(0);
    expect(estimatePasswordStrength("correct horse battery staple").score).toBeGreaterThanOrEqual(2);
  });
});

describe("pagination", () => {
  it("refuses a page size above the ceiling instead of honouring it", () => {
    // Rejected, not clamped: an oversized limit is a client bug, and answering
    // it with a 400 is clearer than silently returning 100 rows.
    expect(paginationQuerySchema.safeParse({ limit: "100000" }).success).toBe(false);
    expect(paginationQuerySchema.parse({ limit: String(PAGINATION_MAX_LIMIT) })).toEqual({
      page: 1,
      limit: PAGINATION_MAX_LIMIT,
    });
  });

  it("applies defaults when nothing is sent", () => {
    const parsed = paginationQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(PAGINATION_DEFAULT_LIMIT);
  });

  it("converts a page into a bounded skip/take", () => {
    expect(toPagination({ page: 3, limit: 20 })).toEqual({ page: 3, limit: 20, skip: 40, take: 20 });
    // Page 0 and a negative limit cannot produce a negative skip.
    const clamped = toPagination({ page: 0, limit: -5 });
    expect(clamped.skip).toBeGreaterThanOrEqual(0);
    expect(clamped.take).toBeGreaterThan(0);
  });

  it("reports consistent meta at the edges", () => {
    expect(buildPageMeta({ page: 1, limit: 20, total: 0 })).toMatchObject({
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
    expect(buildPageMeta({ page: 2, limit: 20, total: 41 })).toMatchObject({
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
    // A page past the end is clamped rather than reported as empty-but-valid.
    expect(buildPageMeta({ page: 99, limit: 20, total: 41 }).page).toBe(3);
  });
});

describe("sorting", () => {
  const allowed = ["createdAt", "title"] as const;

  it("resolves a requested field against the allowlist", () => {
    expect(resolveSortField("title", allowed, "createdAt")).toBe("title");
  });

  it("falls back instead of interpolating an unknown field", () => {
    expect(resolveSortField("password", allowed, "createdAt")).toBe("createdAt");
    expect(resolveSortField("createdAt; DROP TABLE", allowed, "createdAt")).toBe("createdAt");
    expect(resolveSortField(null, allowed, "createdAt")).toBe("createdAt");
  });

  it("accepts only the two valid orders", () => {
    expect(resolveSortOrder("asc")).toBe("asc");
    expect(resolveSortOrder("desc")).toBe("desc");
    expect(resolveSortOrder("ascending")).toBe("desc");
    expect(resolveSortOrder(undefined)).toBe("desc");
  });
});
