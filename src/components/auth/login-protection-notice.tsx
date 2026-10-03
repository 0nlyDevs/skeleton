"use client";

import { LockKeyhole, ShieldCheck, Timer } from "lucide-react";
import { useEffect, useState } from "react";

import Link from "@/components/ui/link";
import { useTranslation } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

/** Attempts a resident gets before the pause; mirrors `RATE_LIMITS.login`. */
export const LOGIN_ATTEMPTS = 5;
/** Below this, a pause is the burst guard's breather, not an account lock. */
const SHORT_PAUSE_SECONDS = 60;

function formatClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Seconds left until `until`, ticking once a second; 0 once it has passed. */
export function useCountdown(until: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (until === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  return until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000));
}

/**
 * What the server said about the sign-in budget, read from a failed response:
 * attempts left before the pause, and when the pause ends. The server
 * enforces both; this only makes them visible. Pass `fetchOptions` to
 * `signIn.email` / `signIn.username`.
 */
export function useLoginProtection() {
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [pauseSeconds, setPauseSeconds] = useState(0);
  const secondsLeft = useCountdown(lockedUntil);

  const readResponse = (response: Response) => {
    const remaining = Number(response.headers.get("X-Login-Attempts-Remaining"));
    // Our limiter sends Retry-After; BetterAuth's short burst guard sends X-Retry-After.
    const retryAfter = Number(response.headers.get("Retry-After") ?? response.headers.get("X-Retry-After"));
    if (response.headers.has("X-Login-Attempts-Remaining") && Number.isFinite(remaining)) setAttemptsLeft(remaining);
    if (Number.isFinite(retryAfter) && retryAfter > 0 && (response.status === 429 || remaining === 0)) {
      setLockedUntil(Date.now() + retryAfter * 1000);
      setPauseSeconds(retryAfter);
    }
  };

  const paused = lockedUntil !== null && secondsLeft > 0;
  return {
    attemptsLeft,
    secondsLeft,
    /** The account (or source) is paused: the full panel with the reset path. */
    locked: paused && pauseSeconds >= SHORT_PAUSE_SECONDS,
    /** A few seconds' breather after rapid-fire attempts; nobody was alerted. */
    slowDown: paused && pauseSeconds < SHORT_PAUSE_SECONDS,
    paused,
    /** Show "N attempts left" once some are spent, until the pause. */
    showAttemptsLeft: attemptsLeft !== null && attemptsLeft > 0 && attemptsLeft < LOGIN_ATTEMPTS,
    fetchOptions: { onError: ({ response }: { response: Response }) => readResponse(response) },
  };
}

/**
 * The pause after too many failed attempts: what happened, a live countdown,
 * and the way out that does not involve waiting.
 */
export function LoginLockout({ secondsLeft }: { readonly secondsLeft: number }) {
  const t = useTranslation();
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/8 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning/15 text-warning">
          <LockKeyhole className="size-[18px]" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-[0.9062rem] font-semibold">{t("tn.login.locked_title")}</p>
          <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">{t("tn.login.locked_body")}</p>
        </div>
      </div>
      <p className="flex items-baseline justify-between gap-3 rounded-lg bg-surface px-3 py-2">
        <span className="text-[0.8125rem] text-muted-foreground">{t("tn.login.locked_retry")}</span>
        <span className="font-mono text-[1.25rem] font-semibold tabular-nums" aria-live="off">
          {formatClock(secondsLeft)}
        </span>
      </p>
      <p className="text-[0.8125rem] leading-relaxed">
        {t("tn.login.locked_owner")}{" "}
        <Link href="/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("tn.login.locked_reset")}
        </Link>
      </p>
    </div>
  );
}

/** "N attempts left" with one dot per attempt, shown once a few are spent. */
export function AttemptsLeft({ remaining }: { readonly remaining: number }) {
  const t = useTranslation();
  return (
    <div className="flex items-center gap-3 text-[0.8125rem]" aria-live="polite">
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: LOGIN_ATTEMPTS }, (_, index) => (
          <span key={index} className={cn("size-2 rounded-full", index < remaining ? "bg-warning" : "bg-border")} />
        ))}
      </span>
      <span className="text-muted-foreground">
        {t(remaining === 1 ? "tn.login.attempts_left_one" : "tn.login.attempts_left_other", { count: remaining })}
      </span>
    </div>
  );
}

/** "Too many attempts in a row, wait N s": the burst guard, said plainly. */
export function SlowDown({ secondsLeft }: { readonly secondsLeft: number }) {
  const t = useTranslation();
  return (
    <p role="status" className="flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2 text-[0.8125rem]">
      <Timer className="size-4 shrink-0 text-warning" aria-hidden />
      {t("tn.login.slow_down", { seconds: secondsLeft })}
    </p>
  );
}

/** One quiet line saying the door is guarded, without adding a step. */
export function ProtectedSignInNote() {
  const t = useTranslation();
  return (
    <p className="flex items-center justify-center gap-1.5 text-[0.75rem] text-muted-foreground">
      <ShieldCheck className="size-3.5 text-success" aria-hidden />
      {t("tn.login.protected")}
    </p>
  );
}
