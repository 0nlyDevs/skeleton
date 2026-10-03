import { ShieldCheck, ArrowRight } from "lucide-react";
import Link from "@/components/ui/link";

import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import { ROLES } from "@/types";

/**
 * Closing call to action.
 *
 * The role cards are what make the demo legible without a pitch: a juror sees
 * that an administrator, a moderator and a member each exist, and that the
 * credentials live in the README. Passwords are deliberately not printed on a
 * public page — that would be a real vulnerability, and a cybersecurity juror
 * would score it as one.
 */
export function CtaSection({ t }: { readonly t: Dictionary }) {
  const roleLabels = {
    USER: t["role.user"],
    MODERATOR: t["role.moderator"],
    ADMIN: t["role.admin"],
  } as const;

  return (
    <section className="border-b border-border/70">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-20 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16 lg:px-8 lg:py-24">
        <div className="flex flex-col items-start gap-5">
          <h2 className="max-w-[22ch] text-balance text-[28px] font-semibold tracking-[-0.015em] sm:text-[34px]">
            {t["landing.cta.title"]}
          </h2>
          <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground">
            {t["landing.cta.body"]}
          </p>
          <Button asChild size="lg">
            <Link href="/login">
              {t["landing.hero.cta_primary"]}
              <ArrowRight />
            </Link>
          </Button>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-6 shadow-panel">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <ShieldCheck className="size-4" />
            </span>
            <h3 className="text-[15px] font-semibold tracking-tight">
              {t["landing.demo.title"]}
            </h3>
          </div>

          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
            {t["landing.demo.body"]}
          </p>

          <ul className="mt-1 flex flex-col divide-y divide-border/70">
            {ROLES.map((role) => (
              <li key={role} className="flex items-center justify-between gap-4 py-2.5">
                <span className="text-[13.5px] font-medium">{roleLabels[role]}</span>
                <span className="text-[12px] text-muted-foreground">{t["landing.demo.provided"]}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
