/**
 * Post response shape.
 *
 * The DTO is the whitelist. Nothing is spread from the database row, so adding
 * a column to `Post` — a moderation flag, an internal note — cannot start
 * leaking through the API by default. The author is reduced to the three fields
 * the UI actually renders; an email address never appears in a post payload.
 */

import type { ReactionCounts, ReactionType } from "@/types";

import type { PostWithAuthor } from "./posts.repository";

export interface PostAuthorDto {
  readonly id: string;
  readonly name: string;
  readonly username: string | null;
  readonly image: string | null;
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
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

/** A post as the feed renders it: counters per reaction and the viewer's own. */
export interface FeedItemDto extends PostDto {
  readonly reactions: ReactionCounts;
  /** `null` for guests and for viewers who have not reacted. */
  readonly viewerReaction: ReactionType | null;
}

/** The live counters pushed to every viewer of a post or of the feed. */
export interface PostEngagementDto {
  readonly postId: string;
  readonly commentCount: number;
  readonly reactionCount: number;
  readonly reactions: ReactionCounts;
}

export function toFeedItemDto(
  row: PostWithAuthor,
  reactions: ReactionCounts,
  viewerReaction: ReactionType | null,
): FeedItemDto {
  return { ...toPostDto(row), reactions, viewerReaction };
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

export function toPostDtos(rows: readonly PostWithAuthor[]): PostDto[] {
  return rows.map(toPostDto);
}
