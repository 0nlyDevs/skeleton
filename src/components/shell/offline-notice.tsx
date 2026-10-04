"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";

/**
 * F93/F94 — when the connection drops, one calm line says so and points to
 * "L'essentiel" (alerts, instructions, emergency numbers), which the browser
 * keeps a copy of and opens without the network.
 */
export function OfflineNotice() {
  const t = useTranslation();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <p role="status" className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-full border border-warning/50 bg-warning/10 px-4 py-2 text-[0.875rem]">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      <span className="font-semibold">{t("tn.essentials.offline")}</span>
      <Link href="/essentials" className="font-medium text-primary">{t("tn.essentials.open")}</Link>
    </p>
  );
}
