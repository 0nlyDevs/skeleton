"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import type { GlossaryId } from "@/lib/glossary";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const CLOSE_DELAY_MS = 150;

/**
 * D13 — a word that may need explaining. Its definition appears on hover, on
 * keyboard focus and on tap (no hover on a phone), stays open while the
 * pointer is over it, and closes with Escape (WCAG 1.4.13). Screen readers
 * get the definition as the button's description, so it is read without
 * opening anything.
 */
export function Term({ id, children, className }: { readonly id: GlossaryId; readonly children?: ReactNode; readonly className?: string }) {
  const t = useTranslation();
  const descriptionId = useId();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // How the current press started: focus from a pointer must not open and
  // then let the click close it again.
  const pressedWith = useRef<string | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const show = () => {
    cancelClose();
    setOpen(true);
  };
  const hideSoon = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  useEffect(() => cancelClose, []);

  const term = t(`tn.glossary.term.${id}` as MessageKey);
  const definition = t(`tn.glossary.def.${id}` as MessageKey);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          ref={buttonRef}
          type="button"
          aria-describedby={descriptionId}
          aria-expanded={open}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") show();
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") hideSoon();
          }}
          onPointerDown={(event) => {
            pressedWith.current = event.pointerType;
          }}
          onFocus={() => {
            // Keyboard focus opens it; a pointer press is handled by the click.
            if (pressedWith.current === null) show();
          }}
          onBlur={hideSoon}
          onClick={() => {
            const pointer = pressedWith.current;
            pressedWith.current = null;
            // A mouse already opened it on hover; a tap or Enter toggles it.
            if (pointer === "mouse") show();
            else setOpen((value) => !value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          className={cn(
            "inline cursor-help rounded-sm p-0 text-inherit underline decoration-dotted decoration-from-font underline-offset-[3px] hover:decoration-solid",
            className,
          )}
        >
          {children ?? term}
        </button>
      </PopoverAnchor>
      <span id={descriptionId} className="sr-only">
        {definition}
      </span>
      <PopoverContent
        side="top"
        className="w-72 text-sm"
        // Focus stays on the word: the definition is information, not a dialog.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={(event) => {
          // Pressing the word itself is handled by its own click.
          if (buttonRef.current?.contains(event.target as Node)) event.preventDefault();
        }}
        onPointerEnter={cancelClose}
        onPointerLeave={hideSoon}
        aria-hidden
      >
        <p className="font-semibold">{term}</p>
        <p className="mt-1 text-muted-foreground">{definition}</p>
      </PopoverContent>
    </Popover>
  );
}
