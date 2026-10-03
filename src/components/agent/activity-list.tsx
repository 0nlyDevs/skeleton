"use client";

import { ArrowUpRight, BusFront, Building2, Inbox, Megaphone, Radio, Settings, ShieldAlert, UserCog, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "@/components/ui/link";
import { useFormatters } from "@/hooks/use-formatters";
import type { MessageKey } from "@/lib/i18n";
import { cn, initials } from "@/lib/utils";
import type { ActivityEntryDto } from "@/modules/activity/activity.dto";
import { describeActivity } from "@/modules/activity/activity.describe";

const ICONS: Record<string, LucideIcon> = {
  requests: Inbox,
  announcements: Megaphone,
  services: Building2,
  transports: BusFront,
  accounts: UserCog,
  moderation: ShieldAlert,
  feed: Radio,
  settings: Settings,
};

function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * D21 — history entries as sentences ("who did what, on what"), grouped by
 * day, newest first. Each entry says when, by whom (and their role) and links
 * to the item when it still exists.
 */
export function ActivityList({ entries, groupByDay = true }: { readonly entries: readonly ActivityEntryDto[]; readonly groupByDay?: boolean }) {
  const t = useTranslation();
  const fmt = useFormatters();
  // Read the clock once per mount, not on every render.
  const [{ today, yesterday }] = useState(() => {
    const now = Date.now();
    return { today: dayKey(new Date(now).toISOString()), yesterday: dayKey(new Date(now - 86_400_000).toISOString()) };
  });

  const groups: { key: string; label: string; items: ActivityEntryDto[] }[] = [];
  for (const entry of entries) {
    const key = groupByDay ? dayKey(entry.createdAt) : "all";
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, label: key === today ? t("tn.history.today") : key === yesterday ? t("tn.history.yesterday") : fmt.date(entry.createdAt), items: [] };
      groups.push(group);
    }
    group.items.push(entry);
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.key} aria-label={groupByDay ? group.label : undefined} className="flex flex-col gap-2">
          {groupByDay ? <h3 className="px-1 text-[0.8125rem] font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h3> : null}
          <ol className="flex flex-col divide-y divide-border/70 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-panel">
            {group.items.map((entry) => {
              const { sentence, details } = describeActivity(entry, t, fmt.dateTime);
              const Icon = ICONS[entry.category] ?? Settings;
              return (
                <li key={entry.id} className="flex gap-3 px-4 py-3">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground" aria-hidden>
                    <Icon className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-[0.9062rem] leading-snug">{sentence}</p>
                    {details.length > 0 ? (
                      <ul className="flex flex-col gap-0.5 text-[0.8125rem] text-muted-foreground">
                        {details.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-muted-foreground">
                      {entry.actor ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Avatar className="size-4">
                            <AvatarFallback className="text-[0.5rem]">{initials(entry.actor.name)}</AvatarFallback>
                          </Avatar>
                          {entry.actor.name} · {t(`role.${entry.actor.role.toLowerCase()}` as MessageKey)}
                        </span>
                      ) : null}
                      <time dateTime={entry.createdAt} title={fmt.dateTime(entry.createdAt)}>
                        {fmt.dateTime(entry.createdAt)}
                      </time>
                      <span className={cn("rounded-full border border-border px-2 py-px")}>{t(`tn.history.category.${entry.category}` as MessageKey)}</span>
                    </p>
                  </div>
                  {entry.target?.href ? (
                    <Link
                      href={entry.target.href}
                      className="inline-flex shrink-0 items-center gap-1 self-start rounded-lg px-2 py-1 text-[0.8125rem] text-primary hover:bg-surface-muted"
                    >
                      {t("tn.history.open")}
                      <span className="sr-only">: {entry.target.label}</span>
                      <ArrowUpRight className="size-3.5" aria-hidden />
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
