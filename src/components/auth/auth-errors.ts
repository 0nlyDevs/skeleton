import type { MessageKey } from "@/lib/i18n";

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
  if (code.includes("BANNED")) return "auth.login.banned";

  return "auth.login.failed";
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
  if (code.includes("PASSWORD")) return "error.VALIDATION_ERROR";

  return "error.INTERNAL_ERROR";
}

/** True for a thrown fetch failure, which has no `code`. */
export function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError;
}
