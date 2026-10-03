"use client";

import { Building2, FolderOpen, Landmark, Map, Megaphone, Send, Siren, Users, Volume2, VolumeX } from "lucide-react";

import { DisplayMenu } from "@/components/layout/display-menu";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import type { MessageKey } from "@/lib/i18n";

const DOCK: readonly { href: string; key: MessageKey; icon: typeof Building2 }[] = [
  { href: "/services", key: "tn.nav.services", icon: Building2 },
  { href: "/announcements", key: "tn.nav.announcements", icon: Megaphone },
  { href: "/contact", key: "tn.nav.contact", icon: Send },
  { href: "/alerts", key: "tn.nav.alerts", icon: Siren },
  { href: "/city-map", key: "tn.nav.city_map", icon: Map },
  { href: "/feed", key: "tn.nav.city_life", icon: Users },
];

/** The four-pointed star of the loader, as the brand's mark. */
function StarMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M12 0c.6 6.2 5.2 10.9 12 12-6.8 1.1-11.4 5.8-12 12-.6-6.2-5.200-10.900-12-12 6.8-1.100 11.400-5.800 12-12Z" />
    </svg>
  );
}

/**
 * The landing's controls, laid out like a cockpit rather than a bar: the brand
 * in one corner, sound, language, display and the way in to the registry in
 * the other, and the portal's destinations in a dock of glass at the bottom.
 */
export function LandingNav({
  viewer,
  soundOn,
  onSound,
  onRegistry,
}: {
  readonly viewer: { firstName: string; staff: boolean } | null;
  readonly soundOn: boolean;
  readonly onSound: () => void;
  /** Opens the citizens' registry (sign-in). */
  readonly onRegistry: () => void;
}) {
  const t = useTranslation();

  return (
    <div className="tn-chrome">
      <header className="tn-corner tn-corner--start">
        <Link href="/" className="lg tn-brand">
          <StarMark />
          <span className="max-sm:sr-only">TERRA NOVA</span>
        </Link>
      </header>

      <div className="tn-corner tn-corner--end">
        <div className="lg tn-tools">
          <button
            type="button"
            onClick={onSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? t("tn.sound.mute") : t("tn.sound.unmute")}
            className="grid size-9 place-items-center text-white/80 hover:bg-white/10 hover:text-white"
          >
            {soundOn ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
          </button>
          {/* F14/F23/F24: language, text size and contrast, as everywhere else in the portal. */}
          <LocaleToggle className="text-white/80 hover:bg-white/10 hover:text-white" />
          <DisplayMenu className="text-white/80 hover:bg-white/10 hover:text-white" />
        </div>
        {viewer ? (
          <Link href={viewer.staff ? "/agent" : "/space"} className="lg-btn lg-btn--amber max-sm:size-11 max-sm:p-0">
            <FolderOpen className="size-4 sm:hidden" aria-hidden />
            <span className="max-sm:sr-only">{viewer.staff ? t("tn.nav.agent") : t("tn.home.cta_space")}</span>
          </Link>
        ) : (
          <button type="button" onClick={onRegistry} className="lg-btn lg-btn--amber max-sm:size-11 max-sm:p-0">
            <Landmark className="size-4 sm:hidden" aria-hidden />
            <span className="max-sm:sr-only">{t("tn.registry.open")}</span>
          </button>
        )}
      </div>

      <nav aria-label={t("tn.tour.dock")} className="lg tn-dock">
        {DOCK.map((item) => (
          <Link key={item.href} href={item.href} aria-label={t(item.key)}>
            <item.icon className="size-[18px]" aria-hidden />
            <span aria-hidden>{t(item.key)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
