"use client";

import { CheckCircle2, Circle, ShieldAlert, ShieldCheck } from "lucide-react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

/**
 * F53 — the account's protection at a glance, in plain words: what already
 * protects it, how strong that is, and the one next step that makes it
 * stronger. A passkey or two-step sign-in both count as the extra
 * verification; either is enough to reach "strong".
 */
export function ProtectionSummary({
  hasPassword,
  passkeys,
  twoFactor,
}: {
  readonly hasPassword: boolean;
  readonly passkeys: number;
  readonly twoFactor: boolean;
}) {
  const t = useTranslation();
  const strong = passkeys > 0 || twoFactor;
  const items = [
    { done: hasPassword || passkeys > 0, label: hasPassword ? t("security.protection.password") : t("security.protection.no_password") },
    { done: passkeys > 0, label: t("security.protection.passkey", { count: passkeys }), href: "#passkeys-card" },
    { done: twoFactor, label: t("security.protection.two_factor"), href: "#two-factor-card" },
  ];

  return (
    <section
      aria-labelledby="protection-title"
      className={cn(
        "flex flex-col gap-3 rounded-2xl border p-4",
        strong ? "border-success/40 bg-success/10" : "border-warning/50 bg-warning/10",
      )}
    >
      <h2 id="protection-title" className="flex items-center gap-2 font-semibold">
        {strong ? <ShieldCheck className="size-5 text-success" aria-hidden /> : <ShieldAlert className="size-5 text-warning" aria-hidden />}
        {strong ? t("security.protection.strong") : t("security.protection.basic")}
      </h2>
      <ul className="flex flex-col gap-1.5 text-sm">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            {item.done ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : <Circle className="size-4 text-muted-foreground" aria-hidden />}
            <span className="sr-only">{item.done ? t("security.protection.done") : t("security.protection.todo")} :</span>
            {item.href && !item.done ? (
              <a href={item.href} className="underline underline-offset-2">
                {item.label}
              </a>
            ) : (
              item.label
            )}
          </li>
        ))}
      </ul>
      <p className="text-[0.8125rem] text-muted-foreground">{strong ? t("security.protection.strong_hint") : t("security.protection.next")}</p>
    </section>
  );
}
