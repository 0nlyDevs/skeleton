import { Search, Star } from "lucide-react";
import type { Metadata } from "next";

import { EmptyState } from "@/components/feedback/empty-state";
import { ServiceIcon } from "@/components/city/service-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "@/components/ui/link";
import { getAuthContext } from "@/lib/auth/session";
import { getServerDictionary } from "@/lib/i18n/server";
import { listServices } from "@/modules/city-services/city-services.service";
import { listServicesQuerySchema } from "@/modules/city-services/city-services.schema";

export const metadata: Metadata = { title: "Services municipaux" };

/** D05 — the directory of city services, grouped by category, searchable. */
export default async function ServicesPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | undefined>> }) {
  const query = listServicesQuerySchema.safeParse(await searchParams).data ?? {};
  const { t, locale } = await getServerDictionary();
  const context = await getAuthContext();
  const services = await listServices({ q: query.q }, context?.user ?? null, locale);

  // F28 — the most common procedures first, so nobody has to browse it all.
  const featured = query.q ? [] : services.filter((service) => service.featured);
  const groups = new Map<string, typeof services>();
  for (const service of services) groups.set(service.category, [...(groups.get(service.category) ?? []), service]);

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("tn.services.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tn.services.subtitle")}</p>
      </header>

      <form role="search" className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input name="q" defaultValue={query.q ?? ""} placeholder={t("tn.services.search")} aria-label={t("tn.services.search")} className="h-11 pl-9" maxLength={80} />
      </form>

      {services.length === 0 ? (
        <EmptyState
          icon={Search}
          title={t("tn.services.empty_title")}
          description={t("tn.services.empty_body")}
          action={
            <Button asChild size="sm">
              <Link href="/contact">{t("tn.nav.contact")}</Link>
            </Button>
          }
        />
      ) : (
        <>
          {featured.length > 0 ? (
            <section aria-labelledby="featured-services" className="flex flex-col gap-2.5 rounded-2xl border border-primary/25 bg-accent/60 p-4">
              <h2 id="featured-services" className="flex items-center gap-2 font-semibold">
                <Star className="size-4 text-primary" aria-hidden />
                {t("tn.services.featured_title")}
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
          {featured.length > 0 ? <h2 className="px-1 pt-1 text-lg font-semibold">{t("tn.services.all_title")}</h2> : null}
          {[...groups.entries()].map(([category, items]) => (
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
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          ))}
        </>
      )}
    </div>
  );
}
