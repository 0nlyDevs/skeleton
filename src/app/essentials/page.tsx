import { Phone } from "lucide-react";
import type { Metadata } from "next";

import { BubbleMark } from "@/components/layout/bubble-logo";
import Link from "@/components/ui/link";
import { formatDateTime } from "@/lib/format";
import { getServerDictionary } from "@/lib/i18n/server";
import { listCityAlerts } from "@/modules/alerts/alerts.service";
import { listServices } from "@/modules/city-services/city-services.service";
import { getCurrentOfficialMessage } from "@/modules/official-messages/official-messages.service";

export const metadata: Metadata = { title: "L'essentiel" };

/**
 * F93/F94 — what a resident needs when something goes wrong: the official
 * message, the active alerts with their instructions, the emergency numbers
 * and the contact of every service. One light page, no script of its own, no
 * account needed. The service worker keeps a copy, so it opens even when the
 * network or the platform is down.
 */
export default async function EssentialsPage() {
  const { t, locale } = await getServerDictionary();
  const [official, alerts, services] = await Promise.all([
    getCurrentOfficialMessage().catch(() => null),
    listCityAlerts({ limit: 10 }).catch(() => ({ data: [], total: 0 })),
    listServices({}, null, locale).catch(() => []),
  ]);
  const active = alerts.data.filter((alert) => alert.alert.status === "ACTIVE");
  const emergency = services.filter((service) => service.emergency && service.phone);
  const others = services.filter((service) => !service.emergency && (service.phone || service.hours || service.address));

  return (
    <main id="content" className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <Link href="/" className="inline-flex w-fit items-center gap-2" aria-label="Bubble">
          <BubbleMark className="h-9" />
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{t("tn.essentials.title")}</h1>
        <p className="text-[0.9375rem] text-muted-foreground">{t("tn.essentials.subtitle")}</p>
        <p className="text-[0.8125rem] text-muted-foreground">{t("tn.essentials.updated", { date: formatDateTime(new Date().toISOString(), locale) })}</p>
      </header>

      {official ? (
        <section aria-labelledby="ess-official" className="rounded-2xl border-2 border-foreground/70 bg-card p-5">
          <h2 id="ess-official" className="text-lg font-semibold">{official.title}</h2>
          <p className="mt-1 text-[0.9375rem]">{official.body}</p>
          {official.action ? <p className="mt-2 rounded-xl bg-surface-muted px-3 py-2 text-[0.9375rem]"><span className="font-semibold">{t("tn.official.todo")} </span>{official.action}</p> : null}
        </section>
      ) : null}

      <section aria-labelledby="ess-alerts" className="flex flex-col gap-3">
        <h2 id="ess-alerts" className="text-lg font-semibold">{t("tn.essentials.alerts")}</h2>
        {active.length === 0 ? (
          <p className="rounded-2xl bg-card p-4 text-[0.9375rem]">{t("tn.essentials.no_alert")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {active.map((alert) => (
              <li key={alert.slug} className="rounded-2xl border-2 border-warning/60 bg-card p-4">
                <p className="font-semibold">{alert.title}</p>
                <p className="mt-1 text-[0.9375rem]">{alert.summary}</p>
                <p className="mt-2 whitespace-pre-line text-[0.875rem] text-muted-foreground">{alert.body.slice(0, 600)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ess-emergency" className="flex flex-col gap-3">
        <h2 id="ess-emergency" className="text-lg font-semibold">{t("tn.essentials.emergency")}</h2>
        <ul className="flex flex-col gap-2">
          {emergency.map((service) => (
            <li key={service.slug} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4">
              <span className="min-w-0">
                <span className="block font-semibold">{service.name}</span>
                <span className="block text-[0.8125rem] text-muted-foreground">{[service.address, service.hours].filter(Boolean).join(" · ")}</span>
              </span>
              <a href={`tel:${(service.phone ?? "").replace(/\s+/g, "")}`} className="inline-flex items-center gap-2 rounded-full bg-error px-4 py-2 text-sm font-semibold text-error-foreground">
                <Phone className="size-4" aria-hidden />
                {service.phone}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ess-services" className="flex flex-col gap-3">
        <h2 id="ess-services" className="text-lg font-semibold">{t("tn.essentials.services")}</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {others.map((service) => (
            <li key={service.slug} className="rounded-2xl bg-card p-4">
              <p className="font-semibold">{service.name}</p>
              {service.phone ? <p className="text-[0.875rem]"><a href={`tel:${service.phone.replace(/\s+/g, "")}`} className="underline underline-offset-2">{service.phone}</a></p> : null}
              {service.hours ? <p className="text-[0.8125rem] text-muted-foreground">{service.hours}</p> : null}
              {service.address ? <p className="text-[0.8125rem] text-muted-foreground">{service.address}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm">
        <Link href="/" className="font-medium text-primary">{t("tn.essentials.back")}</Link>
      </p>
    </main>
  );
}
