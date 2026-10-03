import type { Metadata } from "next";

import { ContactForm } from "@/components/city/contact-form";
import { requirePageAuth } from "@/lib/auth/page-guards";
import { getServerDictionary } from "@/lib/i18n/server";
import { listServices } from "@/modules/city-services/city-services.service";

export const metadata: Metadata = { title: "Contacter la mairie" };

/** D04 — write to the city services; the confirmation follows on the request page. */
export default async function ContactPage({ searchParams }: { readonly searchParams: Promise<{ service?: string; type?: string }> }) {
  const { service, type } = await searchParams;
  const back = new URLSearchParams({ ...(service ? { service } : {}), ...(type === "issue" ? { type } : {}) }).toString();
  const { user } = await requirePageAuth(back ? `/contact?${back}` : "/contact");
  const { t, locale } = await getServerDictionary();
  const services = await listServices({}, user, locale);
  const initial = services.find((item) => item.slug === service)?.id ?? "";

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-5">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("tn.contact.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tn.contact.subtitle")}</p>
      </header>
      <ContactForm services={services.filter((item) => item.active).map(({ id, name }) => ({ id, name }))} initialServiceId={initial} initialKind={type === "issue" ? "issue" : "question"} />
    </div>
  );
}
