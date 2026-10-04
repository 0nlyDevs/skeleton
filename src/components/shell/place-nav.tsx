"use client";

import { usePathname } from "next/navigation";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useRealtime } from "@/components/providers/realtime-provider";
import Link from "@/components/ui/link";
import { cn } from "@/lib/utils";

import { isActive, placeFor } from "./nav-config";

/**
 * The pages of the current place, under the top bar. They wrap onto a second
 * line on a phone: nothing scrolls sideways.
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
    <nav aria-label={t(place.labelKey)} className="mb-5 flex flex-wrap gap-2">
      {links.map((link) => {
        const active = current?.href === link.href;
        const badge = link.badge === "messages" ? messageUnreadTotal : 0;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.9062rem] font-medium transition-colors",
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
