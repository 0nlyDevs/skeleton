/**
 * Presence: who is online, and when someone was last seen.
 *
 * Online state is a per-process count of open sockets per user, so several
 * tabs count once and the last tab closing is what flips a user offline.
 * `lastSeenAt` is persisted on that last disconnect. A user who turned off
 * `showPresence` is always reported offline with no last-seen time — to
 * everyone, including people they talk to.
 *
 * Scaling note: with several Node processes this map must move to a shared
 * store (the Socket.IO Redis adapter plus a Redis set), because each process
 * only sees its own sockets.
 */

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

import { publishPresenceState } from "./emit";
import type { PresenceStatePayload } from "./events";

const openSockets = new Map<string, number>();

export function isOnline(userId: string): boolean {
  return (openSockets.get(userId) ?? 0) > 0;
}

async function presenceVisible(userId: string): Promise<boolean> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { showPresence: true } });
  return row?.showPresence ?? false;
}

export async function markConnected(userId: string): Promise<void> {
  const count = (openSockets.get(userId) ?? 0) + 1;
  openSockets.set(userId, count);
  if (count === 1 && (await presenceVisible(userId))) {
    publishPresenceState({ userId, online: true, lastSeenAt: null });
  }
}

export async function markDisconnected(userId: string): Promise<void> {
  const count = (openSockets.get(userId) ?? 1) - 1;
  if (count > 0) {
    openSockets.set(userId, count);
    return;
  }
  openSockets.delete(userId);

  try {
    const now = new Date();
    const row = await prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: now },
      select: { showPresence: true },
    });
    if (row.showPresence) {
      publishPresenceState({ userId, online: false, lastSeenAt: now.toISOString() });
    }
  } catch (error) {
    logger.debug("last-seen update failed", { userId, error });
  }
}

/** Current state of up to 200 users, honouring each one's privacy choice. */
export async function presenceSnapshot(userIds: readonly string[]): Promise<PresenceStatePayload[]> {
  const ids = [...new Set(userIds)].slice(0, 200);
  if (ids.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: { id: { in: ids }, banned: false },
    select: { id: true, showPresence: true, lastSeenAt: true },
  });
  return rows.map((row) =>
    row.showPresence
      ? {
          userId: row.id,
          online: isOnline(row.id),
          lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
        }
      : { userId: row.id, online: false, lastSeenAt: null },
  );
}
