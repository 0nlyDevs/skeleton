import { beforeAll, describe, expect, it, vi } from "vitest";

import { UNREADABLE } from "@/lib/crypto/field-encryption";

beforeAll(() => {
  process.env.DATABASE_URL ??= "mysql://test:test@localhost:3306/test";
  process.env.BETTER_AUTH_SECRET ??= "test-secret-test-secret-test-secret";
});

describe("field encryption", () => {
  it("round-trips and never stores plaintext", async () => {
    const { decryptField, encryptField } = await import("@/lib/crypto/field-encryption");
    const stored = encryptField("bonjour 👋 secret");
    expect(stored.startsWith("enc:v1:")).toBe(true);
    expect(stored).not.toContain("bonjour");
    expect(decryptField(stored)).toBe("bonjour 👋 secret");
  });

  it("uses a fresh IV so equal messages encrypt differently", async () => {
    const { encryptField } = await import("@/lib/crypto/field-encryption");
    expect(encryptField("same")).not.toBe(encryptField("same"));
  });

  it("detects tampering instead of returning garbage", async () => {
    const { decryptField, encryptField } = await import("@/lib/crypto/field-encryption");
    const stored = encryptField("integrity");
    const tampered = `${stored.slice(0, -2)}${stored.endsWith("A") ? "B" : "A"}A`;
    expect(decryptField(tampered)).toBe(UNREADABLE);
  });

  it("never reports lost data as empty data", async () => {
    // The failure this guards against: a rotated key silently returning ""
    // looked identical to a field that was always empty, so messages simply
    // disappeared with nothing in the logs to explain it.
    const { decryptField, encryptField } = await import("@/lib/crypto/field-encryption");
    const unreadable = decryptField(encryptField("secret").replace(/.$/, "A"));
    expect(unreadable).not.toBe("");
    expect(unreadable).toContain("DATA_ENCRYPTION_KEY");
  });

  it("reports itself unhealthy once anything has failed to decrypt", async () => {
    // The counter is process-wide on purpose — it is a health signal for the
    // whole app, not per-call — so the transition needs a fresh module.
    vi.resetModules();
    const { decryptField, encryptField, encryptionHealth } = await import(
      "@/lib/crypto/field-encryption"
    );
    expect(encryptionHealth().healthy).toBe(true);

    decryptField(encryptField("secret").replace(/.$/, "A"));

    const health = encryptionHealth();
    expect(health.healthy).toBe(false);
    expect(health.failures).toBeGreaterThan(0);
    expect(health.lastFailureAt).not.toBeNull();
    expect(health.keySource).toBeTypeOf("string");
  });

  it("refuses to re-encrypt the marker, so a failed read cannot overwrite the row", async () => {
    const { encryptField } = await import("@/lib/crypto/field-encryption");
    // Otherwise a read-modify-write would persist the marker as if it were the
    // user's real message, destroying data that a later key fix could recover.
    expect(() => encryptField(UNREADABLE)).toThrow(/Refusing to encrypt/);
  });

  it("passes legacy plaintext through", async () => {
    const { decryptField } = await import("@/lib/crypto/field-encryption");
    expect(decryptField("written before encryption")).toBe("written before encryption");
  });
});
