import type { Metadata } from "next";

import { StartGuide } from "@/components/city/start-guide";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { getAuthContext } from "@/lib/auth/session";
import { getServerDictionary } from "@/lib/i18n/server";
import { listServices } from "@/modules/city-services/city-services.service";

export const metadata: Metadata = { title: "Par où commencer ?" };

/**
 * F72 — a newcomer's starting point: a few situations to tick, and the
 * services that matter for them first, with the next step for each. Public:
 * it helps before an account exists too.
 */
export default async function StartPage() {
  const [{ t, locale }, context] = await Promise.all([getServerDictionary(), getAuthContext()]);
  const user = context?.user ?? null;
  const services = await listServices({}, user, locale);

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5">
      <Breadcrumbs label={t("tn.breadcrumb.label")} items={[{ label: t("tn.nav.home"), href: "/" }, { label: t("tn.start.title") }]} />
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("tn.start.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tn.start.subtitle")}</p>
      </header>
      <StartGuide
        signedIn={user !== null}
        services={services.map(({ slug, name, summary, icon, availability }) => ({
          slug,
          name,
          summary,
          icon,
          // A planned interruption still works today.
          available: availability.state === "AVAILABLE" || availability.state === "PLANNED",
        }))}
      />
    </div>
  );
}
