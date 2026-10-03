"use client";

import { ArrowRight, Baby, Bus, Check, HeartPulse, Home, Luggage, Send, ShoppingBasket } from "lucide-react";
import { useMemo, useSyncExternalStore, type ComponentType } from "react";

import { ServiceIcon } from "@/components/city/service-icon";
import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface StartService {
  readonly slug: string;
  readonly name: string;
  readonly summary: string;
  readonly icon: string;
  readonly available: boolean;
}

/** Each situation points to the services that matter first, most useful first. */
const SITUATIONS: readonly { id: string; icon: ComponentType<{ className?: string }>; services: readonly string[] }[] = [
  { id: "arrived", icon: Luggage, services: ["etat-civil", "securite", "transports"] },
  { id: "children", icon: Baby, services: ["education", "sante"] },
  { id: "housing", icon: Home, services: ["logement", "energie", "eau-oxygene"] },
  { id: "health", icon: HeartPulse, services: ["sante"] },
  { id: "moving", icon: Bus, services: ["transports"] },
  { id: "food", icon: ShoppingBasket, services: ["serres-alimentation", "proprete-recyclage"] },
];

const STORAGE_KEY = "tn-start-situations";
const listeners = new Set<() => void>();
let fallback = "[]";

function read(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return fallback;
  }
}

function write(ids: readonly string[]): void {
  fallback = JSON.stringify(ids);
  try {
    window.localStorage.setItem(STORAGE_KEY, fallback);
  } catch {
    // Storage blocked: the choice still holds until the page is left.
  }
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function parse(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/**
 * F72 — "where do I start?": a newcomer ticks what applies to them and gets
 * the services that matter in their situation, with the next step for each,
 * without filling in a form or creating anything. The choice is remembered in
 * this browser so they can come back to it.
 */
export function StartGuide({ services, signedIn }: { readonly services: readonly StartService[]; readonly signedIn: boolean }) {
  const t = useTranslation();
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const selected = useMemo(() => parse(raw), [raw]);

  const toggle = (id: string) => write(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);

  const recommended = useMemo(() => {
    const order: string[] = [];
    for (const situation of SITUATIONS) {
      if (!selected.includes(situation.id)) continue;
      for (const slug of situation.services) if (!order.includes(slug)) order.push(slug);
    }
    return order.map((slug) => services.find((service) => service.slug === slug)).filter((service): service is StartService => Boolean(service));
  }, [selected, services]);

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 font-semibold">{t("tn.start.question")}</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SITUATIONS.map((situation) => {
            const on = selected.includes(situation.id);
            return (
              <button
                key={situation.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(situation.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                  on ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card hover:bg-surface-muted",
                )}
              >
                <situation.icon className="size-5 shrink-0" aria-hidden />
                <span className="flex-1">{t(`tn.start.situation.${situation.id}` as MessageKey)}</span>
                {on ? <Check className="size-4 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
        </div>
      </fieldset>

      <section aria-labelledby="start-results" className="flex flex-col gap-3" aria-live="polite">
        <h2 id="start-results" className="font-semibold">
          {recommended.length > 0 ? t("tn.start.results", { count: recommended.length }) : t("tn.start.results_empty")}
        </h2>
        {recommended.length > 0 ? (
          <ol className="flex flex-col gap-3">
            {recommended.map((service, index) => (
              <li key={service.slug} className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-panel sm:flex-row sm:items-center">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[0.8125rem] font-semibold text-primary-foreground" aria-hidden>
                  {index + 1}
                </span>
                <ServiceIcon name={service.icon} className="size-10" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-semibold">{service.name}</span>
                  <span className="text-[0.8438rem] text-muted-foreground">{service.summary}</span>
                  {!service.available ? <span className="text-[0.8125rem] font-medium text-warning">{t("tn.start.unavailable")}</span> : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link href={`/services/${service.slug}`} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-surface-muted">
                    {t("tn.start.see")}
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                  <Link
                    href={signedIn ? `/contact?service=${encodeURIComponent(service.slug)}` : "/register"}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[0.8125rem] font-medium text-primary-foreground hover:bg-primary-hover"
                  >
                    <Send className="size-3.5" aria-hidden />
                    {t("tn.start.ask")}
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </section>

      <section aria-labelledby="start-next" className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-surface-muted/40 p-4">
        <h2 id="start-next" className="font-semibold">{t("tn.start.next_title")}</h2>
        <ul className="flex flex-col gap-1.5 text-sm">
          {signedIn ? (
            <>
              <li>
                <Link href="/settings/security" className="underline underline-offset-2">{t("tn.start.next.passkey")}</Link>
              </li>
              <li>
                <Link href="/space" className="underline underline-offset-2">{t("tn.start.next.space")}</Link>
              </li>
            </>
          ) : (
            <li>
              <Link href="/register" className="underline underline-offset-2">{t("tn.start.next.register")}</Link>
            </li>
          )}
          <li>
            <Link href="/alerts" className="underline underline-offset-2">{t("tn.start.next.alerts")}</Link>
          </li>
          <li>
            <Link href="/glossary" className="underline underline-offset-2">{t("tn.start.next.glossary")}</Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
