"use client";

import { Lock, UsersRound } from "lucide-react";
import Link from "@/components/ui/link";
import { usePathname } from "next/navigation";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useRealtime } from "@/components/providers/realtime-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { CITY_NAV, MAIN_NAV, STAFF_NAV, isActive, type ShellNavItem } from "./nav-config";
import type { ShellRail, ShellViewer } from "./shell-types";
import { UserAvatar } from "./user-avatar";

function NavLink({ item, badge }: { readonly item: ShellNavItem; readonly badge: number }) {
  const t = useTranslation();
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.875rem] font-medium transition-colors duration-[var(--duration-fast)]",
        active ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25" : "text-foreground/80 hover:bg-surface-muted",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      <span className="flex-1">{t(item.labelKey)}</span>
      {badge > 0 ? (
        <span
          className={cn(
            "grid min-w-5 place-items-center rounded-full px-1.5 text-[0.6875rem] font-bold leading-5",
            active ? "bg-primary-foreground/20" : "bg-error text-white",
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

/** What a guest can open without an account. */
const PUBLIC_CITY_PATHS = new Set(["/", "/services", "/announcements", "/glossary", "/accessibility"]);

export function LeftRail({ viewer, rail }: { readonly viewer: ShellViewer | null; readonly rail: ShellRail | null }) {
  const t = useTranslation();
  const { unreadCount, messageUnreadTotal } = useRealtime();
  const badges = { messages: messageUnreadTotal, notifications: unreadCount } as const;

  if (!viewer) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="p-2">
          <nav aria-label={t("nav.label")} className="flex flex-col gap-0.5">
            {CITY_NAV.filter((item) => PUBLIC_CITY_PATHS.has(item.href)).map((item) => (
              <NavLink key={item.href} item={item} badge={0} />
            ))}
          </nav>
        </Card>
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-[1rem] font-semibold">{t("shell.join_title")}</h2>
          <p className="text-[0.8438rem] leading-relaxed text-muted-foreground">{t("shell.join_body")}</p>
          <Button asChild>
            <Link href="/register">{t("nav.join")}</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/login">{t("nav.sign_in")}</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const profileHref = viewer.username ? `/profile/${encodeURIComponent(viewer.username)}` : "/settings/profile";
  const staff = STAFF_NAV.filter((item) => !item.roles || item.roles.includes(viewer.role));

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <Link href={profileHref} className="flex items-center gap-3 rounded-xl p-1 hover:bg-surface-muted">
          <UserAvatar userId={viewer.id} name={viewer.name} image={viewer.image} size="md" />
          <span className="min-w-0">
            <span className="block truncate text-[0.9062rem] font-semibold">{viewer.name}</span>
            {viewer.username ? (
              <span className="block truncate text-[0.7812rem] text-muted-foreground">@{viewer.username}</span>
            ) : null}
          </span>
        </Link>
        {rail ? (
          <dl className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-surface-muted p-2 text-center">
            {(
              [
                ["shell.followers", rail.followers],
                ["shell.following", rail.following],
                ["shell.posts", rail.posts],
              ] as const
            ).map(([key, value]) => (
              <div key={key}>
                <dd className="text-[0.9375rem] font-bold tabular-nums">{value}</dd>
                <dt className="text-[0.6875rem] text-muted-foreground">{t(key)}</dt>
              </div>
            ))}
          </dl>
        ) : null}
      </Card>

      <Card className="p-2">
        <nav aria-label={t("nav.label")} className="flex flex-col gap-0.5">
          {CITY_NAV.map((item) => (
            <NavLink key={item.href} item={item} badge={item.badge ? badges[item.badge] : 0} />
          ))}
        </nav>
        <p className="px-3 pb-1 pt-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
          {t("tn.nav.city_life")}
        </p>
        <nav aria-label={t("tn.nav.city_life")} className="flex flex-col gap-0.5">
          {MAIN_NAV.map((item) => (
            <NavLink key={item.href} item={item} badge={item.badge ? badges[item.badge] : 0} />
          ))}
        </nav>
        {staff.length > 0 ? (
          <>
            <p className="px-3 pb-1 pt-3 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("nav.staff")}
            </p>
            <nav aria-label={t("nav.staff")} className="flex flex-col gap-0.5">
              {staff.map((item) => (
                <NavLink key={item.href} item={item} badge={0} />
              ))}
            </nav>
          </>
        ) : null}
      </Card>

      {rail && rail.groups.length > 0 ? (
        <Card className="p-3">
          <p className="px-2 pb-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("nav.your_groups")}
          </p>
          <ul className="flex flex-col gap-0.5">
            {rail.groups.map((group) => (
              <li key={group.slug}>
                <Link
                  href={`/groups/${group.slug}`}
                  className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[0.8438rem] hover:bg-surface-muted"
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-[0.75rem] font-bold text-accent-foreground">
                    {group.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{group.name}</span>
                  {group.privacy === "PRIVATE" ? <Lock className="size-3.5 text-muted-foreground" aria-hidden /> : null}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/groups"
            className="mt-1 flex items-center gap-2 rounded-xl px-2 py-1.5 text-[0.8125rem] font-medium text-primary hover:bg-accent"
          >
            <UsersRound className="size-4" aria-hidden />
            {t("nav.see_all")}
          </Link>
        </Card>
      ) : null}

      <p className="px-2 text-[0.7188rem] leading-relaxed text-muted-foreground">
        <Link href="/privacy" className="hover:underline">
          {t("footer.privacy")}
        </Link>
        {" · "}
        <Link href="/terms" className="hover:underline">
          {t("footer.terms")}
        </Link>
        {" · "}Skeleton © {new Date().getFullYear()}
      </p>
    </div>
  );
}
