"use client";

import { Map as MapIcon, MapPin, Phone, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ServiceIcon } from "@/components/city/service-icon";
import { OpenStateLine } from "@/components/city/opening-hours";
import { ServiceAvailabilityBadge } from "@/components/city/service-availability-notice";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "@/components/ui/link";
import { useTranslation } from "@/components/providers/i18n-provider";
import { cityZoneLabelKey } from "@/modules/alerts/city-zones";
import { matchesSearch } from "@/lib/search";
import type { ServiceDto } from "@/modules/city-services/city-services.service";

/** Filters the public service directory as the resident types. */
export function ServicesDirectory({
  services,
  initialQuery,
  searchLabel,
  emptyTitle,
  emptyBody,
  contactLabel,
  featuredTitle,
  allTitle,
}: {
  readonly services: readonly ServiceDto[];
  readonly initialQuery: string;
  readonly searchLabel: string;
  readonly emptyTitle: string;
  readonly emptyBody: string;
  readonly contactLabel: string;
  readonly featuredTitle: string;
  readonly allTitle: string;
}) {
  const t = useTranslation();
  const [query, setQuery] = useState(initialQuery);
  // F74 — "what is open now" and "partner associations" are one tap away.
  const [view, setView] = useState<"all" | "open" | "partners">("all");

  const filtered = useMemo(
    () =>
      services.filter((service) =>
        (view === "all" || (view === "open" ? service.openState?.open === true : service.partner)) &&
        matchesSearch(
          [
            service.name,
            service.category,
            service.summary,
            service.description,
            service.howTo,
            service.hours,
            service.address,
            service.email,
            service.phone,
          ],
          query,
        ),
      ),
    [query, services, view],
  );

  const groups = useMemo(() => {
    const byCategory = new Map<string, ServiceDto[]>();
    for (const service of filtered) {
      const items = byCategory.get(service.category) ?? [];
      items.push(service);
      byCategory.set(service.category, items);
    }
    return [...byCategory.entries()];
  }, [filtered]);
  const featured = query.trim() || view !== "all" ? [] : filtered.filter((service) => service.featured);
  const views = [
    { id: "all", label: t("tn.hours.filter.all") },
    { id: "open", label: t("tn.hours.filter.open") },
    { id: "partners", label: t("tn.hours.filter.partners") },
  ] as const;

  return (
    <>
      <form action="/services" method="get" role="search" className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchLabel}
          aria-label={searchLabel}
          className="h-11 pl-9"
          maxLength={80}
        />
      </form>

      <div role="group" aria-label={t("tn.hours.filter.label")} className="flex flex-wrap gap-1.5">
        {views.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={view === item.id}
            onClick={() => setView(item.id)}
            className={
              view === item.id
                ? "rounded-full bg-foreground px-3 py-1.5 text-[0.8125rem] font-medium text-background"
                : "rounded-full border border-border bg-surface px-3 py-1.5 text-[0.8125rem] font-medium hover:bg-surface-muted"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={emptyTitle}
          description={emptyBody}
          action={
            <Button asChild size="sm">
              <Link href="/contact">{contactLabel}</Link>
            </Button>
          }
        />
      ) : (
        <>
          {featured.length > 0 ? (
            <section aria-labelledby="featured-services" className="flex flex-col gap-2.5 rounded-2xl border border-primary/25 bg-accent/60 p-4">
              <h2 id="featured-services" className="flex items-center gap-2 font-semibold">
                <Star className="size-4 text-primary" aria-hidden />
                {featuredTitle}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-3">
                {featured.map((service) => (
                  <li key={service.id}>
                    <Link
                      href={`/services/${service.slug}`}
                      className="flex h-full flex-col gap-2 rounded-xl border border-border/70 bg-card p-3.5 shadow-panel transition-colors hover:border-primary/40"
                    >
                      <ServiceIcon name={service.icon} className="size-9" />
                      <span className="font-semibold leading-snug">{service.name}</span>
                      <ServiceAvailabilityBadge availability={service.availability} />
                      <span className="line-clamp-2 text-[0.8125rem] text-muted-foreground">{service.summary}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {featured.length > 0 ? <h2 className="px-1 pt-1 text-lg font-semibold">{allTitle}</h2> : null}
          {groups.map(([category, items]) => (
            <section key={category} className="flex flex-col gap-2.5" aria-labelledby={`cat-${category}`}>
              <h2 id={`cat-${category}`} className="px-1 text-[0.8125rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {items.map((service) => (
                  <li key={service.id} className="relative flex h-full gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-panel transition-colors hover:border-primary/40">
                    <ServiceIcon name={service.icon} />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 font-semibold leading-snug">
                        {/* The whole card opens the service; the map and phone links sit above it. */}
                        <Link href={`/services/${service.slug}`} className="after:absolute after:inset-0 after:rounded-2xl">
                          {service.name}
                        </Link>
                        <ServiceAvailabilityBadge availability={service.availability} />
                        {service.partner ? <Badge variant="outline">{t("tn.hours.partner")}</Badge> : null}
                      </span>
                      <span className="line-clamp-2 text-[0.8438rem] text-muted-foreground">{service.summary}</span>
                      {service.openState ? (
                        <OpenStateLine state={service.openState} t={t} className="mt-1" />
                      ) : service.hours ? (
                        <span className="mt-1 text-[0.7812rem] text-muted-foreground">{service.hours}</span>
                      ) : null}
                      {service.location ? (
                        <span className="mt-0.5 flex items-start gap-1 text-[0.7812rem] text-muted-foreground">
                          <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden />
                          <span>
                            {t(cityZoneLabelKey(service.location.zone))}
                            {service.address ? ` · ${service.address}` : ""}
                          </span>
                        </span>
                      ) : null}
                      {service.partner || service.openState ? (
                        <span className="relative z-10 mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem] font-medium">
                          {service.location ? (
                            <Link href={`/city-map?service=${encodeURIComponent(service.slug)}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                              <MapIcon className="size-3.5" aria-hidden />
                              {t("tn.hours.show_on_map")}
                              <span className="sr-only"> : {service.name}</span>
                            </Link>
                          ) : null}
                          {service.phone ? (
                            <a href={`tel:${service.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                              <Phone className="size-3.5" aria-hidden />
                              {service.phone}
                            </a>
                          ) : null}
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  );
}
