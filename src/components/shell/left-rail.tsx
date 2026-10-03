"use client";

import { ChevronDown, MapPin } from "lucide-react";
import Link from "@/components/ui/link";
import { usePathname } from "next/navigation";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useRealtime } from "@/components/providers/realtime-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { cityZoneLabelKey, type CityZoneId } from "@/modules/alerts/city-zones";

import { GUEST_NAV, MORE_NAV, NAV_GROUPS, STAFF_NAV, isActive, type ShellNavItem } from "./nav-config";
import type { ShellViewer } from "./shell-types";
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
        "flex items-center gap-3 rounded-xl px-3 py-2 text-[0.875rem] font-medium transition-colors duration-[var(--duration-fast)]",
        active ? "bg-accent text-accent-foreground" : "text-foreground/80 hover:bg-surface-muted",
      )}
    >
      <Icon className={cn("size-[18px] shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
      <span className="flex-1">{t(item.labelKey)}</span>
      {badge > 0 ? (
        <span className="grid min-w-5 place-items-center rounded-full bg-error px-1.5 text-[0.6875rem] font-bold leading-5 text-white">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Link>
  );
}

function GroupLabel({ children }: { readonly children: string }) {
  return <p className="px-3 pb-1 pt-4 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</p>;
}

/**
 * The resident's compass: who I am and where I live, then a short list of
 * destinations grouped by what people come to do. Everything else is one
 * click away under "More", so the first screen never overwhelms.
 */
export function LeftRail({ viewer, zone }: { readonly viewer: ShellViewer | null; readonly zone: CityZoneId | null }) {
  const t = useTranslation();
  const pathname = usePathname();
  const { unreadCount, messageUnreadTotal } = useRealtime();
  const badges = { messages: messageUnreadTotal, notifications: unreadCount } as const;

  if (!viewer) {
    return (
      <div className="flex flex-col gap-4">
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
        <Card className="p-2">
          <nav aria-label={t("nav.label")} className="flex flex-col gap-0.5">
            {GUEST_NAV.map((item) => (
              <NavLink key={item.href} item={item} badge={0} />
            ))}
          </nav>
        </Card>
      </div>
    );
  }

  const profileHref = viewer.username ? `/profile/${encodeURIComponent(viewer.username)}` : "/settings/profile";
  const staff = STAFF_NAV.filter((item) => !item.roles || item.roles.includes(viewer.role));
  const moreActive = MORE_NAV.some((item) => isActive(pathname, item.href));

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2 p-3">
        <Link href={profileHref} className="flex items-center gap-3 rounded-xl p-1 hover:bg-surface-muted">
          <UserAvatar userId={viewer.id} name={viewer.name} image={viewer.image} size="md" />
          <span className="min-w-0">
            <span className="block truncate text-[0.9062rem] font-semibold">{viewer.name}</span>
            {viewer.username ? <span className="block truncate text-[0.7812rem] text-muted-foreground">@{viewer.username}</span> : null}
          </span>
        </Link>
        <Link
          href={zone ? "/city-map" : "/settings/profile"}
          className="flex items-center gap-2 rounded-xl bg-surface-muted px-3 py-2 text-[0.8125rem] hover:bg-accent"
        >
          <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
          {zone ? (
            <span className="min-w-0 truncate">
              <span className="text-muted-foreground">{t("tn.nav.my_district")} · </span>
              <span className="font-medium">{t(cityZoneLabelKey(zone))}</span>
            </span>
          ) : (
            <span className="font-medium text-primary">{t("tn.nav.choose_district")}</span>
          )}
        </Link>
      </Card>

      <Card className="p-2">
        <nav aria-label={t("nav.label")} className="flex flex-col">
          {NAV_GROUPS.map((group) => (
            <div key={group.labelKey ?? "hub"} className="flex flex-col gap-0.5">
              {group.labelKey ? <GroupLabel>{t(group.labelKey)}</GroupLabel> : null}
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} badge={item.badge ? badges[item.badge] : 0} />
              ))}
            </div>
          ))}

          <details className="group mt-2" open={moreActive}>
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2 text-[0.8125rem] font-medium text-muted-foreground hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
              {t("tn.nav.more")}
            </summary>
            <div className="flex flex-col gap-0.5 pt-0.5">
              {MORE_NAV.map((item) => (
                <NavLink key={item.href} item={item} badge={0} />
              ))}
            </div>
          </details>

          {staff.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              <GroupLabel>{t("tn.nav.staff")}</GroupLabel>
              {staff.map((item) => (
                <NavLink key={item.href} item={item} badge={0} />
              ))}
            </div>
          ) : null}
        </nav>
      </Card>

      <p className="px-2 text-[0.7188rem] leading-relaxed text-muted-foreground">
        <Link href="/privacy" className="hover:underline">
          {t("footer.privacy")}
        </Link>
        {" · "}
        <Link href="/terms" className="hover:underline">
          {t("footer.terms")}
        </Link>
        {" · "}Terra Nova © {new Date().getFullYear()}
      </p>
    </div>
  );
}
