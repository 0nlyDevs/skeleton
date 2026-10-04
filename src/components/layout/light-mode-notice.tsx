"use client";

import { Leaf, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { ECO_AUTO_COOKIE, ECO_COOKIE } from "@/lib/eco";

const DISMISS_KEY = "tn-light-mode-notice";

type State = "hidden" | "on" | "offer";

/**
 * Nobody should take the light page for the real one. On every page,
 * landing included: when eco mode is on, a small notice says so and offers
 * the full version; on a slow connection with no choice made, it offers eco
 * mode instead of switching by itself. Closed once per visit.
 */
export function LightModeNotice() {
  const t = useTranslation();
  const [state, setState] = useState<State>("hidden");

  useEffect(() => {
    const root = document.documentElement;
    const read = () => {
      let dismissed: string | null = null;
      try {
        dismissed = sessionStorage.getItem(DISMISS_KEY);
      } catch {
        // Storage blocked: show it, it is only a notice.
      }
      const next: State = root.hasAttribute("data-eco") ? "on" : root.hasAttribute("data-eco-auto") ? "offer" : "hidden";
      setState(dismissed === next ? "hidden" : next);
    };
    read();
    // The eco button in the top bar changes the attribute: follow it.
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-eco", "data-eco-auto"] });
    return () => observer.disconnect();
  }, []);

  if (state === "hidden") return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, state);
    } catch {
      // Nothing to remember it in; hiding it for this page is enough.
    }
    setState("hidden");
  };

  const choose = (eco: boolean) => {
    document.cookie = `${ECO_COOKIE}=${eco ? "1" : "0"}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    document.cookie = `${ECO_AUTO_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    window.location.reload();
  };

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-20 z-[80] mx-auto flex max-w-xl items-start gap-3 rounded-2xl border-2 border-success bg-card p-3.5 text-[0.875rem] text-foreground shadow-lg sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success text-success-foreground">
        <Leaf className="size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-semibold">{t(state === "on" ? "tn.eco.on_title" : "tn.eco.offer_title")}</p>
        <p className="text-muted-foreground">{t(state === "on" ? "tn.eco.on_body" : "tn.eco.offer_body")}</p>
        <button type="button" onClick={() => choose(state !== "on")} className="mt-1 w-fit rounded-full bg-foreground px-3.5 py-1.5 text-[0.8125rem] font-semibold text-background">
          {t(state === "on" ? "tn.eco.auto_full" : "tn.eco.offer_action")}
        </button>
      </div>
      <button type="button" onClick={dismiss} aria-label={t("tn.eco.auto_dismiss")} className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface-muted">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
