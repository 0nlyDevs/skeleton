"use client";

import { ArrowRight, CalendarDays, Globe2, Megaphone, MessageCircle, Siren } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import { apiFetch } from "@/lib/api/client";
import { formatRelative } from "@/lib/format";
import { useI18n } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

import { UserAvatar } from "./user-avatar";

interface AlertItem { readonly slug: string; readonly title: string; readonly alert: { readonly severity: "INFORMATION" | "WARNING" | "CRITICAL" } }
interface RoomItem { readonly id: string; readonly name: string; readonly image: string | null; readonly unreadCount?: number; readonly lastMessage?: { readonly content?: string | null } | null; readonly targetUser?: { readonly id: string; readonly name: string; readonly image: string | null } | null }
interface NewsItem { readonly slug: string; readonly title: string; readonly publishedAt: string | null }

function Block({ title, icon, href, more, children }: { readonly title: string; readonly icon: ReactNode; readonly href: string; readonly more: string; readonly children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-card p-4 shadow-panel">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[0.9375rem] font-semibold">
          {icon}
          {title}
        </p>
        <Link href={href} aria-label={`${more} : ${title}`} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-surface-muted hover:text-foreground">
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      {children}
    </section>
  );
}

const DOT = { CRITICAL: "bg-error", WARNING: "bg-warning", INFORMATION: "bg-info" } as const;

/**
 * The right column of the city's home: what is happening now (alerts), who
 * wrote to me (messages), what the city just announced, and the map. Each
 * block is a short list with one way in; it never repeats the menu.
 */
export function RightRail({ signedIn }: { readonly signedIn: boolean }) {
  const t = useTranslation();
  const { locale } = useI18n();
  const [alerts, setAlerts] = useState<readonly AlertItem[] | null>(null);
  const [rooms, setRooms] = useState<readonly RoomItem[] | null>(null);
  const [news, setNews] = useState<readonly NewsItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = <T,>(url: string, set: (value: readonly T[]) => void) =>
      apiFetch<{ data: T[] }>(url)
        .then((response) => alive && set(response.data))
        .catch(() => alive && set([]));
    void load<AlertItem>("/api/alerts?limit=4", setAlerts);
    void load<NewsItem>("/api/announcements?limit=4", setNews);
    if (signedIn) void load<RoomItem>("/api/messages/rooms", setRooms);
    return () => {
      alive = false;
    };
  }, [signedIn]);

  return (
    <div className="flex flex-col gap-4">
      <Link href="/city-map" className="rail-map group relative flex min-h-32 flex-col justify-end gap-1 overflow-hidden rounded-2xl p-4 text-white shadow-panel">
        <span aria-hidden className="rail-map-globe" />
        <span className="relative flex items-center gap-2 text-[0.9375rem] font-semibold">
          <Globe2 className="size-4" aria-hidden />
          {t("tn.space.map_hero.title")}
        </span>
        <span className="relative text-[0.8125rem] text-white/80">{t("tn.rail.map_body")}</span>
      </Link>

      <Block title={t("tn.rail.alerts")} icon={<Siren className="size-4 text-error" aria-hidden />} href="/alerts" more={t("tn.rail.see_all")}>
        {alerts === null ? (
          <p className="text-[0.8125rem] text-muted-foreground">…</p>
        ) : alerts.length === 0 ? (
          <p className="text-[0.8125rem] text-muted-foreground">{t("tn.rail.no_alert")}</p>
        ) : (
          <ul className="flex flex-col">
            {alerts.slice(0, 4).map((item) => (
              <li key={item.slug}>
                <Link href={`/alerts/${encodeURIComponent(item.slug)}`} className="flex items-start gap-2.5 rounded-xl px-2 py-2 text-[0.875rem] hover:bg-surface-muted">
                  <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", DOT[item.alert.severity])} />
                  <span className="min-w-0">
                    <span className="line-clamp-2 font-medium leading-snug">{item.title}</span>
                    <span className="text-[0.75rem] text-muted-foreground">{t(`alerts.severity.${item.alert.severity}`)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Block>

      {signedIn ? (
        <Block title={t("nav.messages")} icon={<MessageCircle className="size-4 text-primary" aria-hidden />} href="/messages" more={t("tn.rail.see_all")}>
          {rooms === null ? (
            <p className="text-[0.8125rem] text-muted-foreground">…</p>
          ) : rooms.length === 0 ? (
            <p className="text-[0.8125rem] text-muted-foreground">{t("tn.rail.no_message")}</p>
          ) : (
            <ul className="flex flex-col">
              {rooms.slice(0, 5).map((room) => {
                const name = room.targetUser?.name ?? room.name;
                return (
                  <li key={room.id}>
                    <Link href={`/messages?room=${encodeURIComponent(room.id)}`} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-surface-muted">
                      <UserAvatar userId={room.targetUser?.id} name={name} image={room.targetUser?.image ?? room.image} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.875rem] font-medium">{name}</span>
                        {room.lastMessage?.content ? <span className="block truncate text-[0.75rem] text-muted-foreground">{room.lastMessage.content}</span> : null}
                      </span>
                      {room.unreadCount ? (
                        <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[0.6875rem] font-bold leading-5 text-primary-foreground">
                          <span aria-hidden>{room.unreadCount > 9 ? "9+" : room.unreadCount}</span>
                          <span className="sr-only">{t("tn.rail.unread", { count: room.unreadCount })}</span>
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Block>
      ) : null}

      <Block title={t("tn.rail.news")} icon={<Megaphone className="size-4 text-primary" aria-hidden />} href="/announcements" more={t("tn.rail.see_all")}>
        {news === null ? (
          <p className="text-[0.8125rem] text-muted-foreground">…</p>
        ) : news.length === 0 ? (
          <p className="text-[0.8125rem] text-muted-foreground">{t("tn.rail.no_news")}</p>
        ) : (
          <ul className="flex flex-col">
            {news.slice(0, 4).map((item) => (
              <li key={item.slug}>
                <Link href={`/announcements/${encodeURIComponent(item.slug)}`} className="flex items-start gap-2.5 rounded-xl px-2 py-2 hover:bg-surface-muted">
                  <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0">
                    <span className="line-clamp-2 text-[0.875rem] font-medium leading-snug">{item.title}</span>
                    {item.publishedAt ? <span className="text-[0.75rem] text-muted-foreground">{formatRelative(item.publishedAt, locale)}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  );
}
