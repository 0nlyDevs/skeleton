import { describe, expect, it } from "vitest";

import { isPlaceholderEmail, placeholderEmail } from "@/lib/accounts/no-email";
import { findPasswordViolation } from "@/lib/auth/password-policy";
import { usernameViolation } from "@/lib/validation/profile";
import { baseUsername, newAccessCode } from "@/modules/assisted-accounts/assisted-accounts.codes";

describe("accounts without email (F71)", () => {
  it("prints access codes the password policy accepts", () => {
    for (let index = 0; index < 500; index += 1) {
      const code = newAccessCode();
      expect(code).toMatch(/^[A-Z]{4}-[a-z]{4}-[0-9]{4}!$/);
      expect(findPasswordViolation(code)).toBeNull();
    }
  });

  it("derives a valid username from a name, accents included", () => {
    expect(baseUsername("Amina", "Rahal")).toBe("amina.rahal");
    expect(baseUsername("Élodie", "N'Guyen")).toBe("elodie.nguyen");
    expect(usernameViolation(baseUsername("Jo", "Li"))).toBeNull();
  });

  it("uses an address on the reserved .invalid domain that is never mailed", () => {
    expect(placeholderEmail("amina.rahal")).toBe("amina.rahal@no-email.invalid");
    expect(isPlaceholderEmail("amina.rahal@no-email.invalid")).toBe(true);
    expect(isPlaceholderEmail("amina@example.org")).toBe(false);
  });
});
