/**
 * Ban semantics.
 *
 * A ban is either indefinite or time-boxed. Keeping the interpretation in one
 * pure function means the sign-in hook, the admin table and the seed script all
 * agree on what "banned" means — and that an expired ban stops applying without
 * anyone having to run a job.
 */

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
