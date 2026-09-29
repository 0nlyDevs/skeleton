import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import { HeroObject } from "./hero-object";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";

/**
 * Landing hero.
 *
 * Left-aligned copy, right-side asset — the 3D structure. The capability list is
 * compressed into a check-row under the CTAs so the headline and the object share
 * the first viewport instead of competing for it.
 *
 * The headline uses the two-tone trick: a muted first phrase and a strong second
 * one, both bold — one idea, two weights.
 */
export function Hero({ t }: { readonly t: Dictionary }) {
  const capabilities = [
    t["landing.features.auth.title"],
    t["landing.features.security.title"],
    t["landing.features.realtime.title"],
    t["landing.features.admin.title"],
  ];

  return (
    <section className="relative overflow-hidden border-b border-border/70">
      {/* Decoration only: one soft wash plus a faint grid, no image to download. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_18%_-10%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,color-mix(in_oklch,var(--border)_55%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_oklch,var(--border)_55%,transparent)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]"
      />

      <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-4 py-20 lg:grid-cols-[1.25fr_1fr] lg:items-center lg:gap-8 lg:px-8 lg:py-28">
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-surface/70 px-3 py-1 text-[12px] font-medium text-muted-foreground backdrop-blur">
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
            {t["landing.hero.badge"]}
          </span>

          <h1 className="max-w-[16ch] text-balance text-[40px] font-semibold leading-[1.04] tracking-[-0.025em] sm:text-[52px] lg:text-[60px]">
            <span className="text-muted-foreground/70">{t["landing.hero.title_prefix"]}</span>{" "}
            {t["landing.hero.title_strong"]}
          </h1>

          <p className="max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-base">
            {t["landing.hero.subtitle"]}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">
                {t["landing.hero.cta_primary"]}
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/#features">{t["landing.hero.cta_secondary"]}</Link>
            </Button>
          </div>

          <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {capabilities.map((capability) => (
              <li key={capability} className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-success/12 text-success"
                >
                  <Check className="size-3" strokeWidth={3} />
                </span>
                <span className="text-[13.5px] font-medium tracking-tight">{capability}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex justify-center lg:justify-end">
          <HeroObject />
        </div>
      </div>
    </section>
  );
}
