"use client";

import { BubbleMark, BubbleWordmark } from "@/components/layout/bubble-logo";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import type { CityZoneId } from "@/modules/alerts/city-zones";

import type { LandingData } from "./cinematic-landing";

/**
 * One stop of the flight: a tall section whose middle is where the camera
 * settles (`data-chapter` matches a stop of the camera rail, in order), and a
 * small card that says one thing about the portal. `place` is the landmark the
 * card points at in the scene.
 */
function Chapter({
  id,
  zone,
  side,
  place,
  title,
  body,
  children,
}: {
  readonly id: string;
  readonly zone: CityZoneId;
  readonly side: "left" | "right";
  readonly place: string;
  readonly title: string;
  readonly body?: string;
  readonly children?: ReactNode;
}) {
  const t = useTranslation();
  return (
    <section data-chapter={id} className="relative flex min-h-[150svh] items-center px-5 py-[16svh] sm:px-8 lg:pl-[230px] lg:pr-16">
      <div className={`mx-auto flex w-full max-w-[1240px] ${side === "right" ? "justify-end" : "justify-start"}`}>
        <div data-panel data-place={place} className="tn-card w-full max-w-[360px] p-6">
          <p className="tn-label text-white/55">{t(`alerts.zone.${zone}`)}</p>
          <h2 className="tn-display mt-2 text-[1.625rem] font-bold leading-[1.1]">{title}</h2>
          {body ? <p className="mt-3 text-[0.9062rem] leading-relaxed text-white/75">{body}</p> : null}
          {children ? <div className="mt-5">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}

function More({ href, children }: { readonly href: string; readonly children: string }) {
  return (
    <Link href={href} className="tn-link text-[0.875rem]">
      {children}
      <ArrowRight className="size-4" aria-hidden />
    </Link>
  );
}

/** Everything below the first view: one district, one idea, one way further. */
export function LandingSections({ data, onRegister }: { readonly data: LandingData; readonly onRegister: () => void }) {
  const t = useTranslation();
  const latest = data.news[0];
  const alerted = data.zones.filter((zone) => zone.status !== "SAFE").length;
  const stats = [
    { value: data.stats.services, label: t("tn.tour.stats.services") },
    { value: data.stats.news, label: t("tn.tour.stats.news") },
    { value: data.stats.requests, label: t("tn.tour.stats.requests") },
  ];

  return (
    <div className="relative z-[3] text-white">
      <Chapter id="skyport" zone="SKYPORT_ISLES" side="left" place={t("tn.tour.portal.place")} title={t("tn.tour.portal.title")} body={t("tn.tour.portal.body")}>
        <More href="/space">{t("tn.tour.portal.link")}</More>
      </Chapter>

      <Chapter id="nova" zone="NOVA_PRIME" side="right" place={t("tn.tour.services.place")} title={t("tn.tour.services.title", { count: data.stats.services })} body={t("tn.tour.services.body")}>
        <More href="/services">{t("tn.tour.services.link")}</More>
      </Chapter>

      <Chapter id="delta" zone="SUNKEN_DELTA" side="left" place={t("tn.tour.contact.place")} title={t("tn.tour.contact.title")} body={t("tn.tour.contact.body")}>
        <More href="/contact">{t("tn.tour.contact.link")}</More>
      </Chapter>

      {/* The latest announcement, by its title alone. */}
      <Chapter id="crystal" zone="CRYSTAL_REACH" side="right" place={t("tn.tour.news.place")} title={t("tn.tour.news.title")} body={latest ? latest.title : t("tn.tour.news.empty")}>
        <More href={latest ? `/announcements/${latest.slug}` : "/announcements"}>{t("tn.tour.news.link")}</More>
      </Chapter>

      {/* Live figures, counted up from the database. */}
      <Chapter id="verdant" zone="VERDANT_BASIN" side="left" place={t("tn.tour.stats.place")} title={t("tn.tour.stats.title")}>
        <dl className="grid grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <dd className="tn-display text-[2rem] font-extrabold leading-none tabular-nums" data-count={stat.value}>
                {stat.value}
              </dd>
              <dt className="text-[0.75rem] leading-snug text-white/60">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </Chapter>

      <Chapter id="frost" zone="FROSTPEAK" side="left" place={t("tn.tour.agents.place")} title={t("tn.tour.agents.title")} body={t("tn.tour.agents.body")}>
        {data.viewer?.staff ? <More href="/agent">{t("tn.nav.agent")}</More> : null}
      </Chapter>

      {/* The real state of the districts, in one sentence. */}
      <Chapter
        id="ember"
        zone="EMBER_WASTES"
        side="left"
        place={t("tn.tour.districts.place")}
        title={t("tn.tour.districts.title")}
        body={alerted === 0 ? t("tn.tour.districts.calm") : t("tn.tour.districts.alert", { count: alerted })}
      >
        <More href="/city-map">{t("tn.tour.districts.link")}</More>
      </Chapter>

      {/* Night over the whole island: the final call, then a plain footer. */}
      <section data-chapter="coast" className="relative flex min-h-[125svh] flex-col justify-end px-5 pb-8 pt-[30svh] text-center sm:px-8">
        <div aria-hidden className="tn-veil tn-veil--end" />
        <div className="relative">
          <h2 data-reveal="lines" className="tn-wordmark mx-auto max-w-[16ch] text-[clamp(2.2rem,6vw,5.2rem)] font-extrabold leading-[1]">
            <span className="tn-line">
              <span>{t("tn.landing.final.title")}</span>
            </span>
          </h2>
          <p data-reveal="slide-up" className="mx-auto mt-6 max-w-[48ch] text-[1rem] text-white/80">
            {t("tn.landing.final.body")}
          </p>
          <div data-reveal="slide-up" className="mt-9 flex flex-wrap justify-center gap-3">
            {data.viewer ? (
              <Link href="/contact" className="tn-btn tn-btn--solid px-7 py-3.5">
                {t("tn.home.cta_request")}
              </Link>
            ) : (
              <button type="button" onClick={onRegister} className="tn-btn tn-btn--solid px-7 py-3.5">
                {t("tn.home.cta_join")}
              </button>
            )}
            <Link href="/services" className="tn-btn tn-btn--line px-7 py-3.5">
              {t("tn.home.cta_services")}
            </Link>
          </div>
          <footer className="mx-auto mt-[16svh] flex max-w-[1240px] flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-white/15 pt-6 text-[0.8125rem] text-white/60">
            <span className="flex items-center gap-2"><BubbleMark className="h-7" /><BubbleWordmark className="h-4" /></span>
            <span>{t("tn.landing.footer")}</span>
            <span className="flex gap-5">
              <Link href="/privacy" className="tn-link font-normal">
                {t("footer.privacy")}
              </Link>
              <Link href="/terms" className="tn-link font-normal">
                {t("footer.terms")}
              </Link>
            </span>
          </footer>
        </div>
      </section>
    </div>
  );
}
