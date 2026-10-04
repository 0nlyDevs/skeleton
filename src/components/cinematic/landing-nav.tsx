"use client";

import { BubbleMark, BubbleWordmark } from "@/components/layout/bubble-logo";
import { Menu, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useState } from "react";

import { DisplayMenu } from "@/components/layout/display-menu";
import { LocaleToggle } from "@/components/layout/locale-toggle";
import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import type { MessageKey } from "@/lib/i18n";

const LINKS: readonly { href: string; key: MessageKey }[] = [
  { href: "/services", key: "tn.nav.services" },
  { href: "/announcements", key: "tn.nav.announcements" },
  { href: "/contact", key: "tn.nav.contact" },
  { href: "/feed", key: "tn.nav.city_life" },
];

/** The four-pointed star of the loader, as the brand's mark. */
/**
 * The landing's top bar: the brand, four destinations, then sound, language,
 * display and the way in. It sits on the scene with no background until the
 * page moves, then gets a floor so it stays readable.
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
  const [open, setOpen] = useState(false);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    const onScroll = () => setMoved(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const account = viewer ? { href: viewer.staff ? "/agent" : "/space", label: viewer.staff ? t("tn.nav.agent") : t("tn.home.cta_space") } : null;

  return (
    <header className="tn-chrome tn-topbar text-white" data-solid={moved || open ? "" : undefined}>
      <nav aria-label={t("nav.label")} className="mx-auto flex h-16 max-w-[1320px] items-center gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="Bubble" className="tn-brand flex items-center gap-2.5">
          <BubbleMark className="h-9" />
          <BubbleWordmark className="h-[1.15rem]" />
        </Link>
        <ul className="hidden flex-1 items-center justify-center gap-8 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="tn-link text-[0.875rem] font-medium text-white/85 hover:text-white">
                {t(link.key)}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <button
            type="button"
            onClick={onSound}
            aria-pressed={soundOn}
            aria-label={soundOn ? t("tn.sound.mute") : t("tn.sound.unmute")}
            className="grid size-9 place-items-center rounded-full text-white/75 hover:bg-white/10 hover:text-white"
          >
            {soundOn ? <Volume2 className="size-4" aria-hidden /> : <VolumeX className="size-4" aria-hidden />}
          </button>
          {/* F14/F23/F24: language, text size and contrast, as everywhere else in the portal. */}
          <LocaleToggle className="text-white/75 hover:bg-white/10 hover:text-white" />
          <DisplayMenu className="text-white/75 hover:bg-white/10 hover:text-white" />
          {account ? (
            <Link href={account.href} className="tn-btn tn-btn--solid ml-2 hidden py-2 sm:inline-flex">
              {account.label}
            </Link>
          ) : (
            <button type="button" onClick={onRegistry} className="tn-btn tn-btn--solid ml-2 hidden py-2 sm:inline-flex">
              {t("nav.sign_in")}
            </button>
          )}
          <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label={t("tn.landing.menu")} className="ml-1 grid size-9 place-items-center rounded-full hover:bg-white/10 md:hidden">
            {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
          </button>
        </div>
      </nav>
      {open ? (
        <ul className="flex flex-col gap-1 border-t border-white/10 px-5 pb-5 pt-3 md:hidden">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="block rounded-xl px-3 py-3 text-[0.9375rem] hover:bg-white/5" onClick={() => setOpen(false)}>
                {t(link.key)}
              </Link>
            </li>
          ))}
          <li className="pt-2">
            {account ? (
              <Link href={account.href} className="tn-btn tn-btn--solid w-full">
                {account.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onRegistry();
                }}
                className="tn-btn tn-btn--solid w-full"
              >
                {t("nav.sign_in")}
              </button>
            )}
          </li>
        </ul>
      ) : null}
    </header>
  );
}
