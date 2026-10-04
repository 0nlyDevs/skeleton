"use client";

import { ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useRealtime } from "@/components/providers/realtime-provider";
import Link from "@/components/ui/link";
import { cn } from "@/lib/utils";

import { HELP_NAV, PLACES, isActive, placeFor, type PlaceId, type ShellNavItem } from "./nav-config";
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
 * A short side menu: the four places, one open at a time (the one you are
 * in, or the one you tap), then the assistant. Staff workspaces sit in the
 * top bar and everything personal is behind the avatar, so nothing is
 * listed twice.
 */
export function SideNav({ viewer }: { readonly viewer: ShellViewer | null }) {
  const t = useTranslation();
  const pathname = usePathname();
  const { messageUnreadTotal } = useRealtime();
  const current = placeFor(pathname);
  const [picked, setPicked] = useState<PlaceId | "none" | null>(null);
  const assistant = HELP_NAV.find((item) => item.href === "/assistant");

  // A page change puts the menu back on the place of the new page.
  useEffect(() => setPicked(null), [pathname]);
  const openId = picked ?? current?.id ?? null;

  return (
    <nav aria-label={t("tn.side.label")} className="flex flex-col gap-1 rounded-2xl bg-card/90 p-3 shadow-panel">
      {PLACES.map((place) => {
        const links = place.links.filter((link) => viewer || !link.member);
        const PlaceIcon = place.icon;
        const onPlace = current?.id === place.id;
        // The most specific link of the place is the current one.
        const active = links.filter((link) => isActive(pathname, link.href)).sort((a, b) => b.href.length - a.href.length)[0];
        if (place.id === "home") {
          return <Row key={place.id} item={{ href: viewer ? "/space" : "/start", labelKey: place.labelKey, icon: PlaceIcon }} active={onPlace} badge={0} label={t(place.labelKey)} />;
        }
        const open = openId === place.id;
        const unread = place.id === "community" && !open ? messageUnreadTotal : 0;
        return (
          <div key={place.id} className="flex flex-col gap-0.5">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setPicked(open ? "none" : place.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-full px-3 py-2 text-left text-[0.875rem] font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                onPlace ? "text-foreground" : "text-foreground/85",
              )}
            >
              <PlaceIcon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{t(place.labelKey)}</span>
              {unread > 0 ? <span className="grid min-w-5 place-items-center rounded-full bg-bead px-1.5 text-[0.6875rem] font-bold leading-5 text-bead-foreground">{unread > 99 ? "99+" : unread}</span> : null}
              {onPlace && !open ? <span aria-hidden className="size-1.5 rounded-full bg-bead" /> : null}
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
            </button>
            {open ? (
              <div className="mb-1 ml-5 flex flex-col gap-0.5 border-l border-border/70 pl-2">
                {links.map((link) => (
                  <Row key={link.href} item={link} active={active?.href === link.href} badge={link.badge === "messages" ? messageUnreadTotal : 0} label={t(link.labelKey)} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      {viewer && assistant ? (
        <div className="mt-1 border-t border-border/70 pt-2">
          <Row item={assistant} active={isActive(pathname, assistant.href)} badge={0} label={t(assistant.labelKey)} />
        </div>
      ) : null}
    </nav>
  );
}
