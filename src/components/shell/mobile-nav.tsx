"use client";

import { usePathname } from "next/navigation";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useRealtime } from "@/components/providers/realtime-provider";
import Link from "@/components/ui/link";
import { cn } from "@/lib/utils";

import { PLACES, placeFor } from "./nav-config";

/** Phones: the same four places as the top bar, under the thumb. */
export function MobileNav({ signedIn }: { readonly signedIn: boolean }) {
  const t = useTranslation();
  const pathname = usePathname();
  const { messageUnreadTotal } = useRealtime();
  const current = placeFor(pathname);

  return (
    <nav
      aria-label={t("nav.label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-card pb-[env(safe-area-inset-bottom)] md:hidden [@media(max-height:30rem)]:static"
    >
      <ul className="grid grid-cols-4">
        {PLACES.map((place) => {
          const Icon = place.icon;
          const active = current?.id === place.id;
          const badge = place.id === "community" ? messageUnreadTotal : 0;
          return (
            <li key={place.id}>
              <Link
                href={place.id === "home" && !signedIn ? "/start" : place.href}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex h-[3.75rem] flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium", active ? "text-foreground" : "text-muted-foreground")}
              >
                {/* The current place carries the bead; `aria-current` says it too. */}
                <span aria-hidden className={cn("absolute top-1.5 size-1.5 rounded-full", active ? "bg-bead" : "bg-transparent")} />
                <Icon className="size-5" aria-hidden />
                {t(place.labelKey)}
                {badge > 0 ? (
                  <span className="absolute left-1/2 top-2 ml-2.5 grid min-w-4 place-items-center rounded-full bg-bead px-1 text-[0.625rem] font-bold leading-4 text-bead-foreground">
                    {badge > 9 ? "9+" : badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
