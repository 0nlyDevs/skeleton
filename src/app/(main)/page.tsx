import { ArrowRight, Briefcase, Building2, FolderOpen, Megaphone, Send } from "lucide-react";
import type { Metadata } from "next";

import { AnnouncementCard } from "@/components/city/announcement-card";
import { ServiceIcon } from "@/components/city/service-icon";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { isStaff } from "@/lib/auth/guards";
import { getAuthContext } from "@/lib/auth/session";
import { getServerDictionary } from "@/lib/i18n/server";
import { listAnnouncements } from "@/modules/announcements/announcements.service";
import { cityRequestStats } from "@/modules/city-requests/city-requests.service";
import { listServices } from "@/modules/city-services/city-services.service";

export const metadata: Metadata = { title: { absolute: "Terra Nova — portail des habitants" } };

/**
 * D07 — the portal's front door. In order of importance: where you are and
 * what you can do (hero + two actions), the four main paths, the city's
 * services, then the latest announcements. Signed-in residents also see
 * their open requests; agents get the way to their own workspace.
 */
export default async function HomePage() {
  const context = await getAuthContext();
  const user = context?.user ?? null;
  const { t } = await getServerDictionary();
  const [services, news, stats] = await Promise.all([
    listServices({}, user),
    listAnnouncements({ page: 1, limit: 3 }, user),
    user ? cityRequestStats(user, "mine") : Promise.resolve(null),
  ]);
  const openRequests = stats ? (stats.NEW ?? 0) + (stats.IN_PROGRESS ?? 0) + (stats.WAITING_CITIZEN ?? 0) : 0;

  const paths = [
    { href: "/services", icon: Building2, title: t("tn.home.quick.services"), body: t("tn.home.quick.services_body") },
    { href: "/contact", icon: Send, title: t("tn.home.quick.contact"), body: t("tn.home.quick.contact_body") },
    { href: "/announcements", icon: Megaphone, title: t("tn.home.quick.news"), body: t("tn.home.quick.news_body") },
    { href: "/space", icon: FolderOpen, title: t("tn.home.quick.space"), body: t("tn.home.quick.space_body") },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-8">
      <section className="relative overflow-hidden rounded-3xl border border-primary/20 bg-card px-6 py-10 shadow-panel sm:px-10 sm:py-14" aria-labelledby="home-title">
        <div
          aria-hidden
          className="eco-hide pointer-events-none absolute -right-24 -top-24 size-[340px] rounded-full bg-[radial-gradient(circle_at_30%_30%,oklch(0.78_0.15_55),oklch(0.55_0.19_38)_55%,oklch(0.32_0.1_30))] opacity-90 shadow-[0_0_120px_40px_oklch(0.65_0.18_45/0.25)] sm:-right-10 sm:top-1/2 sm:size-[300px] sm:-translate-y-1/2"
        />
        <div className="relative flex max-w-[560px] flex-col gap-4">
          <span className="w-fit rounded-full border border-primary/30 bg-accent px-3 py-1 text-[12.5px] font-medium text-accent-foreground">
            {t("tn.home.badge")}
          </span>
          <h1 id="home-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {user ? t("tn.home.hello", { name: user.name.split(" ")[0] ?? user.name }) : t("tn.home.title")}
          </h1>
          <p className="text-[15.5px] leading-relaxed text-muted-foreground">{t("tn.home.subtitle")}</p>
          {user && openRequests > 0 ? (
            <Link href="/space" className="w-fit text-sm font-medium text-primary hover:underline">
              {t("tn.home.open_requests", { count: openRequests })}
            </Link>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {user ? (
              <>
                <Button asChild size="lg">
                  <Link href="/contact">
                    <Send aria-hidden />
                    {t("tn.home.cta_request")}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/space">{t("tn.home.cta_space")}</Link>
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="lg">
                  <Link href="/register">{t("tn.home.cta_join")}</Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/services">{t("tn.home.cta_services")}</Link>
                </Button>
              </>
            )}
          </div>
          {user && isStaff(user) ? (
            <Link href="/agent" className="flex w-fit items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[13px] hover:border-primary/40">
              <Briefcase className="size-4 text-primary" aria-hidden />
              {t("tn.home.agent_hint")}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="home-paths" className="flex flex-col gap-3">
        <h2 id="home-paths" className="px-1 text-lg font-semibold">{t("tn.home.quick_title")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {paths.map((path) => (
            <li key={path.href}>
              <Link href={path.href} className="flex h-full flex-col gap-2 rounded-2xl border border-border/70 bg-card p-4 shadow-panel transition-colors hover:border-primary/40">
                <path.icon className="size-5 text-primary" aria-hidden />
                <span className="font-semibold">{path.title}</span>
                <span className="text-[13.5px] leading-snug text-muted-foreground">{path.body}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <section aria-labelledby="home-services" className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 id="home-services" className="text-lg font-semibold">{t("tn.home.services_title")}</h2>
            <Link href="/services" className="text-[13px] text-primary hover:underline">{t("tn.see_all")}</Link>
          </div>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {services.slice(0, 8).map((service) => (
              <li key={service.id}>
                <Link href={`/services/${service.slug}`} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-3 hover:border-primary/40">
                  <ServiceIcon name={service.icon} className="size-9" />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold">{service.name}</span>
                    <span className="block truncate text-[12.5px] text-muted-foreground">{service.summary}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="home-news" className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 id="home-news" className="text-lg font-semibold">{t("tn.home.news_title")}</h2>
            <Link href="/announcements" className="text-[13px] text-primary hover:underline">{t("tn.see_all")}</Link>
          </div>
          {news.data.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t("tn.home.empty_news")}</p>
          ) : (
            news.data.map((announcement) => <AnnouncementCard key={announcement.id} announcement={announcement} compact />)
          )}
        </section>
      </div>
    </div>
  );
}
