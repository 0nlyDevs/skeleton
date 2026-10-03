"use client";

import { Menu, X } from "lucide-react";
import { useState } from "react";

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

/** Glass navigation bar; it slides in at the end of the intro. */
export function LandingNav({ viewer }: { readonly viewer: { firstName: string; staff: boolean } | null }) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <header data-hero="nav" className="fixed inset-x-0 top-0 z-40 px-4 pt-4 opacity-0 sm:px-6">
      <nav
        aria-label={t("nav.label")}
        className="mx-auto flex max-w-[1240px] items-center gap-6 rounded-full border border-white/10 bg-[#050b18]/55 py-2.5 pl-5 pr-2.5 text-white shadow-[0_10px_40px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl"
      >
        <Link href="/" className="font-display text-[1.1875rem] font-bold tracking-wide">
          TERRA NOVA
        </Link>
        <ul className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="tn-nav-link rounded-full px-3.5 py-2 text-[0.8438rem] text-white/70 transition-colors hover:text-white">
                {t(link.key)}
              </Link>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          {/* F14/F23/F24: language, text size and contrast, as everywhere else in the portal. */}
          <LocaleToggle className="text-white/75 hover:bg-white/10 hover:text-white" />
          <DisplayMenu className="text-white/75 hover:bg-white/10 hover:text-white" />
          {viewer ? (
            <>
              {viewer.staff ? (
                <Link href="/agent" className="hidden rounded-full px-3.5 py-2 text-[0.8438rem] text-white/70 hover:text-white sm:inline-flex">
                  {t("tn.nav.agent")}
                </Link>
              ) : null}
              <Link href="/space" className="tn-cta-primary hidden rounded-full px-4 py-2 sm:inline-flex text-[0.8438rem] font-semibold">
                {t("tn.home.cta_space")}
              </Link>
            </>
          ) : (
            <>
              <Link href="/login" className="hidden rounded-full px-3.5 py-2 text-[0.8438rem] text-white/70 hover:text-white sm:inline-flex">
                {t("nav.sign_in")}
              </Link>
              <Link href="/register" className="tn-cta-primary hidden rounded-full px-4 py-2 sm:inline-flex text-[0.8438rem] font-semibold">
                {t("tn.home.cta_join")}
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label={t("tn.landing.menu")}
            className="grid size-9 place-items-center rounded-full border border-white/15 md:hidden"
          >
            {open ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
          </button>
        </div>
      </nav>
      {open ? (
        <ul className="mx-auto mt-2 flex max-w-[1240px] flex-col rounded-3xl border border-white/10 bg-[#050b18]/90 p-2 text-white backdrop-blur-xl md:hidden">
          {[
            ...LINKS,
            ...(viewer
              ? [{ href: "/space", key: "tn.home.cta_space" as MessageKey }]
              : [
                  { href: "/login", key: "nav.sign_in" as MessageKey },
                  { href: "/register", key: "tn.home.cta_join" as MessageKey },
                ]),
          ].map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="block rounded-2xl px-4 py-3 text-[0.9375rem] hover:bg-white/5" onClick={() => setOpen(false)}>
                {t(link.key)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}
