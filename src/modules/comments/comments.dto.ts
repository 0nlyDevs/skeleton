/**
 * Comment response shape. A removed comment keeps its place in the thread
 * (its replies still make sense) but loses its body and author.
 */

import { toMentionDtos, type MentionDto } from "../mentions/mentions.service";
import type { CommentRow } from "./comments.repository";

export interface CommentAuthorDto {
  readonly id: string;
  readonly name: string;
  readonly username: string | null;
  readonly image: string | null;
}

export interface CommentDto {
  readonly id: string;
  readonly postId: string;
  readonly parentId: string | null;
  readonly body: string;
  readonly deleted: boolean;
  readonly author: CommentAuthorDto | null;
  readonly createdAt: string;
  readonly editedAt: string | null;
  readonly replies: CommentDto[];
  readonly mentions: MentionDto[];
}

export function toCommentDto(row: CommentRow, replies: CommentDto[] = []): CommentDto {
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    postId: row.postId,
    parentId: row.parentId,
    body: deleted ? "" : row.body,
    deleted,
    author: deleted
      ? null
      : { id: row.user.id, name: row.user.name, username: row.user.username, image: row.user.image },
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    replies,
    mentions: deleted ? [] : toMentionDtos(row.mentions),
  };
}
