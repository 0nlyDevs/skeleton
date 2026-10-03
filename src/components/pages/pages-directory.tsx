"use client";

import { Eye, FileText, Heart, Lock, Plus, Search } from "lucide-react";
import Link from "@/components/ui/link";
import { useEffect, useRef, useState } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFormatters } from "@/hooks/use-formatters";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { PageList } from "@/modules/pages/pages.service";

import { themeOf } from "./page-themes";

type Item = PageList["data"][number];

function PageCard({ page, owner }: { page: Item; owner: boolean }) {
  const t = useTranslation();
  const fmt = useFormatters();
  const theme = themeOf(page.theme);
  return (
    <Card className="flex flex-col overflow-hidden">
      <Link href={`/p/${encodeURIComponent(page.slug)}`} className="group flex flex-1 flex-col">
        <div className={cn("relative flex h-28 items-end bg-gradient-to-br p-3", theme.swatch)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- authorised file route */}
          {page.cover ? <img src={page.cover.url} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" /> : null}
          {!page.published ? (
            <span className="relative rounded-full bg-black/60 px-2 py-0.5 text-[0.6875rem] font-semibold text-white">{t("pages.draft")}</span>
          ) : page.visibility === "UNLISTED" ? (
            <span className="relative inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[0.6875rem] font-semibold text-white">
              <Lock className="size-3" /> {t("pages.visibility.UNLISTED")}
            </span>
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="line-clamp-2 font-semibold group-hover:underline">{page.title}</p>
          {page.tagline ? <p className="line-clamp-2 text-[0.8125rem] text-muted-foreground">{page.tagline}</p> : null}
          <p className="mt-auto flex items-center gap-3 pt-2 text-[0.75rem] text-muted-foreground">
            {!owner ? <span className="truncate">{page.author.name}</span> : <span>{fmt.relative(page.updatedAt)}</span>}
            <span className="ml-auto inline-flex items-center gap-1"><Eye className="size-3.5" aria-hidden />{page.viewCount}</span>
            <span className="inline-flex items-center gap-1"><Heart className="size-3.5" aria-hidden />{page.likeCount}</span>
          </p>
        </div>
      </Link>
      {owner ? (
        <div className="border-t border-border/60 p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link href={`/pages/${encodeURIComponent(page.slug)}/edit`}>{t("common.edit")}</Link>
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

/** Discover public pages and manage your own. */
export function PagesDirectory({ initialDiscover, mine, signedIn }: { initialDiscover: PageList; mine: PageList | null; signedIn: boolean }) {
  const t = useTranslation();
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [q, setQ] = useState("");
  const [discover, setDiscover] = useState(initialDiscover);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void apiFetch<PageList>(`/api/pages${toQueryString({ scope: "discover", sort, q: q.trim() || undefined, limit: 12 })}`)
        .then(setDiscover)
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [sort, q]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end gap-3">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold tracking-tight">{t("pages.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("pages.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href={signedIn ? "/pages/new" : "/login?next=/pages/new"}>
            <Plus />
            {t("pages.create")}
          </Link>
        </Button>
      </header>

      {mine && mine.data.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[0.9375rem] font-semibold">{t("pages.mine")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.data.map((page) => (
              <li key={page.id} className="flex">
                <PageCard page={page} owner />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-[0.9375rem] font-semibold">{t("pages.discover")}</h2>
          <label className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(event) => setQ(event.target.value)} maxLength={80} placeholder={t("pages.search")} aria-label={t("pages.search")} className="h-9 w-56 pl-8" />
          </label>
          <div className="flex rounded-full bg-surface-muted p-1" role="tablist">
            {(["recent", "popular"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={sort === value}
                onClick={() => setSort(value)}
                className={cn("rounded-full px-3 py-1 text-[0.8125rem] font-semibold", sort === value ? "bg-card shadow-sm" : "text-muted-foreground")}
              >
                {t(value === "recent" ? "pages.sort.recent" : "pages.sort.popular")}
              </button>
            ))}
          </div>
        </div>
        {discover.data.length === 0 ? (
          <EmptyState icon={FileText} title={t("pages.empty_title")} description={t("pages.empty_body")} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {discover.data.map((page) => (
              <li key={page.id} className="flex">
                <PageCard page={page} owner={false} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
