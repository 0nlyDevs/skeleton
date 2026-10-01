/**
 * Discovery for the app shell: contacts (with presence), suggestions and the
 * global search box. Every list is built from public identities only — names,
 * handles, avatars — and every post result goes through the feed's own
 * visibility rules.
 */

import { prisma } from "@/lib/db/prisma";
import type { AuthUser } from "@/types";

import { findActiveGroupIds } from "../groups/groups.repository";
import { listGroups } from "../groups/groups.service";
import type { GroupSummaryDto } from "../groups/groups.dto";
import { listFeed } from "../posts/posts.service";
import type { FeedItemDto } from "../posts/posts.dto";

export interface ContactDto {
  readonly id: string;
  readonly name: string;
  readonly username: string | null;
  readonly image: string | null;
}

const contactSelect = { id: true, name: true, username: true, image: true } as const;

/**
 * People the viewer talks to or follows, most recent conversations first.
 * Feeds the "Contacts" rail, whose dots are driven by `presence:watch`.
 */
export async function listContacts(actor: AuthUser, take = 16): Promise<ContactDto[]> {
  const [dmPeers, following] = await Promise.all([
    prisma.roomMember.findMany({
      where: {
        userId: { not: actor.id },
        user: { banned: false },
        room: { type: "DIRECT", members: { some: { userId: actor.id } } },
      },
      orderBy: { room: { updatedAt: "desc" } },
      take,
      select: { user: { select: contactSelect } },
    }),
    prisma.follow.findMany({
      where: { followerId: actor.id, following: { banned: false } },
      orderBy: { createdAt: "desc" },
      take,
      select: { following: { select: contactSelect } },
    }),
  ]);

  const seen = new Set<string>();
  const contacts: ContactDto[] = [];
  for (const user of [...dmPeers.map((row) => row.user), ...following.map((row) => row.following)]) {
    if (seen.has(user.id)) continue;
    seen.add(user.id);
    contacts.push(user);
    if (contacts.length >= take) break;
  }
  return contacts;
}

export interface SuggestionsDto {
  readonly people: ContactDto[];
  readonly groups: GroupSummaryDto[];
}

/** Popular accounts the viewer does not follow yet, and groups they are not in. */
export async function getSuggestions(actor: AuthUser): Promise<SuggestionsDto> {
  const [people, groups, mine] = await Promise.all([
    prisma.user.findMany({
      where: {
        id: { not: actor.id },
        banned: false,
        username: { not: null },
        followers: { none: { followerId: actor.id } },
      },
      orderBy: [{ followers: { _count: "desc" } }, { createdAt: "desc" }],
      take: 5,
      select: contactSelect,
    }),
    listGroups({ scope: "discover", limit: 12 }, actor),
    findActiveGroupIds(actor.id),
  ]);
  const joined = new Set(mine);
  return { people, groups: groups.filter((group) => !joined.has(group.id)).slice(0, 4) };
}

export interface SearchResultsDto {
  readonly people: ContactDto[];
  readonly groups: GroupSummaryDto[];
  readonly posts: FeedItemDto[];
}

export async function searchEverything(q: string, viewer: AuthUser | null): Promise<SearchResultsDto> {
  const term = q.trim();
  if (term.length < 2) return { people: [], groups: [], posts: [] };

  const [people, groups, posts] = await Promise.all([
    prisma.user.findMany({
      where: {
        banned: false,
        username: { not: null },
        OR: [{ name: { contains: term } }, { username: { contains: term.toLowerCase() } }],
      },
      take: 6,
      select: contactSelect,
    }),
    listGroups({ scope: "discover", q: term, limit: 5 }, viewer),
    listFeed({ q: term, limit: 8, scope: "all" }, viewer),
  ]);
  return { people, groups, posts: posts.data };
}

export interface ShellRailDto {
  readonly followers: number;
  readonly following: number;
  readonly posts: number;
  readonly groups: ReadonlyArray<{ slug: string; name: string; privacy: "PUBLIC" | "PRIVATE" }>;
}

/** Left-rail data for the signed-in user, in four light queries. */
export async function getShellRail(userId: string): Promise<ShellRailDto> {
  const [followers, following, posts, groups] = await Promise.all([
    prisma.follow.count({ where: { followingId: userId, follower: { banned: false } } }),
    prisma.follow.count({ where: { followerId: userId, following: { banned: false } } }),
    prisma.post.count({ where: { userId, published: true, deletedAt: null } }),
    prisma.groupMember.findMany({
      where: { userId, status: "ACTIVE", group: { deletedAt: null } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { group: { select: { slug: true, name: true, privacy: true } } },
    }),
  ]);
  return { followers, following, posts, groups: groups.map((row) => row.group) };
}
