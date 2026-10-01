"use client";

import { Loader2, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { SearchResultsDto } from "@/modules/discovery/discovery.service";

import { UserAvatar } from "./user-avatar";

/** Header search: debounced live results, Enter for the full results page. */
export function GlobalSearch({ className }: { readonly className?: string }) {
  const t = useTranslation();
  const router = useRouter();
  const listId = useId();
  const pathname = usePathname();
  const params = useSearchParams();
  // On the results page the box shows the current query, so it is obvious
  // where the results live and that typing refines them.
  const [q, setQ] = useState(() => (pathname === "/search" ? (params.get("q") ?? "") : ""));
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResultsDto | null>(null);
  const [loading, setLoading] = useState(false);
  const term = useDebouncedValue(q.trim(), 250);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (term.length < 2) {
      setResults(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    apiFetch<{ data: SearchResultsDto }>(`/api/search?q=${encodeURIComponent(term)}`, { signal: controller.signal })
      .then((response) => setResults(response.data))
      .catch(() => undefined)
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [term]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    if (!href.startsWith("/search")) setQ("");
    router.push(href);
  };

  const empty = results && results.people.length + results.groups.length + results.posts.length === 0;

  return (
    <div ref={box} className={cn("relative w-full max-w-md", className)}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (q.trim().length >= 2) go(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder={t("nav.search_placeholder")}
          aria-label={t("nav.search_placeholder")}
          aria-controls={listId}
          aria-expanded={open && term.length >= 2}
          className="h-10 w-full rounded-full border border-transparent bg-surface-muted pl-10 pr-10 text-[14px] outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/40 focus:bg-surface"
        />
        {loading ? (
          <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </form>

      {open && q.trim().length > 0 && q.trim().length < 2 ? (
        <div className="absolute left-0 right-0 top-12 z-50 rounded-2xl border border-border/70 bg-popover px-4 py-3 text-[13px] text-muted-foreground shadow-float">
          {t("search.hint")}
        </div>
      ) : null}
      {open && term.length >= 2 && results ? (
        <div
          id={listId}
          className="absolute left-0 right-0 top-12 z-50 max-h-[70dvh] overflow-y-auto rounded-2xl border border-border/70 bg-popover p-2 shadow-float"
        >
          {empty ? (
            <p className="px-3 py-4 text-center text-[13px] text-muted-foreground">{t("search.empty", { q: term })}</p>
          ) : null}
          {results.people.length > 0 ? (
            <Section label={t("search.people")}>
              {results.people.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => person.username && go(`/profile/${encodeURIComponent(person.username)}`)}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-surface-muted"
                >
                  <UserAvatar name={person.name} image={person.image} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold">{person.name}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">@{person.username}</span>
                  </span>
                </button>
              ))}
            </Section>
          ) : null}
          {results.groups.length > 0 ? (
            <Section label={t("search.groups")}>
              {results.groups.map((group) => (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => go(`/groups/${group.slug}`)}
                  className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-surface-muted"
                >
                  <span className="grid size-9 place-items-center rounded-xl bg-accent text-[13px] font-bold text-accent-foreground">
                    {group.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 truncate text-[13.5px] font-semibold">{group.name}</span>
                </button>
              ))}
            </Section>
          ) : null}
          {results.posts.length > 0 ? (
            <Section label={t("search.posts")}>
              {results.posts.slice(0, 4).map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => go(`/feed/${post.id}`)}
                  className="block w-full rounded-xl px-2.5 py-2 text-left hover:bg-surface-muted"
                >
                  <span className="block truncate text-[13px] font-medium">{post.body || post.title}</span>
                  <span className="block text-[11.5px] text-muted-foreground">{post.author.name}</span>
                </button>
              ))}
            </Section>
          ) : null}
          {!empty ? (
            <Link
              href={`/search?q=${encodeURIComponent(term)}`}
              onClick={() => setOpen(false)}
              className="mt-1 block rounded-xl px-3 py-2 text-center text-[13px] font-medium text-primary hover:bg-accent"
            >
              {t("search.all_results")}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function Section({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="py-1">
      <p className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}
