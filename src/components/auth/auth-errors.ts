import type { MessageKey, Translator } from "@/lib/i18n";

/**
 * Translating BetterAuth errors into user-facing messages.
 *
 * Two rules drive everything here:
 *
 *  1. **The server's prose is never rendered.** A message is chosen by error
 *     *code* and looked up in our dictionary, so the interface stays fully
 *     translated even though BetterAuth answers in English.
 *  2. **Nothing confirms an account exists.** A wrong password and an unknown
 *     address produce the same sentence, which is what makes the login form
 *     useless as an enumeration oracle.
 */

export interface AuthErrorLike {
  readonly message?: string | undefined;
  readonly code?: string | undefined;
  readonly status?: number | undefined;
}

export function isRateLimited(error: AuthErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (error.status === 429) return true;
  return (error.code ?? "").toUpperCase().includes("TOO_MANY");
}

function codeOf(error: AuthErrorLike): string {
  return (error.code ?? "").toUpperCase();
}

/** Message key for a failed sign-in. Always generic unless it is actionable. */
export function loginErrorMessageKey(error: AuthErrorLike): MessageKey {
  if (isRateLimited(error)) return "auth.login.too_many";

  const code = codeOf(error);
  if (code.includes("NOT_VERIFIED")) return "auth.login.unverified";
  // A suspension is the one failure the resident can act on, and it only ever
  // arrives after the credentials have been verified — see `banReasonOf`.
  if (code.includes("BANNED")) return "auth.login.banned";

  return "auth.login.failed";
}

/**
 * The moderator's own reason for a suspension, carried in the error message.
 *
 * This is data rather than prose: it was written once, by whoever applied the
 * ban, in whatever language they used — the same reason the admin table and the
 * citizen list already render verbatim from `user.banReason`. So there is
 * nothing here to translate, and the "never render the server's prose" rule
 * does not apply to it.
 *
 * It only ever reaches this function once the password has been verified, which
 * is why repeating it does not confirm that an address is registered.
 */
export function banReasonOf(error: AuthErrorLike | null | undefined): string | null {
  if (!error || !codeOf(error).includes("BANNED")) return null;
  // One trailing full stop is dropped, so a reason written as a sentence does
  // not end the message it is dropped into twice.
  const reason = (error.message ?? "").trim().replace(/\.$/, "");
  return reason.length > 0 ? reason : null;
}

/** The sentence a failed sign-in should show, with a suspension's reason in it. */
export function loginErrorText(error: AuthErrorLike, t: Translator): string {
  const key = loginErrorMessageKey(error);
  if (key !== "auth.login.banned") return t(key);

  const reason = banReasonOf(error);
  return reason ? t("auth.login.banned_reason", { reason }) : t(key);
}

/**
 * Message key for a failed sign-up, or `null` when the caller should show the
 * neutral "check your inbox" screen instead.
 *
 * `USER_ALREADY_EXISTS` deliberately maps to `null`: telling a stranger that an
 * address is registered hands them a membership oracle for free.
 */
export function registerErrorMessageKey(error: AuthErrorLike): MessageKey | null {
  if (isRateLimited(error)) return "auth.login.too_many";

  const code = codeOf(error);
  if (code.includes("ALREADY_EXISTS")) return null;
  if (code === "PASSWORD_TOO_WEAK") return "auth.password.too_weak";
  if (code === "PASSWORD_BREACHED") return "auth.password.breached";
  if (code === "USERNAME_IS_ALREADY_TAKEN") return "profile.error.username_taken";
  if (code.includes("USERNAME")) return "profile.error.username";
  if (code === "INVALID_FIRST_NAME" || code === "INVALID_LAST_NAME") return "profile.error.name";
  if (code === "INVALID_BIRTH_DATE") return "profile.error.birth_date";
  if (code.includes("INVALID_EMAIL")) return "error.VALIDATION_ERROR";
  if (code.includes("PASSWORD") || code.includes("INVALID_PASSWORD")) {
    return "error.VALIDATION_ERROR";
  }

  return "error.INTERNAL_ERROR";
}

/** Message key for a password-reset request failure. */
export function resetRequestErrorMessageKey(error: AuthErrorLike): MessageKey {
  if (isRateLimited(error)) return "auth.login.too_many";
  return "error.INTERNAL_ERROR";
}

/** Message key for a failed password change or reset submission. */
export function resetPasswordErrorMessageKey(error: AuthErrorLike): MessageKey {
  if (isRateLimited(error)) return "auth.login.too_many";

  const code = codeOf(error);
  if (code.includes("INVALID_TOKEN") || code.includes("TOKEN_EXPIRED")) {
    return "auth.verify.failed";
  }
  if (code === "PASSWORD_TOO_WEAK") return "auth.password.too_weak";
  if (code === "PASSWORD_BREACHED") return "auth.password.breached";
  if (code.includes("PASSWORD")) return "error.VALIDATION_ERROR";

  return "error.INTERNAL_ERROR";
}

/** True for a thrown fetch failure, which has no `code`. */
export function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError;
}
