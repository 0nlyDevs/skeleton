"use client";

import { Lightbulb, X } from "lucide-react";
import { useSyncExternalStore } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { cn } from "@/lib/utils";

/**
 * F35 — a short tip shown where a newcomer is about to act, instead of a long
 * guide. Each tip can be dismissed on its own, or all at once; the choice is
 * kept in this browser. The server renders nothing, so a dismissed tip never
 * flashes before hydration.
 */
const STORAGE_KEY = "tn-tips-dismissed";
const ALL = "*";
const listeners = new Set<() => void>();
let fallback = "[]";

function read(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "[]";
  } catch {
    return fallback;
  }
}

function write(ids: readonly string[]): void {
  fallback = JSON.stringify(ids);
  try {
    window.localStorage.setItem(STORAGE_KEY, fallback);
  } catch {
    // Storage blocked: the in-memory copy still hides the tip until reload.
  }
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function parse(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function ContextTip({ id, children, className }: { readonly id: string; readonly children: string; readonly className?: string }) {
  const t = useTranslation();
  // `null` on the server and during hydration: render nothing until the browser knows.
  const raw = useSyncExternalStore(subscribe, read, () => null);
  if (raw === null) return null;
  const dismissed = parse(raw);
  if (dismissed.includes(ALL) || dismissed.includes(id)) return null;

  return (
    <aside
      aria-label={t("tn.tip.label")}
      className={cn("flex items-start gap-3 rounded-xl border border-primary/25 bg-accent/60 px-3.5 py-3 text-sm", className)}
    >
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p>
          <span className="font-semibold">{t("tn.tip.label")} · </span>
          {children}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem]">
          <button type="button" onClick={() => write([...dismissed, id])} className="font-medium text-primary hover:underline">
            {t("tn.tip.dismiss")}
          </button>
          <button type="button" onClick={() => write([...dismissed, ALL])} className="text-muted-foreground hover:text-foreground hover:underline">
            {t("tn.tip.hide_all")}
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => write([...dismissed, id])}
        aria-label={t("tn.tip.dismiss")}
        className="rounded-md p-1 text-muted-foreground hover:bg-background/60 hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </aside>
  );
}
