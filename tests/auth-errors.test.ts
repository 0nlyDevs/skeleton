/**
 * A suspended account that still knows its password.
 *
 * The rejection it gets must name the suspension and the moderator's reason,
 * and it must never be confused with — or degrade into — a wrong password,
 * which is the answer a stranger has to keep getting.
 */

import { describe, expect, it } from "vitest";

import { banReasonOf, loginErrorMessageKey, loginErrorText } from "@/components/auth/auth-errors";
import { bannedAccountError, resolveBanState } from "@/lib/auth/ban";
import { createTranslator } from "@/lib/i18n";

const t = createTranslator("fr");

describe("session refused for a banned account", () => {
  it("answers with its own code instead of a failed session", () => {
    const state = resolveBanState({ banned: true, banExpires: null, banReason: "Spam répété." });
    const error = bannedAccountError(state);

    expect(error.statusCode).toBe(403);
    expect(error.body).toMatchObject({ code: "BANNED_USER" });
  });

  it("carries the moderator's reason along with the code", () => {
    const state = resolveBanState({ banned: true, banExpires: null, banReason: "Spam répété." });

    expect(bannedAccountError(state).body?.message).toBe("Spam répété.");
  });

  it("has no reason to carry when the account was banned without one", () => {
    const state = resolveBanState({ banned: true, banExpires: null, banReason: null });

    expect(bannedAccountError(state).body?.message).toBe("");
  });
});

describe("how a failed sign-in is described", () => {
  it("reads as a suspension, not as a bad password", () => {
    const error = { code: "BANNED_USER", message: "Spam répété.", status: 403 };

    expect(loginErrorMessageKey(error)).toBe("auth.login.banned");
    expect(loginErrorText(error, t)).toBe("Ce compte est suspendu : Spam répété. Contactez un administrateur.");
  });

  it("falls back to the plain suspension notice when no reason was given", () => {
    const error = { code: "BANNED_USER", message: "", status: 403 };

    expect(banReasonOf(error)).toBeNull();
    expect(loginErrorText(error, t)).toBe(t("auth.login.banned"));
  });

  it("does not end the sentence twice when the reason already has a full stop", () => {
    expect(banReasonOf({ code: "BANNED_USER", message: "Spam répété.", status: 403 })).toBe("Spam répété");
    expect(banReasonOf({ code: "BANNED_USER", message: "Récidive de spam", status: 403 })).toBe(
      "Récidive de spam",
    );
  });

  it("keeps a wrong password generic, whether or not the address exists", () => {
    expect(loginErrorMessageKey({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toBe("auth.login.failed");
    expect(banReasonOf({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 })).toBeNull();
  });

  it("ignores a reason attached to an error that is not a suspension", () => {
    expect(banReasonOf({ code: "INVALID_EMAIL_OR_PASSWORD", message: "Spam répété.", status: 401 })).toBeNull();
  });
});
