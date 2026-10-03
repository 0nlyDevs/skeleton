"use client";

import { Leaf } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { ECO_AUTO_COOKIE, ECO_COOKIE } from "@/lib/eco";
import { cn } from "@/lib/utils";

/**
 * Eco mode: fewer bytes and less CPU (no animation, banners, covers or 3D).
 * Stored in a cookie so the server renders the light page from the first byte.
 */
export function EcoToggle({ className }: { readonly className?: string }) {
  const t = useTranslation();
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(document.documentElement.hasAttribute("data-eco"));
  }, []);

  const toggle = () => {
    const next = !on;
    // An explicit choice replaces the automatic one (slow connection).
    document.cookie = `${ECO_COOKIE}=${next ? "1" : "0"}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    document.cookie = `${ECO_AUTO_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
    document.documentElement.removeAttribute("data-eco-auto");
    if (next) document.documentElement.setAttribute("data-eco", "");
    else document.documentElement.removeAttribute("data-eco");
    setOn(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      title={t(on ? "eco.on_hint" : "eco.off_hint")}
      aria-label={t("eco.label")}
      className={cn(
        "grid size-9 place-items-center rounded-full transition-colors hover:bg-surface-muted",
        on ? "text-success" : "text-muted-foreground",
        className,
      )}
    >
      <Leaf className="size-[18px]" />
    </button>
  );
}
