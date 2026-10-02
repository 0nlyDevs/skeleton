/**
 * Comment response shape. A removed comment keeps its place in the thread
 * (its replies still make sense) but loses its body and author.
 */

import { toMentionDtos, type MentionDto } from "../mentions/mentions.service";
import { REACTION_TYPES, type ReactionType } from "@/types";
import type { GroupStaffRole } from "../groups/groups.repository";
import type { CommentRow } from "./comments.repository";

export interface CommentAuthorDto {
  readonly id: string;
  readonly name: string;
  readonly username: string | null;
  readonly image: string | null;
  /** Owner/admin/moderator of the post's group, so readers know who speaks for it. */
  readonly groupRole?: GroupStaffRole;
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
  /** Who reacted with what (public, like post reactions). */
  readonly reactions: readonly { readonly type: ReactionType; readonly userIds: readonly string[] }[];
}

export function toCommentDto(
  row: CommentRow,
  replies: CommentDto[] = [],
  roles: ReadonlyMap<string, GroupStaffRole> = new Map(),
): CommentDto {
  const groupRole = roles.get(row.user.id);
  const deleted = row.deletedAt !== null;
  return {
    id: row.id,
    postId: row.postId,
    parentId: row.parentId,
    body: deleted ? "" : row.body,
    deleted,
    author: deleted
      ? null
      : {
          id: row.user.id,
          name: row.user.name,
          username: row.user.username,
          image: row.user.image,
          ...(groupRole ? { groupRole } : {}),
        },
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    replies,
    mentions: deleted ? [] : toMentionDtos(row.mentions),
    reactions: deleted ? [] : groupCommentReactions(row.reactions),
  };
}

function groupCommentReactions(rows: readonly { userId: string; type: string }[]) {
  const byType = new Map<ReactionType, string[]>();
  for (const row of rows) {
    if (!(REACTION_TYPES as readonly string[]).includes(row.type)) continue;
    const type = row.type as ReactionType;
    byType.set(type, [...(byType.get(type) ?? []), row.userId]);
  }
  return [...byType].map(([type, userIds]) => ({ type, userIds }));
}

