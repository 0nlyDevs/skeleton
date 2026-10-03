"use client";

import { ArrowRight, ArrowUpRight, Building2, FolderOpen, MapPin, Megaphone, Radio, Send, ShieldCheck, TriangleAlert, Workflow } from "lucide-react";
import type { ReactNode } from "react";

import { ServiceIcon } from "@/components/city/service-icon";
import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import { useFormatters } from "@/hooks/use-formatters";
import type { MessageKey } from "@/lib/i18n";
import type { CityZoneId, ZoneStatusId } from "@/modules/alerts/city-zones";

import type { LandingData } from "./cinematic-landing";

const STATUS_DOT: Readonly<Record<ZoneStatusId, string>> = {
  SAFE: "bg-emerald-400",
  WATCH: "bg-sky-300",
  WARNING: "bg-amber-400",
  DANGER: "bg-red-500",
};

/**
 * One stop of the flight: a tall section whose middle is where the camera
 * settles (`data-chapter` matches a stop of the camera rail, in order), with
 * its panel on one side so the district stays visible on the other.
 */
function Chapter({
  id,
  side,
  wide,
  place,
  children,
}: {
  readonly id: string;
  readonly side: "left" | "right";
  readonly wide?: boolean;
  /** The landmark the panel's line points at in the scene. */
  readonly place: string;
  readonly children: ReactNode;
}) {
  return (
    <section data-chapter={id} className="relative flex min-h-[150svh] items-center px-4 py-[16svh] sm:px-6 lg:pr-24">
      <div className={`mx-auto flex w-full max-w-[1320px] ${side === "right" ? "justify-end" : "justify-start"}`}>
        <div data-panel data-place={place} className={`tn-panel w-full p-6 sm:p-8 ${wide ? "max-w-[660px]" : "max-w-[540px]"}`}>
          {children}
        </div>
      </div>
    </section>
  );
}

function Kicker({ zone, children }: { readonly zone: CityZoneId; readonly children: string }) {
  const t = useTranslation();
  return (
    <p data-reveal="fade" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] font-medium uppercase tracking-[0.28em] text-white/60">
      <span className="flex items-center gap-1.5 text-[var(--brand-400)]">
        <MapPin className="size-3.5" aria-hidden />
        {t(`alerts.zone.${zone}`)}
      </span>
      <span aria-hidden className="h-px w-6 bg-white/30" />
      {children}
    </p>
  );
}

function Title({ children }: { readonly children: string }) {
  return (
    <h2 data-reveal="lines" className="text-[clamp(1.75rem,3.4vw,2.7rem)] font-semibold leading-[1.08] tracking-tight">
      <span className="tn-line">
        <span>{children}</span>
      </span>
    </h2>
  );
}

/** Everything below the first view, one district per section, in the order of the flight. */
export function LandingSections({ data }: { readonly data: LandingData }) {
  const t = useTranslation();
  const fmt = useFormatters();

  const paths = [
    { href: "/services", icon: Building2, title: t("tn.home.quick.services"), body: t("tn.home.quick.services_body") },
    { href: "/contact", icon: Send, title: t("tn.home.quick.contact"), body: t("tn.home.quick.contact_body") },
    // F25 — report a problem straight from the front door.
    { href: "/contact?type=issue", icon: TriangleAlert, title: t("tn.home.quick.report"), body: t("tn.home.quick.report_body") },
    { href: "/announcements", icon: Megaphone, title: t("tn.home.quick.news"), body: t("tn.home.quick.news_body") },
    { href: "/space", icon: FolderOpen, title: t("tn.home.quick.space"), body: t("tn.home.quick.space_body") },
  ];
  const stats = [
    { value: data.stats.services, label: t("tn.landing.stats.services") },
    { value: data.stats.news, label: t("tn.landing.stats.news") },
    { value: data.stats.requests, label: t("tn.landing.stats.requests") },
  ];

  return (
    <div className="relative z-[3] text-white">
      {/* Skyport Isles — where you land: the things a resident comes for. */}
      <Chapter id="skyport" side="left" place={t("tn.tour.portal.place")}>
        <Kicker zone="SKYPORT_ISLES">{t("tn.landing.portal.kicker")}</Kicker>
        <Title>{t("tn.landing.portal.title")}</Title>
        <p data-reveal="slide-up" className="mt-5 text-[0.9375rem] leading-relaxed text-white/70">
          {t("tn.landing.portal.body")}
        </p>
        <ul data-reveal="stagger" className="mt-6 flex flex-col gap-1.5">
          {paths.map((path) => (
            <li key={path.href}>
              <Link href={path.href} className="tn-card group flex items-center gap-3.5 px-3.5 py-2.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand-400)]/12 text-[var(--brand-400)] ring-1 ring-[var(--brand-400)]/35">
                  <path.icon className="size-4" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[0.9375rem] font-semibold">{path.title}</span>
                  <span className="text-[0.7812rem] leading-snug text-white/60">{path.body}</span>
                </span>
                <ArrowUpRight className="ml-auto size-4 shrink-0 text-white/35 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--brand-400)]" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Chapter>

      {/* Nova Prime — the capital: municipal services. */}
      <Chapter id="nova" side="right" wide place={t("tn.tour.services.place")}>
        <Kicker zone="NOVA_PRIME">{t("tn.landing.services.kicker")}</Kicker>
        <Title>{t("tn.tour.services.title")}</Title>
        <p data-reveal="slide-up" className="mt-5 text-[0.9375rem] leading-relaxed text-white/70">
          {t("tn.tour.services.body")}
        </p>
        <ul data-reveal="stagger" className="mt-7 grid gap-2 sm:grid-cols-2">
          {data.services.map((service) => (
            <li key={service.slug}>
              <Link href={`/services/${service.slug}`} className="tn-card group flex h-full items-start gap-3 p-3.5">
                <ServiceIcon name={service.icon} className="size-10 shrink-0 rounded-full bg-[var(--brand-400)]/12 text-[var(--brand-400)] ring-1 ring-[var(--brand-400)]/35" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-[0.9062rem] font-semibold leading-snug">
                    {service.name}
                    {/* F28 — the most common procedures stand out. */}
                    {service.featured ? (
                      <span className="rounded-full bg-[var(--brand-400)]/15 px-2 py-0.5 text-[0.625rem] font-semibold text-[var(--brand-400)] ring-1 ring-[var(--brand-400)]/40">
                        {t("tn.services.featured_badge")}
                      </span>
                    ) : null}
                  </span>
                  <span className="line-clamp-2 text-[0.7812rem] leading-snug text-white/60">{service.summary}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/services" data-reveal="fade" className="tn-cta-ghost mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.8438rem]">
          {t("tn.landing.services.all")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Chapter>

      {/* Sunken Delta — the harbour: write to city hall, report a problem. */}
      <Chapter id="delta" side="left" place={t("tn.tour.contact.place")}>
        <Kicker zone="SUNKEN_DELTA">{t("tn.tour.contact.kicker")}</Kicker>
        <Title>{t("tn.tour.contact.title")}</Title>
        <p data-reveal="slide-up" className="mt-5 text-[0.9375rem] leading-relaxed text-white/70">
          {t("tn.tour.contact.body")}
        </p>
        <ol data-reveal="stagger" className="mt-7 flex flex-col gap-3">
          {(["tn.tour.contact.step1", "tn.tour.contact.step2", "tn.tour.contact.step3"] as const).map((key, index) => (
            <li key={key} className="flex items-center gap-3.5 text-[0.9062rem]">
              <span className="grid size-8 shrink-0 place-items-center rounded-full font-mono text-[0.75rem] text-[var(--brand-400)] ring-1 ring-[var(--brand-400)]/45">
                {index + 1}
              </span>
              {t(key)}
            </li>
          ))}
        </ol>
        <div data-reveal="fade" className="mt-8 flex flex-wrap gap-3">
          <Link href="/contact" className="tn-cta-brand inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.875rem] font-semibold">
            {t("tn.home.quick.contact")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/contact?type=issue" className="tn-cta-ghost inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.875rem]">
            {t("tn.home.quick.report")}
          </Link>
        </div>
      </Chapter>

      {/* Crystal Reach — the observatory: announcements. */}
      <Chapter id="crystal" side="right" place={t("tn.tour.news.place")}>
        <Kicker zone="CRYSTAL_REACH">{t("tn.landing.news.kicker")}</Kicker>
        <Title>{t("tn.tour.news.title")}</Title>
        {data.news.length === 0 ? (
          <p data-reveal="slide-up" className="mt-6 text-[0.9375rem] text-white/65">
            {t("tn.landing.news.empty")}
          </p>
        ) : (
          <ul data-reveal="stagger" className="mt-7 flex flex-col gap-2">
            {data.news.map((item) => (
              <li key={item.slug}>
                <Link href={`/announcements/${item.slug}`} className="tn-card group flex flex-col gap-1.5 p-4">
                  <span className="flex items-center justify-between gap-3">
                    <span className={`w-fit rounded-full px-2.5 py-0.5 text-[0.625rem] uppercase tracking-[0.18em] ${item.category === "ALERT" ? "bg-red-400/15 text-red-300" : "bg-[var(--brand-400)]/12 text-[var(--brand-400)]"}`}>
                      {t(`tn.category.${item.category}` as MessageKey)}
                    </span>
                    {item.publishedAt ? (
                      <time dateTime={item.publishedAt} className="text-[0.7188rem] text-white/45">
                        {fmt.date(item.publishedAt)}
                      </time>
                    ) : null}
                  </span>
                  <span className="text-[1rem] font-semibold leading-snug">{item.title}</span>
                  <span className="line-clamp-2 text-[0.8125rem] text-white/60">{item.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/announcements" data-reveal="fade" className="tn-cta-ghost mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.8438rem]">
          {t("tn.landing.news.all")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Chapter>

      {/* Verdant Basin — the gardens: live figures, counted up from the database. */}
      <Chapter id="verdant" side="left" place={t("tn.tour.stats.place")}>
        <Kicker zone="VERDANT_BASIN">{t("tn.tour.stats.kicker")}</Kicker>
        <Title>{t("tn.tour.stats.title")}</Title>
        <p data-reveal="slide-up" className="mt-5 text-[0.9375rem] leading-relaxed text-white/70">
          {t("tn.tour.stats.body")}
        </p>
        <dl data-reveal="stagger" className="mt-7 grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <dd className="font-display text-[clamp(2rem,4vw,3rem)] font-bold leading-none" data-count={stat.value}>
                {stat.value}
              </dd>
              <dt className="text-[0.6875rem] uppercase leading-snug tracking-[0.14em] text-white/55">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </Chapter>

      {/* Frostpeak — the station above the clouds: the agents' workspace. */}
      <Chapter id="frost" side="left" place={t("tn.tour.agents.place")}>
        <Kicker zone="FROSTPEAK">{t("tn.landing.agents.kicker")}</Kicker>
        <Title>{t("tn.landing.agents.title")}</Title>
        <p data-reveal="slide-up" className="mt-5 text-[0.9375rem] leading-relaxed text-white/70">
          {t("tn.landing.agents.body")}
        </p>
        <ul data-reveal="stagger" className="mt-7 flex flex-col gap-3">
          {[
            { icon: Workflow, key: "tn.landing.agents.point1" as MessageKey },
            { icon: Radio, key: "tn.landing.agents.point2" as MessageKey },
            { icon: ShieldCheck, key: "tn.landing.agents.point3" as MessageKey },
          ].map((point) => (
            <li key={point.key} className="flex items-center gap-3 text-[0.9062rem]">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--brand-400)]/12 text-[var(--brand-400)] ring-1 ring-[var(--brand-400)]/35">
                <point.icon className="size-4" aria-hidden />
              </span>
              {t(point.key)}
            </li>
          ))}
        </ul>
        {data.viewer?.staff ? (
          <Link href="/agent" data-reveal="fade" className="tn-cta-brand mt-8 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.875rem] font-semibold">
            {t("tn.nav.agent")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </Chapter>

      {/* Ember Wastes — the forges at dusk: alerts and the state of every district. */}
      <Chapter id="ember" side="left" wide place={t("tn.tour.districts.place")}>
        <Kicker zone="EMBER_WASTES">{t("tn.tour.districts.kicker")}</Kicker>
        <Title>{t("tn.tour.districts.title")}</Title>
        <p data-reveal="slide-up" className="mt-5 text-[0.9375rem] leading-relaxed text-white/70">
          {t("tn.tour.districts.body")}
        </p>
        <ul data-reveal="stagger" className="mt-7 grid gap-2 sm:grid-cols-2">
          {data.zones.map((zone) => (
            <li key={zone.zone} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT[zone.status]}`} />
              <span className="flex min-w-0 flex-col">
                <span className="text-[0.9062rem] font-semibold">{t(`alerts.zone.${zone.zone}`)}</span>
                <span className="text-[0.75rem] text-white/55">{t("tn.tour.districts.residents", { count: zone.residents })}</span>
              </span>
              <span className="ml-auto text-[0.75rem] font-medium text-white/80">{t(`alerts.zone_status.${zone.status}`)}</span>
            </li>
          ))}
        </ul>
        <div data-reveal="fade" className="mt-7 flex flex-wrap gap-3">
          <Link href="/alerts" className="tn-cta-brand inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.875rem] font-semibold">
            {t("tn.tour.districts.alerts")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/city-map" className="tn-cta-ghost inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[0.875rem]">
            {t("tn.tour.districts.map")}
          </Link>
        </div>
      </Chapter>

      {/* Obsidian Coast — night over the whole island: the final call. */}
      <section data-chapter="coast" className="relative flex min-h-[125svh] flex-col justify-end px-4 pb-10 pt-[30svh] text-center sm:px-6">
        <div aria-hidden className="tn-hero-shade pointer-events-none absolute inset-x-0 bottom-0 h-[80svh]" />
        <div className="relative">
          <h2 data-reveal="lines" className="tn-hero-title font-display mx-auto max-w-[14ch] text-[clamp(2.6rem,7.4vw,6.4rem)] font-bold leading-[0.96]">
            <span className="tn-line">
              <span>{t("tn.landing.final.title")}</span>
            </span>
          </h2>
          <p data-reveal="slide-up" className="mx-auto mt-6 max-w-[52ch] text-[1rem] text-white/75 [text-shadow:0_1px_14px_rgb(0_0_0/0.9)]">
            {t("tn.landing.final.body")}
          </p>
          <div data-reveal="slide-up" className="mt-9 flex flex-wrap justify-center gap-3">
            {data.viewer ? (
              <Link href="/contact" className="tn-cta-brand rounded-full px-7 py-3.5 text-[0.9375rem] font-semibold">
                {t("tn.home.cta_request")}
              </Link>
            ) : (
              <Link href="/register" className="tn-cta-brand rounded-full px-7 py-3.5 text-[0.9375rem] font-semibold">
                {t("tn.home.cta_join")}
              </Link>
            )}
            <Link href="/services" className="tn-cta-ghost rounded-full px-7 py-3.5 text-[0.9375rem]">
              {t("tn.home.cta_services")}
            </Link>
          </div>
          <footer className="mx-auto mt-[12svh] flex max-w-[1240px] flex-wrap items-center justify-between gap-3 border-t border-white/15 pt-6 text-[0.7812rem] text-white/55">
            <span className="font-display text-[0.9375rem] text-white/80">TERRA NOVA</span>
            <span>{t("tn.landing.footer")}</span>
            <span className="flex gap-4">
              <Link href="/privacy" className="hover:text-white">
                {t("footer.privacy")}
              </Link>
              <Link href="/terms" className="hover:text-white">
                {t("footer.terms")}
              </Link>
            </span>
          </footer>
        </div>
      </section>
    </div>
  );
}
