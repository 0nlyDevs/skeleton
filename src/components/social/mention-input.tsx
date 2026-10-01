"use client";

import { Loader2 } from "lucide-react";
import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";

interface Suggestion {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly image: string | null;
}

/** The `@handle` being typed right before the caret, if any. */
function activeMention(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const match = /(^|[\s(])@([a-z0-9_.]{0,30})$/i.exec(before);
  if (!match) return null;
  return { start: caret - (match[2]?.length ?? 0) - 1, query: match[2] ?? "" };
}

export interface MentionInputHandle {
  focus: () => void;
}

/**
 * Auto-growing textarea with `@` autocomplete.
 *
 * Typing `@` and at least one character queries `/api/users/search`
 * (debounced, cancelled when stale). ↑/↓ move, Enter/Tab insert, Escape
 * closes. Selection inserts the canonical `@username ` — the server then
 * resolves it into a stored mention, so what renders as a link is decided
 * server-side, not by this text.
 */
export const MentionInput = forwardRef<
  MentionInputHandle,
  {
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly placeholder?: string;
    readonly maxLength?: number;
    readonly minRows?: number;
    readonly maxRows?: number;
    readonly autoFocus?: boolean;
    readonly disabled?: boolean;
    readonly className?: string;
    readonly ariaLabel?: string;
    /** Enter (without Shift) submits when provided and no suggestion is open. */
    readonly onSubmit?: () => void;
  }
>(function MentionInput(
  { value, onChange, placeholder, maxLength, minRows = 1, maxRows = 10, autoFocus, disabled, className, ariaLabel, onSubmit },
  ref,
) {
  const t = useTranslation();
  const listId = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const query = useDebouncedValue(mention?.query ?? "", 180);

  useImperativeHandle(ref, () => ({ focus: () => area.current?.focus() }), []);

  // Grow with content between minRows and maxRows.
  useEffect(() => {
    const element = area.current;
    if (!element) return;
    element.style.height = "auto";
    const line = parseFloat(getComputedStyle(element).lineHeight) || 20;
    const padding = 16;
    element.style.height = `${Math.min(Math.max(element.scrollHeight, minRows * line + padding), maxRows * line + padding)}px`;
  }, [value, minRows, maxRows]);

  useEffect(() => {
    if (!mention || query.length < 1) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    apiFetch<{ data: Suggestion[] }>(`/api/users/search?q=${encodeURIComponent(query)}&limit=6`, {
      signal: controller.signal,
    })
      .then((response) => {
        setItems(response.data.filter((user) => user.username));
        setActive(0);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query, mention]);

  const insert = (user: Suggestion) => {
    if (!mention || !area.current) return;
    const caret = area.current.selectionStart;
    const next = `${value.slice(0, mention.start)}@${user.username} ${value.slice(caret)}`;
    onChange(maxLength ? next.slice(0, maxLength) : next);
    setMention(null);
    setItems([]);
    const position = mention.start + user.username.length + 2;
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(position, position);
    });
  };

  const open = mention !== null && (items.length > 0 || loading || query.length > 0);

  return (
    <div className={cn("relative w-full", className)}>
      <textarea
        ref={area}
        value={value}
        rows={minRows}
        disabled={disabled}
        autoFocus={autoFocus}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        aria-autocomplete="list"
        aria-controls={open ? listId : undefined}
        aria-expanded={open}
        onChange={(event) => {
          onChange(event.target.value);
          setMention(activeMention(event.target.value, event.target.selectionStart));
        }}
        onClick={(event) => setMention(activeMention(value, event.currentTarget.selectionStart))}
        onBlur={() => setTimeout(() => setMention(null), 150)}
        onKeyDown={(event) => {
          if (open && items.length > 0) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((index) => (index + 1) % items.length);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((index) => (index - 1 + items.length) % items.length);
              return;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault();
              const choice = items[active];
              if (choice) insert(choice);
              return;
            }
          }
          if (event.key === "Escape" && mention) {
            setMention(null);
            return;
          }
          if (onSubmit && event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            onSubmit();
          }
        }}
        className="block w-full resize-none bg-transparent px-3 py-2 text-[14.5px] leading-6 outline-none placeholder:text-muted-foreground disabled:opacity-60"
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute bottom-full left-0 z-50 mb-1 w-72 max-w-[90vw] overflow-hidden rounded-xl border border-border/70 bg-popover p-1 shadow-float"
        >
          {loading && items.length === 0 ? (
            <li className="flex items-center gap-2 px-3 py-2 text-[12.5px] text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> {t("mention.searching")}
            </li>
          ) : items.length === 0 ? (
            <li className="px-3 py-2 text-[12.5px] text-muted-foreground">{t("mention.no_results")}</li>
          ) : (
            items.map((user, index) => (
              <li
                key={user.id}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => {
                  event.preventDefault();
                  insert(user);
                }}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5",
                  index === active && "bg-accent",
                )}
              >
                <UserAvatar name={user.name} image={user.image} size="xs" />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{user.name}</span>
                  <span className="block truncate text-[11.5px] text-muted-foreground">@{user.username}</span>
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
});
