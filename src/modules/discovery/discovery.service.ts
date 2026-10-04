/**
 * Discovery for the app shell: contacts (with presence), suggestions and the
 * global search box. Every list is built from public identities only — names,
 * handles, avatars — and every post result goes through the feed's own
 * visibility rules.
 */

import { listServices } from "../city-services/city-services.service";
import { scoreServices, wordMatch, wordsOf } from "../orientation/orientation.score";
import { prisma } from "@/lib/db/prisma";
import type { AuthUser } from "@/types";

import { findActiveGroupIds } from "../groups/groups.repository";
import { listGroups } from "../groups/groups.service";
import type { GroupSummaryDto } from "../groups/groups.dto";
import { listFeed } from "../posts/posts.service";
import { semanticSearch } from "../recommendations/recommendations.service";
import type { FeedItemDto } from "../posts/posts.dto";

export interface ContactDto {
  readonly id: string;
  readonly name: string;
  readonly username: string | null;
  readonly image: string | null;
  /** Citizen, city agent or administrator. */
  readonly role?: "USER" | "AGENT" | "ADMIN";
}

const contactSelect = { id: true, name: true, username: true, image: true } as const;
const personSelect = { ...contactSelect, role: true } as const;

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
  /** City services close to the words typed, mistakes tolerated. */
  readonly services: { slug: string; name: string; summary: string }[];
  readonly peopleTotal: number;
  readonly page: number;
  readonly pageCount: number;
}

const EMPTY_RESULTS: SearchResultsDto = { people: [], groups: [], posts: [], services: [], peopleTotal: 0, page: 1, pageCount: 1 };
const PEOPLE_PAGE = 24;

export interface SearchOptions {
  readonly role?: "USER" | "AGENT" | "ADMIN" | undefined;
  /** List everyone, a page at a time. */
  readonly everyone?: boolean | undefined;
  readonly page?: number | undefined;
}

/** Folded words of a name, for matching typed words that are slightly off. */
function nameWords(text: string): string[] {
  return wordsOf(text).concat(text.toLowerCase().split(/\W+/).filter((word) => word.length > 1));
}

export async function searchEverything(q: string, viewer: AuthUser | null, options: SearchOptions = {}): Promise<SearchResultsDto> {
  const term = q.trim();
  // Listing staff accounts by role is for signed-in residents only: an
  // anonymous visitor must not get a ready-made list of administrators.
  const role = viewer ? options.role : undefined;
  const everyone = viewer !== null && options.everyone === true;
  const page = Math.max(1, Math.min(500, Math.floor(options.page ?? 1)));
  const searching = term.length >= 2;
  if (!searching && !role && !everyone) return EMPTY_RESULTS;

  const peopleWhere = {
    banned: false,
    username: { not: null },
    ...(role ? { role } : {}),
    ...(searching ? { OR: [{ name: { contains: term } }, { username: { contains: term.toLowerCase() } }, { displayUsername: { contains: term } }] } : {}),
  } as const;
  const pageSize = searching && !role && !everyone ? 6 : PEOPLE_PAGE;
  const [people, peopleTotal, groups, keyword, semantic, services] = await Promise.all([
    viewer || searching
      ? prisma.user.findMany({ where: peopleWhere, orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize, select: personSelect })
      : Promise.resolve([]),
    viewer || searching ? prisma.user.count({ where: peopleWhere }) : Promise.resolve(0),
    searching ? listGroups({ scope: "discover", q: term, limit: 5 }, viewer) : Promise.resolve([]),
    searching ? listFeed({ q: term, limit: 8, scope: "all" }, viewer) : Promise.resolve({ data: [] as FeedItemDto[] }),
    searching ? semanticSearch(term, viewer, 8).catch(() => [] as FeedItemDto[]) : Promise.resolve([] as FeedItemDto[]),
    searching ? matchingServices(term) : Promise.resolve([]),
  ]);

  let found = people;
  let total = peopleTotal;
  // A name typed with a mistake still finds the person: compare word by word, tolerating a slip.
  if (searching && found.length === 0 && !role) {
    const typed = wordsOf(term);
    if (typed.length > 0) {
      const pool = await prisma.user.findMany({ where: { banned: false, username: { not: null } }, take: 600, select: personSelect });
      found = pool
        .map((person) => {
          const words = nameWords(`${person.name} ${person.username ?? ""}`);
          const score = typed.reduce((sum, word) => sum + Math.max(0, ...words.map((target) => wordMatch(word, target))), 0);
          return { person, score };
        })
        .filter((entry) => entry.score >= typed.length * 0.6)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)
        .map((entry) => entry.person);
      total = found.length;
    }
  }

  // Exact matches first, then meaning-based neighbours ("vacances" finds "plage").
  const seen = new Set<string>();
  const posts = [...keyword.data, ...semantic].filter((post) => !seen.has(post.id) && seen.add(post.id)).slice(0, 12);
  return { people: found, groups, posts, services, peopleTotal: total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

async function matchingServices(term: string): Promise<{ slug: string; name: string; summary: string }[]> {
  const services = (await listServices({}, null, "fr")).filter((service) => service.active);
  const pool = services.map(({ slug, name, category, summary, description, howTo, emergency }) => ({ slug, name, category, summary, description, howTo, emergency }));
  const scored = scoreServices(term, pool);
  const best = scored[0]?.score ?? 0;
  const second = scored[1]?.score ?? 0;
  if (best < 2.2 && !(best >= 1.3 && best >= second * 1.4)) return [];
  return scored
    .filter((entry) => entry.score >= Math.min(2.2, best * 0.6))
    .slice(0, 3)
    .flatMap((entry) => services.filter((service) => service.slug === entry.slug).map(({ slug, name, summary }) => ({ slug, name, summary })));
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
