import { BusFront, CalendarClock, Globe2, Handshake, Megaphone, Send, Siren, Sparkles, Vote } from "lucide-react";

import Link from "@/components/ui/link";
import type { Translator } from "@/lib/i18n";

const ITEMS = [
  { href: "/contact", icon: Send, key: "tn.circle.request" },
  { href: "/appointments/new", icon: CalendarClock, key: "tn.circle.appointment" },
  { href: "/city-map", icon: Globe2, key: "tn.circle.map" },
  { href: "/alerts", icon: Siren, key: "tn.circle.alerts" },
  { href: "/transports", icon: BusFront, key: "tn.circle.transports" },
  { href: "/announcements", icon: Megaphone, key: "tn.circle.news" },
  { href: "/participate", icon: Vote, key: "tn.circle.participate" },
  { href: "/partners", icon: Handshake, key: "tn.circle.partners" },
  { href: "/assistant", icon: Sparkles, key: "tn.circle.assistant" },
] as const;

/** The city's everyday actions as a row of round shortcuts, the first thing on the home. */
export function QuickCircles({ t }: { readonly t: Translator }) {
  return (
    <nav aria-label={t("tn.circle.label")} className="rounded-2xl bg-card p-3 shadow-panel">
      <ul className="flex gap-1 overflow-x-auto pb-1 sm:gap-2">
        {ITEMS.map((item) => (
          <li key={item.href} className="shrink-0">
            <Link href={item.href} className="group flex w-[5.25rem] flex-col items-center gap-1.5 rounded-xl p-1.5 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring/60">
              <span className="quick-circle grid size-14 place-items-center rounded-full transition-transform group-hover:-translate-y-0.5">
                <item.icon className="size-5" aria-hidden />
              </span>
              <span className="w-full text-[0.75rem] font-medium leading-tight">{t(item.key)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
