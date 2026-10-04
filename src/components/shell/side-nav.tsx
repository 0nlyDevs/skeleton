"use client";

import { usePathname } from "next/navigation";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useRealtime } from "@/components/providers/realtime-provider";
import Link from "@/components/ui/link";
import { cn } from "@/lib/utils";

import { HELP_NAV, PLACES, STAFF_NAV, isActive, placeFor, type ShellNavItem } from "./nav-config";
import type { ShellViewer } from "./shell-types";

function Row({ item, active, badge, label }: { readonly item: ShellNavItem; readonly active: boolean; readonly badge: number; readonly label: string }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-full px-3 py-2 text-[0.875rem] font-medium transition-colors",
        active ? "bg-foreground text-background" : "text-foreground/85 hover:bg-accent",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge > 0 ? <span className="grid min-w-5 place-items-center rounded-full bg-bead px-1.5 text-[0.6875rem] font-bold leading-5 text-bead-foreground">{badge > 99 ? "99+" : badge}</span> : null}
    </Link>
  );
}

/**
 * On a wide screen, everything a resident can do is in view at once: the
 * four places with their pages, each under its own title, then the staff
 * workspaces and the help pages. Nothing hides behind the avatar.
 */
export function SideNav({ viewer }: { readonly viewer: ShellViewer | null }) {
  const t = useTranslation();
  const pathname = usePathname();
  const { messageUnreadTotal } = useRealtime();
  const current = placeFor(pathname);
  const staff = viewer ? STAFF_NAV.filter((item) => !item.roles || item.roles.includes(viewer.role)) : [];

  return (
    <nav aria-label={t("tn.side.label")} className="flex flex-col gap-4 rounded-2xl bg-card/90 p-3 shadow-panel">
      {PLACES.map((place) => {
        const links = place.links.filter((link) => viewer || !link.member);
        const PlaceIcon = place.icon;
        const onPlace = current?.id === place.id;
        // The most specific link of the place is the current one.
        const active = links.filter((link) => isActive(pathname, link.href)).sort((a, b) => b.href.length - a.href.length)[0];
        if (place.id === "home") {
          return <Row key={place.id} item={{ href: viewer ? "/space" : "/start", labelKey: place.labelKey, icon: PlaceIcon }} active={onPlace} badge={0} label={t(place.labelKey)} />;
        }
        return (
          <div key={place.id} className="flex flex-col gap-0.5">
            <p className={cn("flex items-center gap-2 px-3 pb-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em]", onPlace ? "text-foreground" : "text-muted-foreground")}>
              <span aria-hidden className={cn("size-1.5 rounded-full", onPlace ? "bg-bead" : "bg-border")} />
              {t(place.labelKey)}
            </p>
            {links.map((link) => (
              <Row key={link.href} item={link} active={active?.href === link.href} badge={link.badge === "messages" ? messageUnreadTotal : 0} label={t(link.labelKey)} />
            ))}
          </div>
        );
      })}
      {staff.length > 0 ? (
        <div className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t("tn.nav.staff")}</p>
          {staff.map((item) => (
            <Row key={item.href} item={item} active={isActive(pathname, item.href)} badge={0} label={t(item.labelKey)} />
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-0.5">
        <p className="px-3 pb-1 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t("tn.account.help")}</p>
        {HELP_NAV.filter((item) => viewer || !item.member).map((item) => (
          <Row key={item.href} item={item} active={isActive(pathname, item.href)} badge={0} label={t(item.labelKey)} />
        ))}
      </div>
    </nav>
  );
}
