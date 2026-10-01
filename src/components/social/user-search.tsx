"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FollowButton } from "@/components/social/follow-button";
import { apiFetch, toQueryString } from "@/lib/api/client";
import { initials } from "@/lib/utils";

interface SearchUser {
  readonly id: string;
  readonly name: string;
  readonly username: string;
  readonly image: string | null;
  readonly isFollowing: boolean;
}

export function UserSearch() {
  const t = useTranslation();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void apiFetch<{ data: SearchUser[] }>(`/api/users/search${toQueryString({ q: trimmed, limit: 20 })}`)
        .then((response) => { if (!cancelled) setUsers(response.data); })
        .catch(() => { if (!cancelled) { setUsers([]); setError(true); } })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [trimmed, retry]);

  const changeQuery = (value: string) => {
    setQuery(value);
    setUsers([]);
    setError(false);
    setLoading(value.trim().length >= 2);
  };

  return (
    <main id="content" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-8 sm:py-10">
      <header><h1 className="text-2xl font-semibold tracking-tight">{t("search.title")}</h1><p className="mt-1 text-sm text-muted-foreground">{t("search.subtitle")}</p></header>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder={t("search.placeholder")} aria-label={t("search.placeholder")} className="pl-9" />
      </label>
      {trimmed.length < 2 ? <p className="text-sm text-muted-foreground">{t("search.min_chars")}</p> : null}
      {loading ? <p role="status" className="text-sm text-muted-foreground">{t("search.loading")}</p> : null}
      {error ? <Card className="flex items-center justify-between gap-3 p-4"><p className="text-sm text-muted-foreground">{t("search.error")}</p><Button variant="secondary" size="sm" onClick={() => { setLoading(true); setError(false); setUsers([]); setRetry((current) => current + 1); }}>{t("common.retry")}</Button></Card> : null}
      {!loading && !error && trimmed.length >= 2 && users.length === 0 ? <EmptyState icon={Search} title={t("search.empty.title")} description={t("search.empty.body")} /> : null}
      {users.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {users.map((user) => (
            <li key={user.id}>
              <Card className="flex items-center gap-3 p-3 sm:p-4">
                <Link href={`/u/${encodeURIComponent(user.username)}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar className="size-10"><AvatarImage src={user.image ?? undefined} alt="" /><AvatarFallback>{initials(user.name)}</AvatarFallback></Avatar>
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold">{user.name}</span><span className="block truncate text-xs text-muted-foreground">@{user.username}</span></span>
                </Link>
                <FollowButton userId={user.id} initialFollowing={user.isFollowing} compact />
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
