import {
  Building2,
  KeyRound,
  Languages,
  Radio,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { RevealSection } from "./reveal-section";
import type { Dictionary, MessageKey } from "@/lib/i18n";

interface Feature {
  readonly icon: LucideIcon;
  readonly titleKey: MessageKey;
  readonly bodyKey: MessageKey;
}

const FEATURES: readonly Feature[] = [
  {
    icon: KeyRound,
    titleKey: "landing.features.auth.title",
    bodyKey: "landing.features.auth.body",
  },
  {
    icon: ShieldCheck,
    titleKey: "landing.features.security.title",
    bodyKey: "landing.features.security.body",
  },
  {
    icon: Radio,
    titleKey: "landing.features.realtime.title",
    bodyKey: "landing.features.realtime.body",
  },
  {
    icon: Workflow,
    titleKey: "landing.features.architecture.title",
    bodyKey: "landing.features.architecture.body",
  },
  {
    icon: Building2,
    titleKey: "landing.features.admin.title",
    bodyKey: "landing.features.admin.body",
  },
  {
    icon: Languages,
    titleKey: "landing.features.i18n.title",
    bodyKey: "landing.features.i18n.body",
  },
];

/**
 * Feature grid.
 *
 * A hairline-separated grid rather than six floating cards: the shared rules read
 * as one system, which is the claim the section is making. Each cell is a
 * heading, one line of explanation and nothing else — no icon-only filler.
 */
export function FeatureGrid({ t }: { readonly t: Dictionary }) {
  return (
    <section id="features" className="scroll-mt-20 border-b border-border/70">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 lg:px-8 lg:py-24">
        <header className="flex max-w-2xl flex-col gap-3">
          <h2 className="text-[28px] font-semibold tracking-[-0.015em] sm:text-[34px]">
            {t["landing.features.title"]}
          </h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground">
            {t["landing.features.hint"]}
          </p>
        </header>

        <RevealSection
          className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 sm:grid-cols-2 lg:grid-cols-3"
          stagger={0.05}
        >
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.titleKey} className="flex flex-col gap-3 bg-card p-6">
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                  <Icon className="size-[18px]" />
                </span>
                <h3 className="text-[15px] font-semibold tracking-tight">
                  {t[feature.titleKey]}
                </h3>
                <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                  {t[feature.bodyKey]}
                </p>
              </article>
            );
          })}
        </RevealSection>
      </div>
    </section>
  );
}
