"use client";

import { ArrowRight, ArrowUpRight, Building2, FolderOpen, Megaphone, Radio, Send, ShieldCheck, Workflow } from "lucide-react";

import { ServiceIcon } from "@/components/city/service-icon";
import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import { useFormatters } from "@/hooks/use-formatters";
import type { MessageKey } from "@/lib/i18n";

import type { LandingData } from "./cinematic-landing";

function Kicker({ children }: { readonly children: string }) {
  return (
    <p data-reveal className="mb-4 flex items-center gap-3 text-[11.5px] font-medium uppercase tracking-[0.32em] text-cyan-300/90">
      <span className="h-px w-8 bg-cyan-300/60" />
      {children}
    </p>
  );
}

/** Everything below the hero, in the order a new resident needs it. */
export function LandingSections({ data }: { readonly data: LandingData }) {
  const t = useTranslation();
  const fmt = useFormatters();

  const paths = [
    { href: "/services", icon: Building2, title: t("tn.home.quick.services"), body: t("tn.home.quick.services_body") },
    { href: "/contact", icon: Send, title: t("tn.home.quick.contact"), body: t("tn.home.quick.contact_body") },
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
      {/* Portal: the four things a resident comes for. */}
      <section data-scene="portal" className="relative px-4 py-[18vh] sm:px-6">
        <div className="mx-auto max-w-[1240px]">
          <div className="tn-glass max-w-[640px] p-7 sm:p-10">
            <Kicker>{t("tn.landing.portal.kicker")}</Kicker>
            <h2 data-reveal className="text-[clamp(2rem,4.4vw,3.4rem)] font-semibold leading-[1.05] tracking-tight">
              {t("tn.landing.portal.title")}
            </h2>
            <p data-reveal className="mt-5 max-w-[52ch] text-[15.5px] leading-relaxed text-white/65">
              {t("tn.landing.portal.body")}
            </p>
            <ul data-reveal-stagger className="mt-8 grid gap-3 sm:grid-cols-2">
              {paths.map((path) => (
                <li key={path.href}>
                  <Link href={path.href} className="tn-card group flex h-full flex-col gap-2 p-4">
                    <span className="flex items-center justify-between">
                      <span className="grid size-9 place-items-center rounded-full bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/30">
                        <path.icon className="size-4" aria-hidden />
                      </span>
                      <ArrowUpRight className="size-4 text-white/30 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300" aria-hidden />
                    </span>
                    <span className="font-semibold">{path.title}</span>
                    <span className="text-[13px] leading-snug text-white/55">{path.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Live figures, counted up from the database. */}
      <section className="px-4 py-[8vh] sm:px-6">
        <dl className="mx-auto grid max-w-[1240px] gap-4 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} data-reveal className="tn-glass flex flex-col gap-1 p-6">
              <dd className="font-display text-[clamp(3rem,6vw,4.6rem)] font-bold leading-none text-white" data-count={stat.value}>
                {stat.value}
              </dd>
              <dt className="text-[13px] uppercase tracking-[0.2em] text-white/50">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </section>

      {/* Services. */}
      <section data-scene="services" className="relative px-4 py-[16vh] sm:px-6">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex flex-wrap items-end justify-between gap-4 md:pl-[34%]">
            <div>
              <Kicker>{t("tn.landing.services.kicker")}</Kicker>
              <h2 data-reveal className="text-[clamp(2rem,4.4vw,3.4rem)] font-semibold leading-[1.05] tracking-tight">
                {t("tn.home.services_title")}
              </h2>
            </div>
            <Link href="/services" data-reveal className="tn-cta-ghost inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px]">
              {t("tn.landing.services.all")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul data-reveal-stagger className="mt-10 grid gap-3 sm:grid-cols-2 md:ml-[34%] lg:grid-cols-3">
            {data.services.map((service) => (
              <li key={service.slug}>
                <Link href={`/services/${service.slug}`} className="tn-card group flex h-full flex-col gap-3 p-5">
                  <ServiceIcon name={service.icon} className="size-11 rounded-full bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/30" />
                  <span className="text-[11px] uppercase tracking-[0.22em] text-white/40">{service.category}</span>
                  <span className="text-[16px] font-semibold leading-snug">{service.name}</span>
                  <span className="line-clamp-2 text-[13px] text-white/55">{service.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Agents. */}
      <section data-scene="agents" className="relative px-4 py-[16vh] sm:px-6">
        <div className="mx-auto flex max-w-[1240px] justify-end">
          <div className="tn-glass max-w-[560px] p-7 sm:p-10">
            <Kicker>{t("tn.landing.agents.kicker")}</Kicker>
            <h2 data-reveal className="text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.08] tracking-tight">
              {t("tn.landing.agents.title")}
            </h2>
            <p data-reveal className="mt-5 text-[15px] leading-relaxed text-white/65">
              {t("tn.landing.agents.body")}
            </p>
            <ul data-reveal-stagger className="mt-7 flex flex-col gap-3">
              {[
                { icon: Workflow, key: "tn.landing.agents.point1" as MessageKey },
                { icon: Radio, key: "tn.landing.agents.point2" as MessageKey },
                { icon: ShieldCheck, key: "tn.landing.agents.point3" as MessageKey },
              ].map((point) => (
                <li key={point.key} className="flex items-center gap-3 text-[14.5px]">
                  <span className="grid size-8 place-items-center rounded-full bg-orange-400/10 text-orange-300 ring-1 ring-orange-300/30">
                    <point.icon className="size-4" aria-hidden />
                  </span>
                  {t(point.key)}
                </li>
              ))}
            </ul>
            {data.viewer?.staff ? (
              <Link href="/agent" data-reveal className="tn-cta-primary mt-8 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-semibold">
                {t("tn.nav.agent")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {/* Announcements. */}
      <section data-scene="news" className="px-4 py-[14vh] sm:px-6">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Kicker>{t("tn.landing.news.kicker")}</Kicker>
              <h2 data-reveal className="text-[clamp(2rem,4.4vw,3.4rem)] font-semibold leading-[1.05] tracking-tight">
                {t("tn.home.news_title")}
              </h2>
            </div>
            <Link href="/announcements" data-reveal className="tn-cta-ghost inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13.5px]">
              {t("tn.landing.news.all")}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          {data.news.length === 0 ? (
            <p data-reveal className="tn-glass mt-10 p-8 text-center text-white/60">{t("tn.landing.news.empty")}</p>
          ) : (
            <ul data-reveal-stagger className="mt-10 grid gap-4 md:grid-cols-3">
              {data.news.map((item) => (
                <li key={item.slug}>
                  <Link href={`/announcements/${item.slug}`} className="tn-card group flex h-full flex-col gap-3 p-6">
                    <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] ${item.category === "ALERT" ? "bg-red-400/15 text-red-300" : "bg-cyan-400/10 text-cyan-300"}`}>
                      {t(`tn.category.${item.category}` as MessageKey)}
                    </span>
                    <span className="text-[18px] font-semibold leading-snug">{item.title}</span>
                    <span className="line-clamp-3 text-[13.5px] text-white/55">{item.summary}</span>
                    {item.publishedAt ? <time dateTime={item.publishedAt} className="mt-auto text-[12px] text-white/40">{fmt.date(item.publishedAt)}</time> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Final call. */}
      <section data-scene="final" className="relative px-4 pb-10 pt-[20vh] text-center sm:px-6">
        <h2 data-reveal className="font-display mx-auto max-w-[14ch] text-[clamp(2.8rem,8vw,7rem)] font-bold leading-[0.95]">
          {t("tn.landing.final.title")}
        </h2>
        <p data-reveal className="mx-auto mt-6 max-w-[52ch] text-[16px] text-white/65">{t("tn.landing.final.body")}</p>
        <div data-reveal className="mt-10 flex flex-wrap justify-center gap-3">
          {data.viewer ? (
            <Link href="/contact" className="tn-cta-primary rounded-full px-7 py-3.5 text-[15px] font-semibold">
              {t("tn.home.cta_request")}
            </Link>
          ) : (
            <Link href="/register" className="tn-cta-primary rounded-full px-7 py-3.5 text-[15px] font-semibold">
              {t("tn.home.cta_join")}
            </Link>
          )}
          <Link href="/services" className="tn-cta-ghost rounded-full px-7 py-3.5 text-[15px]">
            {t("tn.home.cta_services")}
          </Link>
        </div>
        <footer className="mx-auto mt-[16vh] flex max-w-[1240px] flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-[12.5px] text-white/40">
          <span className="font-display text-[15px] text-white/70">TERRA NOVA</span>
          <span>{t("tn.landing.footer")}</span>
          <span className="flex gap-4">
            <Link href="/privacy" className="hover:text-white">{t("footer.privacy")}</Link>
            <Link href="/terms" className="hover:text-white">{t("footer.terms")}</Link>
          </span>
        </footer>
      </section>
    </div>
  );
}
