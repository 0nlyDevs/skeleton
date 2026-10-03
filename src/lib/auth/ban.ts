/**
 * Ban semantics.
 *
 * A ban is either indefinite or time-boxed. Keeping the interpretation in one
 * pure function means the sign-in hook, the admin table and the seed script all
 * agree on what "banned" means — and that an expired ban stops applying without
 * anyone having to run a job.
 */

import { APIError } from "better-auth/api";

export interface BanStateInput {
  readonly banned: boolean;
  readonly banExpires: Date | null;
}

export interface BanState {
  readonly banned: boolean;
  readonly until: Date | null;
  /** True when `banned` was set but the lock has already expired. */
  readonly expired: boolean;
  readonly reason: string | null;
}

export function resolveBanState(
  input: BanStateInput & { readonly banReason?: string | null },
  now: Date = new Date(),
): BanState {
  if (!input.banned) {
    return { banned: false, until: null, expired: false, reason: null };
  }

  const until = input.banExpires;

  if (until && until.getTime() <= now.getTime()) {
    return { banned: false, until, expired: true, reason: input.banReason ?? null };
  }

  return { banned: true, until, expired: false, reason: input.banReason ?? null };
}

/** Compact label for the admin table, e.g. `until 12 Mar 2026` or `indefinite`. */
export function describeBan(state: BanState, formatter: (date: Date) => string): string {
  if (!state.banned) return state.expired ? "expired" : "active";
  return state.until ? `until ${formatter(state.until)}` : "indefinite";
}

/**
 * The answer BetterAuth returns when a suspended account asks for a session.
 *
 * The caller only ever reaches session creation **after** the password, the
 * passkey or the OAuth identity has been verified, so telling this account why
 * it is suspended does not tell a stranger that the address exists — a wrong
 * password still fails earlier, with the same generic sentence as an unknown
 * address.
 *
 * It is a 403 rather than a 401 for a second reason: only a rejected password
 * counts against the brute-force budget, and being suspended is not a guess.
 */
export function bannedAccountError(state: BanState): APIError {
  return new APIError("FORBIDDEN", { code: "BANNED_USER", message: state.reason ?? "" });
}
