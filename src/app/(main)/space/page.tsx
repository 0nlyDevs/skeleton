import { Bell, CheckCircle2, Clock, FileText, Hourglass, Pencil, Plus } from "lucide-react";
import type { Metadata } from "next";

import { AnnouncementCard } from "@/components/city/announcement-card";
import { RequestList } from "@/components/city/request-list";
import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import Link from "@/components/ui/link";
import { requirePageAuth } from "@/lib/auth/page-guards";
import { formatLongDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getServerDictionary } from "@/lib/i18n/server";
import { listAnnouncements } from "@/modules/announcements/announcements.service";
import { cityRequestStats, listCityRequests } from "@/modules/city-requests/city-requests.service";
import { getUnreadCount } from "@/modules/notifications/notifications.service";

export const metadata: Metadata = { title: "Mon espace" };

/** D03 — the resident's personal space: their details and every request they made. */
export default async function CitizenSpacePage() {
  const { user } = await requirePageAuth("/space");
  const { t, locale } = await getServerDictionary();
  const [requests, stats, unread, news] = await Promise.all([
    listCityRequests({ scope: "mine", page: 1, limit: 50 }, user),
    cityRequestStats(user, "mine"),
    getUnreadCount(user.id),
    listAnnouncements({ page: 1, limit: 3 }, user),
  ]);

  const counters = [
    { icon: Clock, label: t("tn.space.counts.open"), value: (stats.NEW ?? 0) + (stats.IN_PROGRESS ?? 0) },
    { icon: Hourglass, label: t("tn.space.counts.waiting"), value: stats.WAITING_CITIZEN ?? 0, highlight: (stats.WAITING_CITIZEN ?? 0) > 0 },
    { icon: CheckCircle2, label: t("tn.space.counts.done"), value: (stats.RESOLVED ?? 0) + (stats.CLOSED ?? 0) },
    { icon: Bell, label: t("tn.space.notifications"), value: unread, href: "/notifications" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t("tn.space.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("tn.space.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/contact">
            <Plus aria-hidden />
            {t("tn.space.new_request")}
          </Link>
        </Button>
      </header>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {counters.map((counter) => {
          const body = (
            <>
              <counter.icon className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-2xl font-semibold tabular-nums">{counter.value}</span>
              <span className="text-[0.7812rem] text-muted-foreground">{counter.label}</span>
            </>
          );
          const className = `flex h-full flex-col gap-1 rounded-2xl border bg-card p-4 shadow-panel ${counter.highlight ? "border-warning/60" : "border-border/70"}`;
          return (
            <li key={counter.label}>
              {counter.href ? <Link href={counter.href} className={`${className} hover:border-primary/40`}>{body}</Link> : <div className={className}>{body}</div>}
            </li>
          );
        })}
      </ul>

      <div className="grid gap-5 md:grid-cols-[1fr_300px]">
        <section className="flex flex-col gap-3" aria-labelledby="my-requests">
          <h2 id="my-requests" className="px-1 font-semibold">{t("tn.space.requests")}</h2>
          {requests.data.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={t("tn.space.empty_title")}
              description={t("tn.space.empty_body")}
              action={
                <Button asChild size="sm">
                  <Link href="/contact">{t("tn.space.new_request")}</Link>
                </Button>
              }
            />
          ) : (
            <RequestList requests={requests.data} hrefBase="/space/requests" />
          )}
        </section>

        <aside className="flex flex-col gap-5">
          <section className="rounded-2xl border border-border/70 bg-card p-4 shadow-panel" aria-labelledby="my-details">
            <h2 id="my-details" className="mb-3 font-semibold">{t("tn.space.profile")}</h2>
            <dl className="flex flex-col gap-2.5 text-sm">
              <div>
                <dt className="text-[0.75rem] text-muted-foreground">{t("tn.space.name")}</dt>
                <dd className="font-medium">{user.name}</dd>
              </div>
              <div>
                <dt className="text-[0.75rem] text-muted-foreground">{t("tn.space.email")}</dt>
                <dd className="break-all">{user.email}</dd>
              </div>
              <div>
                <dt className="text-[0.75rem] text-muted-foreground">{t("tn.space.role")}</dt>
                <dd>{t(`role.${user.role.toLowerCase()}` as MessageKey)}</dd>
              </div>
              <div>
                <dt className="text-[0.75rem] text-muted-foreground">{t("tn.space.since")}</dt>
                <dd>{formatLongDate(user.createdAt, locale)}</dd>
              </div>
            </dl>
            <Button asChild size="sm" variant="secondary" className="mt-4 w-full">
              <Link href="/settings/profile">
                <Pencil aria-hidden />
                {t("tn.space.edit_profile")}
              </Link>
            </Button>
          </section>

          {news.data.length > 0 ? (
            <section className="flex flex-col gap-2.5" aria-labelledby="to-read">
              <div className="flex items-center justify-between px-1">
                <h2 id="to-read" className="font-semibold">{t("tn.space.news")}</h2>
                <Link href="/announcements" className="text-[0.8125rem] text-primary hover:underline">{t("tn.see_all")}</Link>
              </div>
              {news.data.map((announcement) => (
                <AnnouncementCard key={announcement.id} announcement={announcement} compact />
              ))}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
