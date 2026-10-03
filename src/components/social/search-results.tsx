"use client";

import { Lock, Search } from "lucide-react";
import Link from "@/components/ui/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { GroupAvatar } from "@/components/groups/group-avatar";
import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
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
  results,
  viewer,
}: {
  readonly q: string;
  /** Filter on people by platform role. */
  readonly role: PeopleRole | null;
  readonly results: SearchResultsDto;
  readonly viewer: { id: string; name: string; image: string | null } | null;
}) {
  const t = useTranslation();
  const router = useRouter();
  const [posts, setPosts] = useState(results.posts);
  const setRole = (next: PeopleRole | null) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (next) params.set("role", next);
    router.push(`/search${params.size ? `?${params.toString()}` : ""}`);
  };
  const [commentsFor, setCommentsFor] = useState<FeedItemDto | null>(null);
  const empty = results.people.length + results.groups.length + posts.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center gap-3 p-5">
        <Search className="size-5 text-muted-foreground" />
        <h1 className="text-[1.25rem] font-bold tracking-tight">{q ? `${t("search.title")} · « ${q} »` : t("search.title")}</h1>
      </Card>
      {viewer ? (
        <div className="flex flex-col gap-1.5 px-1">
          <RoleFilterChips value={role} onChange={setRole} />
          <p className="text-[0.75rem] text-muted-foreground">{t("tn.people.role.hint")}</p>
        </div>
      ) : null}
      {q.trim().length < 2 && !role ? <p className="text-center text-[0.8438rem] text-muted-foreground">{t("search.hint")}</p> : null}
      {(q.trim().length >= 2 || role) && empty ? <p className="text-center text-[0.8438rem] text-muted-foreground">{q ? t("search.empty", { q }) : t("tn.people.role.empty")}</p> : null}

      {results.people.length > 0 ? (
        <Card className="p-4">
          <h2 className="mb-2 text-[0.9375rem] font-semibold">{t("search.people")}</h2>
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
