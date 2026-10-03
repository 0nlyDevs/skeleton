"use client";

import { Leaf, X } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { ECO_AUTO_COOKIE, ECO_COOKIE } from "@/lib/eco";

const DISMISS_KEY = "tn-light-mode-notice";

/**
 * Says, in plain words, why the page looks simpler when light mode was
 * switched on for a slow connection, and offers the full version in one tap.
 * Shown once per visit; an explicit choice in the display menu hides it for
 * good.
 */
export function LightModeNotice() {
  const t = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // Storage blocked: show it, it is only a notice.
    }
    setVisible(document.documentElement.hasAttribute("data-eco-auto") && !dismissed);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Nothing to remember it in; hiding it for this page is enough.
    }
    setVisible(false);
  };

  const showFull = () => {
    document.cookie = `${ECO_COOKIE}=0; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    document.cookie = `${ECO_AUTO_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    window.location.reload();
  };

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-xl items-start gap-3 rounded-xl border border-border bg-surface p-3 text-[0.8438rem] shadow-lg sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
    >
      <Leaf className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="font-medium">{t("tn.eco.auto_title")}</p>
        <p className="text-muted-foreground">{t("tn.eco.auto_body")}</p>
        <button type="button" onClick={showFull} className="w-fit font-medium text-primary underline-offset-4 hover:underline">
          {t("tn.eco.auto_full")}
        </button>
      </div>
      <button type="button" onClick={dismiss} aria-label={t("tn.eco.auto_dismiss")} className="rounded-md p-1 text-muted-foreground hover:bg-surface-muted">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
