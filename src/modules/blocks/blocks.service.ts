/**
 * Blocking.
 *
 * A block works both ways: neither person sees the other's posts or comments,
 * opens the other's profile, messages, follows or mentions the other. The
 * blocked person is never told; their profile simply becomes unreachable.
 */

import { ConflictError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/db/prisma";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import type { AuthUser } from "@/types";

import { findActiveUserById } from "../users/users.repository";

/** Ids of everyone `userId` blocked or was blocked by. Cached per request batch by callers. */
export async function findBlockedIds(userId: string): Promise<string[]> {
  const rows = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
    take: 2_000,
  });
  return [...new Set(rows.map((row) => (row.blockerId === userId ? row.blockedId : row.blockerId)))];
}

/** True when either user blocked the other. */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const count = await prisma.userBlock.count({
    where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
  });
  return count > 0;
}

export async function hasBlocked(blockerId: string, blockedId: string): Promise<boolean> {
  return (await prisma.userBlock.count({ where: { blockerId, blockedId } })) > 0;
}

export async function blockUser(targetId: string, actor: AuthUser): Promise<{ blocked: true }> {
  if (targetId === actor.id) throw new ConflictError("You cannot block yourself.");
  const target = await findActiveUserById(targetId);
  if (!target) throw new NotFoundError("That profile does not exist.");
  await enforceThenRecord([{ key: rateLimitKey("block", actor.id), rule: RATE_LIMITS.follow }]);
  await prisma.$transaction([
    prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: actor.id, blockedId: targetId } },
      create: { blockerId: actor.id, blockedId: targetId },
      update: {},
    }),
    // Following each other makes no sense any more, in either direction.
    prisma.follow.deleteMany({
      where: { OR: [{ followerId: actor.id, followingId: targetId }, { followerId: targetId, followingId: actor.id }] },
    }),
  ]);
  return { blocked: true };
}

export async function unblockUser(targetId: string, actor: AuthUser): Promise<{ blocked: false }> {
  await prisma.userBlock.deleteMany({ where: { blockerId: actor.id, blockedId: targetId } });
  return { blocked: false };
}

export interface BlockedUserDto {
  readonly id: string;
  readonly name: string;
  readonly username: string | null;
  readonly image: string | null;
  readonly since: string;
}

export async function listBlocked(actor: AuthUser): Promise<BlockedUserDto[]> {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId: actor.id },
    orderBy: { createdAt: "desc" },
    take: 500,
    select: { createdAt: true, blocked: { select: { id: true, name: true, username: true, image: true } } },
  });
  return rows.map((row) => ({ ...row.blocked, since: row.createdAt.toISOString() }));
}
