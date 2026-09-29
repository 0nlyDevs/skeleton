/**
 * Post response shape.
 *
 * The DTO is the whitelist. Nothing is spread from the database row, so adding
 * a column to `Post` — a moderation flag, an internal note — cannot start
 * leaking through the API by default. The author is reduced to the three fields
 * the UI actually renders; an email address never appears in a post payload.
 */

import type { PostWithAuthor } from "./posts.repository";

export interface PostAuthorDto {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

export interface PostDto {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly tags: string[];
  readonly published: boolean;
  readonly author: PostAuthorDto;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
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
      image: row.user.image,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

export function toPostDtos(rows: readonly PostWithAuthor[]): PostDto[] {
  return rows.map(toPostDto);
}
