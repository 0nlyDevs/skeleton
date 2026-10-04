"use client";

import { usePathname } from "next/navigation";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useRealtime } from "@/components/providers/realtime-provider";
import Link from "@/components/ui/link";
import { cn } from "@/lib/utils";

import { isActive, placeFor } from "./nav-config";

/**
 * The pages of the current place, in one row under the top bar. On a phone
 * the row scrolls sideways inside itself; the page never does.
 */
export function PlaceNav({ signedIn }: { readonly signedIn: boolean }) {
  const t = useTranslation();
  const pathname = usePathname();
  const { messageUnreadTotal } = useRealtime();
  const place = placeFor(pathname);
  const links = place?.links.filter((link) => signedIn || !link.member) ?? [];
  if (!place || links.length === 0) return null;

  // The most specific link is the current one.
  const current = links.filter((link) => isActive(pathname, link.href)).sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav aria-label={t(place.labelKey)} className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0">
      {links.map((link) => {
        const active = current?.href === link.href;
        const badge = link.badge === "messages" ? messageUnreadTotal : 0;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[0.8438rem] font-medium transition-colors",
              active ? "bg-foreground text-background" : "bg-card text-foreground/80 hover:bg-accent",
            )}
          >
            {t(link.labelKey)}
            {badge > 0 ? (
              <span className="grid min-w-5 place-items-center rounded-full bg-bead px-1.5 text-[0.6875rem] font-bold leading-5 text-bead-foreground">
                {badge > 99 ? "99+" : badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
