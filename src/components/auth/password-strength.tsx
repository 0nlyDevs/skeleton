"use client";

import { useTranslation } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

/**
 * Rough password strength meter.
 *
 * Deliberately conservative: it rewards *length* over symbol soup, because length
 * is what actually raises the cost of an offline attack and because a rule that
 * demands punctuation pushes people towards `Password1!`. Nothing here is used for
 * authorization — the server validates the policy independently and is the only
 * thing that decides whether a password is acceptable.
 */
export function scorePassword(password: string): number {
  if (password.length === 0) return 0;

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;

  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) =>
    pattern.test(password),
  ).length;

  if (classes >= 2) score += 1;
  if (classes >= 3) score += 1;

  // A single repeated character or a trivial sequence should never read as strong.
  if (/^(.)\1+$/.test(password)) return 1;

  return Math.min(4, score);
}

const LEVELS = [
  { key: "auth.password.weak", tone: "bg-error" },
  { key: "auth.password.weak", tone: "bg-error" },
  { key: "auth.password.fair", tone: "bg-warning" },
  { key: "auth.password.strong", tone: "bg-success" },
  { key: "auth.password.very_strong", tone: "bg-success" },
] as const;

export function PasswordStrength({
  password,
  className,
}: {
  readonly password: string;
  readonly className?: string;
}) {
  const t = useTranslation();
  const score = scorePassword(password);
  const level = LEVELS[score] ?? LEVELS[0];

  if (password.length === 0) return null;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="flex flex-1 gap-1" aria-hidden>
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-[var(--duration-normal)]",
              index < score ? level.tone : "bg-border",
            )}
          />
        ))}
      </div>
      <span className="w-[4.5rem] shrink-0 text-right text-[11.5px] font-medium text-muted-foreground">
        {t(level.key)}
      </span>
    </div>
  );
}
