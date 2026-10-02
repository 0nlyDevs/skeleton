/**
 * Structured mentions.
 *
 * `@handle` tokens are resolved to accounts when content is written and stored
 * as `Mention` rows, so rendering never guesses from raw text: only handles
 * that resolved (to an active, non-banned account allowed to see the content)
 * become links and notifications. A mention of someone who cannot read a
 * private group's post is silently not stored — mentioning must never become a
 * way to leak content or to ping arbitrary users from a closed space.
 */

import { prisma } from "@/lib/db/prisma";
import { extractMentions } from "@/lib/mentions";

import { findActiveUsersByUsernames } from "../users/users.repository";

export interface MentionDto {
  readonly userId: string;
  readonly username: string;
  readonly name: string;
}

export const mentionSelect = {
  mentionedUser: { select: { id: true, username: true, name: true, banned: true } },
} as const;

export function toMentionDtos(
  rows: ReadonlyArray<{ mentionedUser: { id: string; username: string | null; name: string; banned: boolean } }>,
): MentionDto[] {
  return rows
    .filter((row) => row.mentionedUser.username && !row.mentionedUser.banned)
    .map((row) => ({
      userId: row.mentionedUser.id,
      username: row.mentionedUser.username as string,
      name: row.mentionedUser.name,
    }));
}

/**
 * Resolve handles in `text` to user ids the content may legitimately reach.
 * `audience` narrows to who can read it (all active users when omitted).
 */
export async function resolveMentions(
  text: string,
  authorId: string,
  audience?: (userIds: string[]) => Promise<Set<string>>,
): Promise<string[]> {
  const handles = extractMentions(text);
  if (handles.length === 0) return [];

  const users = (await findActiveUsersByUsernames(handles)).filter((user) => user.id !== authorId);
  const ids = users.map((user) => user.id);
  if (!audience) return ids;

  const allowed = await audience(ids);
  return ids.filter((id) => allowed.has(id));
}

/** Replace a post's mentions; returns the ids that are new (to notify). */
export async function syncPostMentions(postId: string, authorId: string, userIds: readonly string[]): Promise<string[]> {
  const existing = new Set(
    (await prisma.mention.findMany({ where: { postId }, select: { mentionedUserId: true } })).map(
      (row) => row.mentionedUserId,
    ),
  );
  await prisma.$transaction([
    prisma.mention.deleteMany({ where: { postId, mentionedUserId: { notIn: [...userIds] } } }),
    prisma.mention.createMany({
      data: userIds.filter((id) => !existing.has(id)).map((mentionedUserId) => ({ postId, authorId, mentionedUserId })),
      skipDuplicates: true,
    }),
  ]);
  return userIds.filter((id) => !existing.has(id));
}

export async function syncCommentMentions(
  commentId: string,
  authorId: string,
  userIds: readonly string[],
): Promise<string[]> {
  const existing = new Set(
    (await prisma.mention.findMany({ where: { commentId }, select: { mentionedUserId: true } })).map(
      (row) => row.mentionedUserId,
    ),
  );
  await prisma.$transaction([
    prisma.mention.deleteMany({ where: { commentId, mentionedUserId: { notIn: [...userIds] } } }),
    prisma.mention.createMany({
      data: userIds
        .filter((id) => !existing.has(id))
        .map((mentionedUserId) => ({ commentId, authorId, mentionedUserId })),
      skipDuplicates: true,
    }),
  ]);
  return userIds.filter((id) => !existing.has(id));
}
