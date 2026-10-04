"use client";

import { Check, X } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import {
  PASSWORD_MIN_LENGTH,
  checkPasswordRules,
  type PasswordRuleId,
} from "@/lib/auth/password-policy";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Rough password strength meter.
 *
 * Rewards length and character variety. Nothing here is used for
 * authorization — the server validates the policy independently and is the only
 * thing that decides whether a password is acceptable.
 */
export function scorePassword(password: string): number {
  if (password.length === 0) return 0;

  let score = 0;
  if (password.length >= 10) score += 1;
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
      <span className="w-[4.5rem] shrink-0 text-right text-[0.7188rem] font-medium text-muted-foreground">
        {t(level.key)}
      </span>
    </div>
  );
}

const RULE_KEYS: Record<PasswordRuleId, MessageKey> = {
  length: "auth.password.rule.length",
  lower: "auth.password.rule.lower",
  upper: "auth.password.rule.upper",
  digit: "auth.password.rule.digit",
  symbol: "auth.password.rule.symbol",
  repeat: "auth.password.rule.repeat",
  common: "auth.password.rule.common",
};

/**
 * Live checklist of the password policy, driven by the same rules the server
 * enforces, so a user never discovers a rule from a rejected submit.
 */
export function PasswordRequirements({
  password,
  className,
}: {
  readonly password: string;
  readonly className?: string;
}) {
  const t = useTranslation();
  const results = checkPasswordRules(password);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-[0.75rem] font-medium text-muted-foreground">{t("auth.password.rules_title")}</p>
      <ul className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2" aria-live="polite">
        {results.map((rule) => (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-1.5 text-[0.75rem] transition-colors",
              rule.ok ? "text-success" : "text-muted-foreground",
            )}
          >
            {rule.ok ? <Check className="size-3.5 shrink-0" aria-hidden /> : <X className="size-3.5 shrink-0 opacity-60" aria-hidden />}
            <span>{t(RULE_KEYS[rule.id], { min: PASSWORD_MIN_LENGTH })}</span>
            <span className="sr-only">{rule.ok ? "ok" : "non"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
