/**
 * Post response shape.
 *
 * The DTO is the whitelist. Nothing is spread from the database row, so adding
 * a column to `Post` — a moderation flag, an internal note — cannot start
 * leaking through the API by default. The author is reduced to the three fields
 * the UI actually renders; an email address never appears in a post payload.
 */

import type { ReactionCounts, ReactionType } from "@/types";
import type { GroupStaffRole } from "../groups/groups.repository";
import { toPollDto, type PollDto } from "../polls/polls.dto";

import { toMentionDtos, type MentionDto } from "../mentions/mentions.service";

import type { PostWithAuthor } from "./posts.repository";

export interface PostAuthorDto {
  readonly id: string;
  readonly name: string;
  readonly username: string | null;
  readonly image: string | null;
}

export interface PostMediaDto {
  readonly id: string;
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface PostGroupDto {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly privacy: "PUBLIC" | "PRIVATE";
}

/** The shared original, embedded in a repost. `null` content when it is gone. */
export interface RepostedPostDto {
  readonly id: string;
  /** False once the original was removed or its group became private. */
  readonly available: boolean;
  readonly body: string;
  readonly author: PostAuthorDto | null;
  readonly media: PostMediaDto[];
  readonly mentions: MentionDto[];
  readonly group: PostGroupDto | null;
  readonly createdAt: string | null;
}

export interface PostDto {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly tags: string[];
  readonly published: boolean;
  readonly author: PostAuthorDto;
  readonly commentCount: number;
  readonly reactionCount: number;
  readonly media: PostMediaDto[];
  readonly mentions: MentionDto[];
  readonly group: PostGroupDto | null;
  readonly repostOf: RepostedPostDto | null;
  /** Set when the post was a share whose original no longer exists at all. */
  readonly wasRepost: boolean;
  readonly shareCount: number;
  readonly poll: PollDto | null;
  readonly location: { readonly name: string; readonly latitude: number; readonly longitude: number } | null;
  readonly editedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

/** A post as the feed renders it: counters per reaction and the viewer's own. */
export interface FeedItemDto extends PostDto {
  readonly reactions: ReactionCounts;
  /** `null` for guests and for viewers who have not reacted. */
  readonly viewerReaction: ReactionType | null;
  /** Whether the viewer may remove it as a moderator (group or platform). */
  readonly viewerCanModerate: boolean;
  /** Whether the viewer may react and comment (signed in; member if in a group). */
  readonly viewerCanInteract: boolean;
  /** Whether the viewer saved it (private to the viewer). */
  readonly viewerSaved: boolean;
  /** The author's staff role in the post's group (owner/admin/moderator), else `null`. */
  readonly authorGroupRole: GroupStaffRole | null;
  /** Poll option ids the viewer voted for (empty when none or no poll). */
  readonly viewerPollVotes: readonly string[];
}

/** The live counters pushed to every viewer of a post or of the feed. */
export interface PostEngagementDto {
  readonly postId: string;
  readonly commentCount: number;
  readonly reactionCount: number;
  readonly shareCount: number;
  readonly reactions: ReactionCounts;
  /** Live poll totals, when the post has a poll. */
  readonly poll: PollDto | null;
}

export function toFeedItemDto(
  row: PostWithAuthor,
  reactions: ReactionCounts,
  viewerReaction: ReactionType | null,
  viewerCanModerate = false,
  viewerCanInteract = false,
  viewerSaved = false,
  viewerPollVotes: readonly string[] = [],
  authorGroupRole: GroupStaffRole | null = null,
): FeedItemDto {
  return {
    ...toPostDto(row),
    reactions,
    viewerReaction,
    viewerCanModerate,
    viewerCanInteract,
    viewerSaved,
    viewerPollVotes,
    authorGroupRole,
  };
}

/** `tags` is a `Json` column, so it arrives untyped. Normalize on the way out. */
export function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string").slice(0, 50);
}

export function toPostDto(row: PostWithAuthor): PostDto {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    tags: normalizeTags(row.tags),
    published: row.published,
    author: {
      id: row.user.id,
      name: row.user.name,
      username: row.user.username,
      image: row.user.image,
    },
    commentCount: row.commentCount,
    reactionCount: row.reactionCount,
    media: row.media.map(({ upload }) => ({
      id: upload.id,
      url: `/api/files/${upload.id}`,
      width: upload.width,
      height: upload.height,
    })),
    mentions: toMentionDtos(row.mentions),
    group: row.group
      ? { id: row.group.id, slug: row.group.slug, name: row.group.name, privacy: row.group.privacy }
      : null,
    repostOf: row.repostOf ? toRepostedDto(row.repostOf) : null,
    wasRepost: false,
    shareCount: row.shareCount,
    poll: row.poll ? toPollDto(row.poll) : null,
    location:
      row.placeName && row.latitude !== null && row.longitude !== null
        ? { name: row.placeName, latitude: row.latitude, longitude: row.longitude }
        : null,
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

export function toPostDtos(rows: readonly PostWithAuthor[]): PostDto[] {
  return rows.map(toPostDto);
}

type RepostRow = NonNullable<PostWithAuthor["repostOf"]>;

/**
 * Only an original that is still public is embedded with its content; a
 * removed one, or one whose group turned private, becomes a placeholder so a
 * share can never be used to read content its viewer could not open.
 */
function toRepostedDto(row: RepostRow): RepostedPostDto {
  const available =
    row.published && row.deletedAt === null && (row.group === null || (row.group.privacy === "PUBLIC" && row.group.deletedAt === null));
  if (!available) {
    return { id: row.id, available: false, body: "", author: null, media: [], mentions: [], group: null, createdAt: null };
  }
  return {
    id: row.id,
    available: true,
    body: row.body,
    author: { id: row.user.id, name: row.user.name, username: row.user.username, image: row.user.image },
    media: row.media.map(({ upload }) => ({ id: upload.id, url: `/api/files/${upload.id}`, width: upload.width, height: upload.height })),
    mentions: toMentionDtos(row.mentions),
    group: row.group ? { id: row.group.id, slug: row.group.slug, name: row.group.name, privacy: row.group.privacy } : null,
    createdAt: row.createdAt.toISOString(),
  };
}
