"use client";

import { Lock, Search } from "lucide-react";
import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { GroupAvatar } from "@/components/groups/group-avatar";
import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { SearchResultsDto } from "@/modules/discovery/discovery.service";
import type { PeopleRole } from "@/modules/follows/follows.schema";
import type { FeedItemDto } from "@/modules/posts/posts.dto";

import { CommentsDialog } from "./comments-dialog";
import { RoleBadge, RoleFilterChips } from "./role-filter";
import { PostCard } from "./post-card";

export function SearchResults({
  q,
  role,
  everyone,
  results,
  viewer,
}: {
  readonly q: string;
  /** "Everyone" is chosen: the whole list, a page at a time. */
  readonly everyone: boolean;
  /** Filter on people by platform role. */
  readonly role: PeopleRole | null;
  readonly results: SearchResultsDto;
  readonly viewer: { id: string; name: string; image: string | null } | null;
}) {
  const t = useTranslation();
  const router = useRouter();
  const [posts, setPosts] = useState(results.posts);
  const [typed, setTyped] = useState(q);
  const go = (next: { q?: string; role?: PeopleRole | null; everyone?: boolean; page?: number }) => {
    const params = new URLSearchParams();
    const text = (next.q ?? q).trim();
    const nextRole = next.role === undefined ? role : next.role;
    const nextEveryone = next.everyone === undefined ? everyone : next.everyone;
    if (text) params.set("q", text);
    if (nextRole) params.set("role", nextRole);
    else if (nextEveryone) params.set("all", "1");
    if (next.page && next.page > 1) params.set("page", String(next.page));
    router.push(`/search${params.size ? `?${params.toString()}` : ""}`);
  };
  // The chip "Tout le monde" lists everyone; a role lists that role; none of them waits for a name.
  const chosen: PeopleRole | "all" | null = role ?? (everyone ? "all" : null);
  const setRole = (next: PeopleRole | null) => go(next ? { role: next, everyone: false, page: 1 } : { role: null, everyone: true, page: 1 });
  const [commentsFor, setCommentsFor] = useState<FeedItemDto | null>(null);
  const empty = results.people.length + results.groups.length + results.services.length + posts.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          go({ q: typed, page: 1 });
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            maxLength={80}
            aria-label={t("search.title")}
            placeholder={t("tn.search.placeholder")}
            className="h-12 w-full rounded-full bg-card pl-11 pr-4 text-[0.9375rem] shadow-panel outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          />
        </div>
        <Button type="submit" size="lg">{t("tn.search.go")}</Button>
      </form>
      {viewer ? (
        <div className="flex flex-col gap-1.5 px-1">
          <RoleFilterChips value={chosen === "all" ? null : role} onChange={setRole} everyoneActive={chosen === "all"} />
          <p className="text-[0.75rem] text-muted-foreground">{t("tn.people.role.hint")}</p>
        </div>
      ) : null}
      {q.trim().length < 2 && !role && !everyone ? <p className="text-center text-[0.8438rem] text-muted-foreground">{t("search.hint")}</p> : null}
      {(q.trim().length >= 2 || role || everyone) && empty ? <p className="text-center text-[0.8438rem] text-muted-foreground">{q ? t("search.empty", { q }) : t("tn.people.role.empty")}</p> : null}

      {results.services.length > 0 ? (
        <Card className="p-4">
          <h2 className="mb-2 text-[0.9375rem] font-semibold">{t("tn.search.services")}</h2>
          <ul className="grid gap-1 sm:grid-cols-3">
            {results.services.map((service) => (
              <li key={service.slug}>
                <Link href={`/services/${service.slug}`} className="flex h-full flex-col gap-0.5 rounded-xl p-2 hover:bg-surface-muted">
                  <span className="text-[0.875rem] font-semibold">{service.name}</span>
                  <span className="line-clamp-2 text-[0.7812rem] text-muted-foreground">{service.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {results.people.length > 0 ? (
        <Card className="p-4">
          <h2 className="mb-2 text-[0.9375rem] font-semibold">
            {t("search.people")}
            {results.peopleTotal > results.people.length || results.pageCount > 1 ? <span className="ml-2 font-normal text-muted-foreground">{t("tn.search.total", { count: results.peopleTotal })}</span> : null}
          </h2>
          <ul className="grid gap-1 sm:grid-cols-2">
            {results.people.map((person) => (
              <li key={person.id}>
                <Link href={`/profile/${person.username}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-muted">
                  <UserAvatar name={person.name} image={person.image} size="md" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 truncate text-[0.875rem] font-semibold">
                      {person.name}
                      <RoleBadge role={person.role} showCitizen={role === "USER"} />
                    </span>
                    <span className="block truncate text-[0.7812rem] text-muted-foreground">@{person.username}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {results.pageCount > 1 ? (
            <nav className="mt-3 flex items-center justify-between gap-2" aria-label={t("common.page")}>
              <Button type="button" size="sm" variant="secondary" disabled={results.page <= 1} onClick={() => go({ page: results.page - 1 })}>{t("common.previous")}</Button>
              <span className="text-sm text-muted-foreground">{t("tn.page_of", { page: results.page, count: results.pageCount })}</span>
              <Button type="button" size="sm" variant="secondary" disabled={results.page >= results.pageCount} onClick={() => go({ page: results.page + 1 })}>{t("common.next")}</Button>
            </nav>
          ) : null}
        </Card>
      ) : null}

      {results.groups.length > 0 ? (
        <Card className="p-4">
          <h2 className="mb-2 text-[0.9375rem] font-semibold">{t("search.groups")}</h2>
          <ul className="grid gap-1 sm:grid-cols-2">
            {results.groups.map((group) => (
              <li key={group.id}>
                <Link href={`/groups/${group.slug}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-muted">
                  <GroupAvatar name={group.name} size="sm" />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 truncate text-[0.875rem] font-semibold">
                      {group.name}
                      {group.privacy === "PRIVATE" ? <Lock className="size-3 text-muted-foreground" /> : null}
                    </span>
                    <span className="block text-[0.7812rem] text-muted-foreground">{t("groups.members", { count: group.memberCount })}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {posts.length > 0 ? <h2 className="px-1 text-[0.9375rem] font-semibold">{t("search.posts")}</h2> : null}
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          viewer={viewer}
          onChange={(next) => setPosts((current) => current.map((entry) => (entry.id === next.id ? next : entry)))}
          onRemoved={(id) => setPosts((current) => current.filter((entry) => entry.id !== id))}
          onOpenComments={setCommentsFor}
        />
      ))}
      <CommentsDialog post={commentsFor} viewer={viewer} canComment={commentsFor?.viewerCanInteract ?? false} onOpenChange={(open) => !open && setCommentsFor(null)} />
    </div>
  );
}
