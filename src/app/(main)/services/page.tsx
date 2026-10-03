import type { Metadata } from "next";

import { ContextTip } from "@/components/feedback/context-tip";
import { ServicesDirectory } from "@/components/city/services-directory";
import { getAuthContext } from "@/lib/auth/session";
import { getServerDictionary } from "@/lib/i18n/server";
import { listServices } from "@/modules/city-services/city-services.service";
import { listServicesQuerySchema } from "@/modules/city-services/city-services.schema";

export const metadata: Metadata = { title: "Services municipaux" };

/** D05 — the directory of city services, grouped by category, searchable. */
export default async function ServicesPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | undefined>> }) {
  const query = listServicesQuerySchema.safeParse(await searchParams).data ?? {};
  const [{ t, locale }, context] = await Promise.all([getServerDictionary(), getAuthContext()]);
  const services = await listServices({}, context?.user ?? null, locale);

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("tn.services.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tn.services.subtitle")}</p>
      </header>
      <ContextTip id="services">{t("tn.tip.services")}</ContextTip>

      <ServicesDirectory
        key={query.q ?? ""}
        services={services}
        initialQuery={query.q ?? ""}
        searchLabel={t("tn.services.search")}
        emptyTitle={t("tn.services.empty_title")}
        emptyBody={t("tn.services.empty_body")}
        contactLabel={t("tn.nav.contact")}
        featuredTitle={t("tn.services.featured_title")}
        allTitle={t("tn.services.all_title")}
      />
    </div>
  );
}
