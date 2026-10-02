import { beforeAll, describe, expect, it } from "vitest";

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
    expect(decryptField(tampered)).toBe("");
  });

  it("passes legacy plaintext through", async () => {
    const { decryptField } = await import("@/lib/crypto/field-encryption");
    expect(decryptField("written before encryption")).toBe("written before encryption");
  });
});
