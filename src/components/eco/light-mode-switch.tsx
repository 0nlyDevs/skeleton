"use client";

import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Switch } from "@/components/ui/switch";
import { ECO_AUTO_COOKIE, ECO_COOKIE } from "@/lib/eco";

/**
 * The light-mode choice, spelled out: on, off, and whether it was switched on
 * automatically because the connection looked slow. The choice is a cookie,
 * so the next page is served light (or full) from its first byte.
 */
export function LightModeSwitch() {
  const t = useTranslation();
  const [on, setOn] = useState(false);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setOn(root.hasAttribute("data-eco"));
    setAuto(root.hasAttribute("data-eco-auto"));
  }, []);

  const change = (next: boolean) => {
    const root = document.documentElement;
    document.cookie = `${ECO_COOKIE}=${next ? "1" : "0"}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    document.cookie = `${ECO_AUTO_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    root.removeAttribute("data-eco-auto");
    if (next) root.setAttribute("data-eco", "");
    else root.removeAttribute("data-eco");
    setOn(next);
    setAuto(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex w-fit cursor-pointer items-center gap-3 text-[0.9375rem] font-medium">
        <Switch checked={on} onCheckedChange={change} />
        {t(on ? "tn.eco.light.on" : "tn.eco.light.off")}
      </label>
      {auto ? <p className="text-[0.8125rem] text-muted-foreground">{t("tn.eco.light.auto")}</p> : null}
    </div>
  );
}
