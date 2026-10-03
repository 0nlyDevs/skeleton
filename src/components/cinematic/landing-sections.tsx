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
  SAFE: "bg-emerald-400 shadow-[0_0_10px_var(--color-emerald-400)]",
  WATCH: "bg-sky-300 shadow-[0_0_10px_var(--color-sky-300)]",
  WARNING: "bg-amber-400 shadow-[0_0_10px_var(--color-amber-400)]",
  DANGER: "bg-red-500 shadow-[0_0_10px_var(--color-red-500)]",
};

/**
 * One stop of the flight: a tall section whose middle is where the camera
 * settles (`data-chapter` matches a stop of the camera rail, in order), with
 * its pane of glass on one side so the district stays visible on the other.
 * `place` is the landmark the pane points at in the scene.
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
  readonly place: string;
  readonly children: ReactNode;
}) {
  return (
    <section data-chapter={id} className="relative flex min-h-[150svh] items-center px-4 py-[16svh] sm:px-6 lg:pl-[270px] lg:pr-12">
      <div className={`mx-auto flex w-full max-w-[1280px] ${side === "right" ? "justify-end" : "justify-start"}`}>
        <div data-panel data-place={place} className={`lg w-full p-6 sm:p-8 ${wide ? "max-w-[640px]" : "max-w-[520px]"}`}>
          {children}
        </div>
      </div>
    </section>
  );
}

function Kicker({ zone, children }: { readonly zone: CityZoneId; readonly children: string }) {
  const t = useTranslation();
  return (
    <p data-reveal="fade" className="tn-label mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-white/65">
      <span className="flex items-center gap-1.5 text-[var(--tn-accent)]">
        <MapPin className="size-3.5" aria-hidden />
        {t(`alerts.zone.${zone}`)}
      </span>
      <span aria-hidden className="h-px w-6 bg-white/35" />
      {children}
    </p>
  );
}

function Title({ children }: { readonly children: string }) {
  return (
    <h2 data-reveal="lines" className="tn-display text-[clamp(1.4rem,2.5vw,2.05rem)] font-medium leading-[1.14]">
      <span className="tn-line">
        <span>{children}</span>
      </span>
    </h2>
  );
}

function Body({ children }: { readonly children: string }) {
  return (
    <p data-reveal="slide-up" className="mt-4 text-[0.9375rem] leading-relaxed text-white/80">
      {children}
    </p>
  );
}

/** Everything below the first view, one district per section, in the order of the flight. */
export function LandingSections({ data, onRegister }: { readonly data: LandingData; readonly onRegister: () => void }) {
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
  const footer: readonly { title: string; links: readonly { href: string; label: string }[] }[] = [
    {
      title: t("tn.tour.footer.portal"),
      links: [
        { href: "/services", label: t("tn.nav.services") },
        { href: "/announcements", label: t("tn.nav.announcements") },
        { href: "/alerts", label: t("tn.nav.alerts") },
        { href: "/city-map", label: t("tn.nav.city_map") },
      ],
    },
    {
      title: t("tn.tour.footer.account"),
      links: [
        { href: "/space", label: t("tn.nav.my_space") },
        { href: "/contact", label: t("tn.nav.contact") },
        { href: "/feed", label: t("tn.nav.city_life") },
      ],
    },
    {
      title: t("tn.tour.footer.legal"),
      links: [
        { href: "/privacy", label: t("footer.privacy") },
        { href: "/terms", label: t("footer.terms") },
      ],
    },
  ];

  return (
    <div className="relative z-[3] text-white">
      {/* Skyport Isles — where you land: the things a resident comes for. */}
      <Chapter id="skyport" side="left" place={t("tn.tour.portal.place")}>
        <Kicker zone="SKYPORT_ISLES">{t("tn.landing.portal.kicker")}</Kicker>
        <Title>{t("tn.landing.portal.title")}</Title>
        <Body>{t("tn.landing.portal.body")}</Body>
        <ul data-reveal="stagger" className="mt-6 flex flex-col gap-2">
          {paths.map((path) => (
            <li key={path.href}>
              <Link href={path.href} className="lg-chip group flex items-center gap-3.5 px-3.5 py-2.5">
                <span className="lg-orb size-10">
                  <path.icon className="size-4" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[0.9062rem] font-medium">{path.title}</span>
                  <span className="text-[0.7812rem] leading-snug text-white/65">{path.body}</span>
                </span>
                <ArrowUpRight className="ml-auto size-4 shrink-0 text-white/40 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[var(--tn-accent)]" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Chapter>

      {/* Nova Prime — the capital: municipal services. */}
      <Chapter id="nova" side="right" wide place={t("tn.tour.services.place")}>
        <Kicker zone="NOVA_PRIME">{t("tn.landing.services.kicker")}</Kicker>
        <Title>{t("tn.tour.services.title")}</Title>
        <Body>{t("tn.tour.services.body")}</Body>
        <ul data-reveal="stagger" className="mt-6 grid gap-2 sm:grid-cols-2">
          {data.services.map((service) => (
            <li key={service.slug}>
              <Link href={`/services/${service.slug}`} className="lg-chip group flex h-full items-start gap-3 p-3.5">
                <ServiceIcon name={service.icon} className="lg-orb size-10" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2 text-[0.875rem] font-medium leading-snug">
                    {service.name}
                    {/* F28 — the most common procedures stand out. */}
                    {service.featured ? <span className="tn-label rounded-full bg-[var(--tn-accent)]/15 px-2 py-0.5 text-[var(--tn-accent)] ring-1 ring-[var(--tn-accent)]/40">{t("tn.services.featured_badge")}</span> : null}
                  </span>
                  <span className="line-clamp-2 text-[0.7812rem] leading-snug text-white/65">{service.summary}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/services" data-reveal="fade" className="lg-btn mt-6">
          {t("tn.landing.services.all")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Chapter>

      {/* Sunken Delta — the harbour: write to city hall, report a problem. */}
      <Chapter id="delta" side="left" place={t("tn.tour.contact.place")}>
        <Kicker zone="SUNKEN_DELTA">{t("tn.tour.contact.kicker")}</Kicker>
        <Title>{t("tn.tour.contact.title")}</Title>
        <Body>{t("tn.tour.contact.body")}</Body>
        <ol data-reveal="stagger" className="mt-6 flex flex-col gap-2">
          {(["tn.tour.contact.step1", "tn.tour.contact.step2", "tn.tour.contact.step3"] as const).map((key, index) => (
            <li key={key} className="lg-chip flex items-center gap-3.5 px-3.5 py-3 text-[0.9062rem]">
              <span className="lg-orb tn-figure size-9 text-[0.75rem]">{index + 1}</span>
              {t(key)}
            </li>
          ))}
        </ol>
        <div data-reveal="fade" className="mt-7 flex flex-wrap gap-3">
          <Link href="/contact" className="lg-btn lg-btn--amber">
            {t("tn.home.quick.contact")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/contact?type=issue" className="lg-btn">
            {t("tn.home.quick.report")}
          </Link>
        </div>
      </Chapter>

      {/* Crystal Reach — the observatory: announcements. */}
      <Chapter id="crystal" side="right" place={t("tn.tour.news.place")}>
        <Kicker zone="CRYSTAL_REACH">{t("tn.landing.news.kicker")}</Kicker>
        <Title>{t("tn.tour.news.title")}</Title>
        {data.news.length === 0 ? (
          <Body>{t("tn.landing.news.empty")}</Body>
        ) : (
          <ul data-reveal="stagger" className="mt-6 flex flex-col gap-2">
            {data.news.map((item) => (
              <li key={item.slug}>
                <Link href={`/announcements/${item.slug}`} className="lg-chip group flex flex-col gap-1.5 p-4">
                  <span className="flex items-center justify-between gap-3">
                    <span className={`tn-label w-fit rounded-full px-2.5 py-1 ${item.category === "ALERT" ? "bg-red-400/20 text-red-200 ring-1 ring-red-300/40" : "bg-[var(--tn-accent)]/15 text-[var(--tn-accent)] ring-1 ring-[var(--tn-accent)]/35"}`}>
                      {t(`tn.category.${item.category}` as MessageKey)}
                    </span>
                    {item.publishedAt ? (
                      <time dateTime={item.publishedAt} className="tn-figure text-[0.625rem] text-white/50">
                        {fmt.date(item.publishedAt)}
                      </time>
                    ) : null}
                  </span>
                  <span className="text-[0.9688rem] font-medium leading-snug">{item.title}</span>
                  <span className="line-clamp-2 text-[0.8125rem] text-white/65">{item.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/announcements" data-reveal="fade" className="lg-btn mt-6">
          {t("tn.landing.news.all")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Chapter>

      {/* Verdant Basin — the gardens: live figures, counted up from the database. */}
      <Chapter id="verdant" side="left" place={t("tn.tour.stats.place")}>
        <Kicker zone="VERDANT_BASIN">{t("tn.tour.stats.kicker")}</Kicker>
        <Title>{t("tn.tour.stats.title")}</Title>
        <Body>{t("tn.tour.stats.body")}</Body>
        <dl data-reveal="stagger" className="mt-6 grid grid-cols-3 gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="lg-chip flex flex-col gap-2 p-4">
              <dd className="tn-display text-[clamp(1.7rem,3.4vw,2.6rem)] font-semibold leading-none" data-count={stat.value}>
                {stat.value}
              </dd>
              <dt className="tn-label leading-snug text-white/60">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </Chapter>

      {/* Frostpeak — the station above the clouds: the agents' workspace. */}
      <Chapter id="frost" side="left" place={t("tn.tour.agents.place")}>
        <Kicker zone="FROSTPEAK">{t("tn.landing.agents.kicker")}</Kicker>
        <Title>{t("tn.landing.agents.title")}</Title>
        <Body>{t("tn.landing.agents.body")}</Body>
        <ul data-reveal="stagger" className="mt-6 flex flex-col gap-2">
          {[
            { icon: Workflow, key: "tn.landing.agents.point1" as MessageKey },
            { icon: Radio, key: "tn.landing.agents.point2" as MessageKey },
            { icon: ShieldCheck, key: "tn.landing.agents.point3" as MessageKey },
          ].map((point) => (
            <li key={point.key} className="lg-chip flex items-center gap-3.5 px-3.5 py-3 text-[0.9062rem]">
              <span className="lg-orb size-9">
                <point.icon className="size-4" aria-hidden />
              </span>
              {t(point.key)}
            </li>
          ))}
        </ul>
        {data.viewer?.staff ? (
          <Link href="/agent" data-reveal="fade" className="lg-btn lg-btn--amber mt-7">
            {t("tn.nav.agent")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        ) : null}
      </Chapter>

      {/* Ember Wastes — the forges at dusk: alerts and the state of every district. */}
      <Chapter id="ember" side="left" wide place={t("tn.tour.districts.place")}>
        <Kicker zone="EMBER_WASTES">{t("tn.tour.districts.kicker")}</Kicker>
        <Title>{t("tn.tour.districts.title")}</Title>
        <Body>{t("tn.tour.districts.body")}</Body>
        <ul data-reveal="stagger" className="mt-6 grid gap-2 sm:grid-cols-2">
          {data.zones.map((zone) => (
            <li key={zone.zone} className="lg-chip flex items-center gap-3 px-4 py-3">
              <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT[zone.status]}`} />
              <span className="flex min-w-0 flex-col">
                <span className="text-[0.875rem] font-medium">{t(`alerts.zone.${zone.zone}`)}</span>
                <span className="tn-figure text-[0.625rem] text-white/55">{t("tn.tour.districts.residents", { count: zone.residents })}</span>
              </span>
              <span className="tn-label ml-auto text-white/85">{t(`alerts.zone_status.${zone.status}`)}</span>
            </li>
          ))}
        </ul>
        <div data-reveal="fade" className="mt-7 flex flex-wrap gap-3">
          <Link href="/alerts" className="lg-btn lg-btn--amber">
            {t("tn.tour.districts.alerts")}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/city-map" className="lg-btn">
            {t("tn.tour.districts.map")}
          </Link>
        </div>
      </Chapter>

      {/* Obsidian Coast — night over the whole island: the final call, then the footer. */}
      <section data-chapter="coast" className="relative flex min-h-[135svh] flex-col justify-end px-4 pb-32 pt-[30svh] text-center sm:px-6">
        <div aria-hidden className="tn-veil tn-veil--end" />
        <div className="relative">
          <h2 data-reveal="lines" className="tn-wordmark mx-auto max-w-[16ch] text-[clamp(2rem,5.6vw,4.9rem)] font-medium leading-[1]">
            <span className="tn-line">
              <span>{t("tn.landing.final.title")}</span>
            </span>
          </h2>
          <p data-reveal="slide-up" className="mx-auto mt-6 max-w-[52ch] text-[1rem] font-normal text-white/80 [text-shadow:0_1px_14px_rgb(0_0_0/0.9)]">
            {t("tn.landing.final.body")}
          </p>
          <div data-reveal="slide-up" className="mt-9 flex flex-wrap justify-center gap-3">
            {data.viewer ? (
              <Link href="/contact" className="lg-btn lg-btn--amber px-8 py-4">
                {t("tn.home.cta_request")}
              </Link>
            ) : (
              <button type="button" onClick={onRegister} className="lg-btn lg-btn--amber px-8 py-4">
                {t("tn.registry.tab_register")}
              </button>
            )}
            <Link href="/services" className="lg-btn px-8 py-4">
              {t("tn.home.cta_services")}
            </Link>
          </div>

          <footer className="mx-auto mt-[14svh] w-full max-w-[1280px]">
            <p aria-hidden className="tn-outline select-none">
              TERRA NOVA
            </p>
            <div className="lg -mt-[3.2vw] grid gap-8 p-7 text-left sm:grid-cols-[1.5fr_1fr_1fr_1fr] sm:p-9">
              <div className="flex flex-col gap-3">
                <p className="tn-display text-[0.875rem] font-semibold tracking-[0.2em]">TERRA NOVA</p>
                <p className="max-w-[34ch] text-[0.8438rem] leading-relaxed text-white/70">{t("tn.landing.footer")}</p>
                <p className="tn-label mt-auto text-white/50">Sol 214 · Nova Prime</p>
              </div>
              {footer.map((column) => (
                <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2.5">
                  <p className="tn-label text-[var(--tn-accent)]">{column.title}</p>
                  {column.links.map((link) => (
                    <Link key={link.href} href={link.href} className="w-fit text-[0.875rem] text-white/75 underline-offset-4 hover:text-white hover:underline">
                      {link.label}
                    </Link>
                  ))}
                </nav>
              ))}
            </div>
          </footer>
        </div>
      </section>
    </div>
  );
}
