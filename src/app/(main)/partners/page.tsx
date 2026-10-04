import type { Metadata } from "next";
import { ArrowRight, Handshake, MapPin, Phone } from "lucide-react";

import { OpenStateLine } from "@/components/city/opening-hours";
import { PartnerProposalForm } from "@/components/city/partner-proposal-form";
import Link from "@/components/ui/link";
import { getAuthContext } from "@/lib/auth/session";
import { getServerDictionary } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { listServices, type ServiceDto } from "@/modules/city-services/city-services.service";
import { isStopped } from "@/modules/city-services/service-availability";

export const metadata: Metadata = { title: "Services des partenaires" };

type State = "open" | "closed" | "stopped";

function stateOf(service: ServiceDto): State {
  if (isStopped(service.availability)) return "stopped";
  return service.openState && !service.openState.open ? "closed" : "open";
}

/**
 * F99 — what outside partners offer residents, sorted by what can be used
 * right now. Each card says its state in words and gives one next step.
 * Partners propose a new service at the bottom of the page.
 */
export default async function PartnersPage() {
  const [{ t, locale }, context] = await Promise.all([getServerDictionary(), getAuthContext()]);
  const partners = (await listServices({}, context?.user ?? null, locale)).filter((service) => service.partner && service.active);
  const order: readonly State[] = ["open", "closed", "stopped"];
  const sorted = [...partners].sort((a, b) => order.indexOf(stateOf(a)) - order.indexOf(stateOf(b)));
  const usable = partners.filter((service) => stateOf(service) === "open").length;

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-6">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("tn.partners.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tn.partners.subtitle")}</p>
      </header>

      {partners.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">{t("tn.partners.empty")}</p>
      ) : (
        <section aria-labelledby="partners-list" className="flex flex-col gap-3">
          <h2 id="partners-list" className="px-1 text-lg font-semibold">{t("tn.partners.available_count", { open: usable, total: partners.length })}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {sorted.map((service) => {
              const state = stateOf(service);
              const alternative = service.availability.alternative;
              const action =
                state === "stopped" && alternative
                  ? { href: `/services/${alternative.slug}`, label: t("tn.partners.next.alternative", { name: alternative.name }) }
                  : state === "open"
                    ? { href: `/services/${service.slug}`, label: t("tn.partners.next.go") }
                    : state === "closed"
                      ? { href: "/contact", label: t("tn.partners.next.write") }
                      : { href: `/services/${service.slug}`, label: t("tn.partners.next.details") };
              return (
                <li key={service.id} className={cn("flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-panel", state === "stopped" && "opacity-90")}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">{service.name}</h3>
                    <span
                      className={cn(
                        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-semibold",
                        state === "open" ? "bg-success/15 text-success" : state === "closed" ? "bg-surface-muted" : "bg-error/10 text-error",
                      )}
                    >
                      <span aria-hidden className="state-bubble" data-fill={state === "open" ? "full" : state === "closed" ? "half" : "closed"} />
                      {t(`tn.partners.state.${state}`)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{service.summary}</p>
                  {state === "stopped" ? (
                    <p className="text-sm font-medium">{service.availability.note ?? t("tn.partners.stopped_note")}</p>
                  ) : service.openState ? (
                    <OpenStateLine state={service.openState} t={t} />
                  ) : service.hours ? (
                    <p className="text-[0.8125rem] text-muted-foreground">{service.hours}</p>
                  ) : null}
                  {service.address ? (
                    <p className="flex items-start gap-2 text-[0.8125rem] text-muted-foreground">
                      <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                      {service.address}
                    </p>
                  ) : null}
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
                    <Link href={action.href} className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90">
                      {action.label}
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                    {service.phone && state !== "stopped" ? (
                      <a href={`tel:${service.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-4 py-2 text-sm font-medium hover:bg-accent">
                        <Phone className="size-4" aria-hidden />
                        {service.phone}
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="partners-propose" className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-panel">
        <div className="flex items-start gap-3">
          <Handshake className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <h2 id="partners-propose" className="text-lg font-semibold">{t("tn.partners.propose.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("tn.partners.propose.body")}</p>
          </div>
        </div>
        <PartnerProposalForm />
      </section>
    </div>
  );
}
