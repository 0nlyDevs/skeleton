"use client";

import { FileText, Filter, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/loading-skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch, ApiRequestError, toQueryString } from "@/lib/api/client";
import { formatRelative } from "@/lib/format";
import type { ListMeta } from "@/types";
import type { PostDto } from "@/modules/posts/posts.dto";
import { initials } from "@/lib/utils";

const PAGE_SIZE = 10;

type Scope = "all" | "mine" | "drafts" | "published";

const SORT_OPTIONS = ["createdAt", "updatedAt", "title"] as const;

/**
 * Posts list.
 *
 * The four filters are stacked in one toolbar: scope tabs, search, sort, page
 * size. Every control resets the page to 1 when it changes — the classic bug
 * where changing the sort on page 4 lands on an empty page 4 is prevented here,
 * once, instead of in every handler.
 *
 * Fetching is a single `useEffect` keyed on the whole filter set. Debouncing the
 * search input by 300ms keeps typing from firing a request per keystroke.
 */
export function PostList({
  canModerate,
}: {
  readonly canModerate: boolean;
}) {
  const t = useTranslation();

  const [scope, setScope] = useState<Scope>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<PostDto[]>([]);
  const [meta, setMeta] = useState<ListMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce the free-text field only; the other filters apply immediately.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [scope, debouncedSearch, sort, order]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch<{ data: PostDto[]; meta: ListMeta }>(
        `/api/posts${toQueryString({
          page,
          limit: PAGE_SIZE,
          sort,
          order,
          ...(scope === "mine" ? { mine: true } : {}),
          ...(scope === "drafts" ? { mine: true, published: false } : {}),
          ...(scope === "published" ? { published: true } : {}),
          ...(debouncedSearch ? { q: debouncedSearch } : {}),
        })}`,
      );

      setItems(response.data);
      setMeta(response.meta);
    } catch (caught) {
      setError(caught instanceof ApiRequestError ? caught.code : "INTERNAL_ERROR");
    } finally {
      setLoading(false);
    }
  }, [page, scope, debouncedSearch, sort, order]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = meta?.totalPages ?? 1;

  const scopeTabs = useMemo(
    () =>
      [
        { value: "all", label: t("posts.filter.all") },
        { value: "mine", label: t("posts.filter.mine") },
        { value: "published", label: t("posts.filter.published") },
        { value: "drafts", label: t("posts.filter.drafts") },
      ] as const,
    [t],
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-semibold tracking-[-0.015em]">{t("posts.title")}</h1>
          <p className="text-[14px] text-muted-foreground">{t("posts.subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/posts/new">
            <Plus />
            {t("posts.new")}
          </Link>
        </Button>
      </header>

      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <Tabs value={scope} onValueChange={(value) => setScope(value as Scope)}>
            <TabsList>
              {scopeTabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("posts.search_placeholder")}
                className="pl-9 pr-8"
                aria-label={t("common.search")}
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label={t("common.reset")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Select
                value={`${sort}:${order}`}
                onValueChange={(value) => {
                  const [nextSort, nextOrder] = value.split(":");
                  setSort(nextSort as (typeof SORT_OPTIONS)[number]);
                  setOrder(nextOrder === "asc" ? "asc" : "desc");
                }}
              >
                <SelectTrigger className="w-full sm:w-44" aria-label={t("common.filter")}>
                  <Filter className="size-4 opacity-60" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.flatMap((option) =>
                    ["desc", "asc"].map((direction) => (
                      <SelectItem key={`${option}:${direction}`} value={`${option}:${direction}`}>
                        {option === "title"
                          ? direction === "asc"
                            ? "A → Z"
                            : "Z → A"
                          : direction === "desc"
                            ? option === "createdAt"
                              ? "Récentes d'abord"
                              : "Modifiées d'abord"
                            : option === "createdAt"
                              ? "Anciennes d'abord"
                              : "Modifiées avant"}
                      </SelectItem>
                    )),
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : error ? (
        <ErrorState code={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={t("posts.empty.title")}
          description={t("posts.empty.body")}
          action={
            <Button asChild size="sm">
              <Link href="/posts/new">{t("posts.new")}</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((post) => (
            <li key={post.id}>
              <Link href={`/posts/${post.id}`} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                <Card className="p-5 transition-[border-color,box-shadow] duration-[var(--duration-normal)] hover:border-primary/30 hover:shadow-panel">
                  <article className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {!post.published ? (
                        <Badge variant="warning">{t("posts.status.draft")}</Badge>
                      ) : null}
                      {post.deletedAt ? (
                        <Badge variant="error">{t("posts.status.deleted")}</Badge>
                      ) : null}
                      {post.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="neutral">
                          {tag}
                        </Badge>
                      ))}
                      {post.tags.length > 3 ? (
                        <Badge variant="neutral">+{post.tags.length - 3}</Badge>
                      ) : null}
                    </div>

                    <h2 className="text-[16px] font-semibold tracking-tight">{post.title}</h2>

                    <p className="line-clamp-2 text-[13.5px] leading-relaxed text-muted-foreground">
                      {post.body}
                    </p>

                    <footer className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">
                      <Avatar className="size-5">
                        {post.author.image ? <AvatarImage src={post.author.image} alt="" /> : null}
                        <AvatarFallback className="text-[9px]">
                          {initials(post.author.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground/80">{post.author.name}</span>
                      <span aria-hidden>·</span>
                      <time dateTime={post.createdAt}>{formatRelative(post.createdAt)}</time>
                      {canModerate && post.deletedAt ? (
                        <span className="ml-auto font-medium text-error">deleted</span>
                      ) : null}
                    </footer>
                  </article>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {t("common.previous")}
          </Button>
          <span className="text-[13px] tabular-nums text-muted-foreground">
            {t("common.page")} {page} {t("common.of")} {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            {t("common.next")}
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
