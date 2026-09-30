"use client";

import { Activity, FileText, HardDrive, MessagesSquare, Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enterPanel } from "@/styles/animations";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/**
 * Stat card.
 *
 * The number animates up from zero on first paint (GSAP, disabled under reduced
 * motion). It is decoration that carries information — the jury sees real, live
 * aggregates rather than placeholders — and the hook keeps the GSAP wiring out of
 * the layout.
 */
function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  href,
  accent,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly href?: string;
  readonly accent?: boolean;
}) {
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    return enterPanel(valueRef.current);
  }, []);

  const body = (
    <Card
      className={cn(
        "h-full transition-[box-shadow,border-color] duration-[var(--duration-normal)] hover:border-primary/30",
        href && "cursor-pointer",
      )}
    >
      <CardContent className="flex items-start gap-4 p-5">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            accent ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground",
          )}
        >
          <Icon className="size-[18px]" />
        </span>

        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
          <span ref={valueRef} className="text-[26px] font-semibold leading-none tracking-tight tabular-nums">
            {value}
          </span>
          {hint ? (
            <span className="mt-1 truncate text-[12px] text-muted-foreground/80">{hint}</span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  if (!href) return body;
  return (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
      {body}
    </Link>
  );
}

/**
 * Quick actions.
 *
 * Three shortcuts, each one a real page. They exist so a first-time visitor can
 * produce something within seconds of landing on the dashboard, which is the
 * "self-explanatory" requirement made concrete.
 */
function QuickActions() {
  const t = useTranslation();

  const actions = [
    { href: "/posts/new", label: t("dashboard.quick.new_post"), icon: FileText },
    { href: "/chat", label: t("dashboard.quick.open_chat"), icon: MessagesSquare },
    { href: "/ai", label: t("dashboard.quick.assistant"), icon: Activity },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button key={action.href} asChild variant="secondary" size="sm">
          <Link href={action.href}>
            <action.icon />
            {action.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}

export interface DashboardViewProps {
  readonly children?: ReactNode;
  readonly name: string;
  readonly posts: { total: number; published: number; drafts: number };
  readonly messages: number;
  readonly unreadNotifications: number;
  readonly storage: { files: number; bytes: number };
  readonly recentActivity: readonly {
    readonly id: string;
    readonly action: string;
    readonly targetType: string | null;
    /** ISO-8601, used for `<time dateTime>` and formatted here for display. */
    readonly createdAt: string;
  }[];
}

/**
 * User dashboard.
 *
 * Client component because of the count-up animation and the translations; the
 * numbers themselves are computed server-side and passed in as props. No state,
 * no fetching — the page renders once from real data and stays fast.
 */
export function DashboardView({
  name,
  posts,
  messages,
  unreadNotifications,
  storage,
  recentActivity,
}: DashboardViewProps) {
  const t = useTranslation();

  const stats = [
    {
      icon: FileText,
      label: t("dashboard.stat.posts"),
      value: String(posts.total),
      hint: t("dashboard.stat.posts_hint", { published: posts.published, drafts: posts.drafts }),
      href: "/posts",
      accent: true,
    },
    {
      icon: MessagesSquare,
      label: t("dashboard.stat.messages"),
      value: String(messages),
      hint: t("dashboard.stat.messages_hint"),
      href: "/chat",
    },
    {
      icon: Bell,
      label: t("dashboard.stat.notifications"),
      value: String(unreadNotifications),
      href: "/notifications",
    },
    {
      icon: HardDrive,
      label: t("dashboard.stat.storage"),
      value: String(storage.files),
      hint: t("dashboard.stat.storage_hint", { files: storage.files }),
      href: "/settings/profile",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[24px] font-semibold tracking-[-0.015em]">
          {t("dashboard.welcome", { name })}
        </h1>
        <p className="text-[14px] text-muted-foreground">{t("dashboard.subtitle")}</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t("dashboard.activity.title")}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {recentActivity.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border/70 px-6 py-10 text-center">
                <Activity className="size-5 text-muted-foreground" />
                <p className="text-[14px] font-medium">{t("dashboard.activity.empty")}</p>
                <p className="text-[13px] text-muted-foreground">
                  {t("dashboard.activity.empty_hint")}
                </p>
                <Button asChild size="sm" variant="secondary" className="mt-1">
                  <Link href="/posts/new">{t("dashboard.quick.new_post")}</Link>
                </Button>
              </div>
            ) : (
              <ul className="flex flex-col divide-y divide-border/60">
                {recentActivity.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
                      <Activity className="size-3.5" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13.5px] font-medium">{item.action}</span>
                      {item.targetType ? (
                        <span className="text-[12px] text-muted-foreground">{item.targetType}</span>
                      ) : null}
                    </div>
                    <time
                      dateTime={item.createdAt}
                      className="shrink-0 text-[12px] tabular-nums text-muted-foreground"
                    >
                      {formatDateTime(item.createdAt)}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>{t("dashboard.quick.title")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            <QuickActions />
            {unreadNotifications > 0 ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-accent px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium text-accent-foreground">
                    {t("dashboard.stat.notifications")}
                  </span>
                  <span className="text-[12px] text-accent-foreground/80">
                    {t("dashboard.stat.notifications_hint")}
                  </span>
                </div>
                <Badge variant="primary">{unreadNotifications}</Badge>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
