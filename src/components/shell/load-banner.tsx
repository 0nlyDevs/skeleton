"use client";

import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { apiFetch } from "@/lib/api/client";

/**
 * F77 — when the platform protects itself under load, residents are told in
 * one calm line what still works and what is paused. Nothing blocks.
 */
export function LoadBanner() {
  const t = useTranslation();
  const [essential, setEssential] = useState(false);

  useEffect(() => {
    let stopped = false;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      apiFetch<{ data: { level: string } }>("/api/load")
        .then((response) => !stopped && setEssential(response.data.level === "essential"))
        .catch(() => undefined);
    };
    check();
    const timer = window.setInterval(check, 30_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!essential) return null;
  return (
    <p role="status" className="mb-5 rounded-full border border-warning/50 bg-warning/10 px-4 py-2 text-[0.875rem]">
      <span className="font-semibold">{t("tn.load.title")}</span> {t("tn.load.body")}
    </p>
  );
}
