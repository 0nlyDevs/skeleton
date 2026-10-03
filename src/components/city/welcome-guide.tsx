"use client";

import { Building2, CheckCircle2, Send, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import type { MessageKey } from "@/lib/i18n";
import { WELCOME_HIDDEN_COOKIE, WELCOME_SERVICE_COOKIE, setWelcomeCookie } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export interface WelcomeSteps {
  readonly profile: boolean;
  readonly service: boolean;
  readonly request: boolean;
}

const STEPS = [
  { key: "profile", icon: UserRound, href: "/settings/profile" },
  { key: "service", icon: Building2, href: "/services" },
  { key: "request", icon: Send, href: "/contact" },
] as const;

/** D12 — a newcomer's first steps: complete the profile, find a service, start a request. */
export function WelcomeGuide({ name, steps }: { readonly name: string; readonly steps: WelcomeSteps }) {
  const t = useTranslation();
  const router = useRouter();
  const done = STEPS.filter((step) => steps[step.key]).length;

  const hide = () => {
    setWelcomeCookie(WELCOME_HIDDEN_COOKIE);
    router.refresh();
  };

  return (
    <section aria-labelledby="welcome-title" className="flex flex-col gap-4 rounded-2xl border border-primary/30 bg-gradient-to-br from-accent to-card p-5 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="welcome-title" className="text-lg font-semibold">{t("tn.welcome.title", { name })}</h2>
          <p className="text-sm text-muted-foreground">{t("tn.welcome.subtitle")}</p>
          <p className="text-[0.8125rem] font-medium">{t("tn.welcome.progress", { done, total: STEPS.length })}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={hide} aria-label={t("tn.welcome.hide")} title={t("tn.welcome.hide")}>
          <X aria-hidden />
        </Button>
      </div>
      <ol className="grid gap-3 md:grid-cols-3">
        {STEPS.map((step, index) => {
          const complete = steps[step.key];
          return (
            <li
              key={step.key}
              className={cn("flex flex-col gap-2 rounded-xl border bg-card p-4", complete ? "border-success/50" : "border-border/70")}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-7 place-items-center rounded-full text-[0.8125rem] font-semibold",
                    complete ? "bg-success text-success-foreground" : "bg-accent text-accent-foreground",
                  )}
                  aria-hidden
                >
                  {complete ? <CheckCircle2 className="size-4" /> : index + 1}
                </span>
                <h3 className="font-medium">{t(`tn.welcome.${step.key}.title` as MessageKey)}</h3>
                {complete ? <span className="sr-only">({t("tn.welcome.done")})</span> : null}
              </span>
              <p className="flex-1 text-[0.8125rem] text-muted-foreground">{t(`tn.welcome.${step.key}.body` as MessageKey)}</p>
              {complete ? (
                <p className="text-[0.8125rem] font-medium text-success">{t("tn.welcome.done")}</p>
              ) : (
                <Button asChild size="sm" variant={index === done ? "primary" : "secondary"} className="w-fit">
                  <Link href={step.href}>
                    <step.icon aria-hidden />
                    {t(`tn.welcome.${step.key}.cta` as MessageKey)}
                  </Link>
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Marks the "find a service" step once a resident opens a service page. */
export function MarkServiceSeen() {
  useEffect(() => {
    setWelcomeCookie(WELCOME_SERVICE_COOKIE);
  }, []);
  return null;
}
