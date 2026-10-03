"use client";

import { MapPin, Search, Star } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ServiceIcon } from "@/components/city/service-icon";
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

  const filtered = useMemo(
    () =>
      services.filter((service) =>
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
    [query, services],
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
  const featured = query.trim() ? [] : filtered.filter((service) => service.featured);

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
                  <li key={service.id}>
                    <Link
                      href={`/services/${service.slug}`}
                      className="flex h-full gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-panel transition-colors hover:border-primary/40"
                    >
                      <ServiceIcon name={service.icon} />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-semibold leading-snug">{service.name}</span>
                        <span className="line-clamp-2 text-[0.8438rem] text-muted-foreground">{service.summary}</span>
                        {service.hours ? <span className="mt-1 text-[0.7812rem] text-muted-foreground">{service.hours}</span> : null}
                        {service.location ? (
                          <span className="mt-0.5 flex items-center gap-1 text-[0.7812rem] text-muted-foreground">
                            <MapPin className="size-3" aria-hidden />
                            {t(cityZoneLabelKey(service.location.zone))}
                          </span>
                        ) : null}
                      </span>
                    </Link>
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
