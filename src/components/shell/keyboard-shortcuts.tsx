"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "@/components/ui/link";
import type { MessageKey } from "@/lib/i18n";

const OPEN_EVENT = "tn:open-shortcuts";

/** Opens the shortcuts list from a page (the accessibility page, for one). */
export function OpenShortcutsButton({ children, className }: { readonly children: string; readonly className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      {children}
    </button>
  );
}

/** True while the user is typing: shortcuts must never steal a key from a field. */
function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** Second key of the "g" sequence. */
const GO: Readonly<Record<string, string>> = { a: "/space", d: "/services", v: "/city-map", c: "/feed", m: "/messages", n: "/notifications" };

const ROWS: readonly { keys: readonly string[]; label: MessageKey }[] = [
  { keys: ["/"], label: "tn.keys.search" },
  { keys: ["?"], label: "tn.keys.help" },
  { keys: ["g", "a d v c m n"], label: "tn.keys.go" },
  { keys: ["Tab"], label: "tn.keys.skip" },
  { keys: ["Tab", "Maj + Tab"], label: "tn.keys.move" },
  { keys: ["Entrée", "Espace"], label: "tn.keys.activate" },
  { keys: ["Échap"], label: "tn.keys.close" },
  { keys: ["↑", "↓"], label: "tn.keys.arrows" },
];

/**
 * F41 — keyboard shortcuts: "/" jumps to the search field, "?" lists every
 * key the platform answers to. Single keys only when no field has the focus,
 * and no modifier is held, so typing and browser shortcuts are untouched.
 */
export function KeyboardShortcuts() {
  const t = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // "g" then a letter, within a second and a half: a place, never a stray key.
  const goArmed = useRef(0);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat || typing(event.target)) return;
      // A dialog or a menu owns the keyboard while it is open.
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]')) return;
      const key = event.key.toLowerCase();
      if (goArmed.current && Date.now() - goArmed.current < 1500) {
        goArmed.current = 0;
        const target = GO[key];
        if (target) {
          event.preventDefault();
          router.push(target);
        }
        return;
      }
      if (key === "g") {
        goArmed.current = Date.now();
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "/") {
        const search = document.querySelector<HTMLInputElement>("[data-global-search]");
        if (search && search.offsetParent !== null) {
          event.preventDefault();
          search.focus();
        }
      }
    };
    const openFromPage = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_EVENT, openFromPage);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_EVENT, openFromPage);
    };
  }, [router]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("tn.keys.title")}</DialogTitle>
          <DialogDescription>{t("tn.keys.intro")}</DialogDescription>
        </DialogHeader>
        <dl className="flex flex-col divide-y divide-border/70 text-sm">
          {ROWS.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 py-2">
              <dt className="text-muted-foreground">{t(row.label)}</dt>
              <dd className="flex shrink-0 flex-wrap justify-end gap-1">
                {row.keys.map((key) => (
                  <kbd key={key} className="rounded-md border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-[0.75rem]">
                    {key}
                  </kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
        <Link href="/accessibility" onClick={() => setOpen(false)} className="text-sm text-primary underline underline-offset-2">
          {t("tn.keys.more")}
        </Link>
      </DialogContent>
    </Dialog>
  );
}
