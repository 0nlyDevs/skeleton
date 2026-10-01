/**
 * Message and room persistence.
 *
 * The hot query is "the newest N messages in a room", which is why the schema
 * carries a composite index on `[roomId, createdAt]` — without it, every poll
 * would be a full scan of a table that grows for the whole contest.
 */

import { type Prisma } from "@/generated/prisma/client";
import { createHash } from "node:crypto";

import { prisma } from "@/lib/db/prisma";

export const messageSenderSelect = {
  sender: { select: { id: true, name: true, username: true, image: true } },
  upload: { select: { id: true, width: true, height: true } },
} satisfies Prisma.MessageInclude;

export const roomListInclude = {
  messages: {
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 1,
    include: messageSenderSelect,
  },
} satisfies Prisma.RoomInclude;

export type MessageWithSender = Prisma.MessageGetPayload<{
  include: typeof messageSenderSelect;
}>;

export type RoomRow = Prisma.RoomGetPayload<Record<string, never>>;
export type RoomListRow = Prisma.RoomGetPayload<{ include: typeof roomListInclude }>;

/** Deterministic room ids make room creation race-free. */
export function globalRoomId(): string {
  return "global";
}

export function entityRoomId(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

export async function upsertRoom(data: {
  id: string;
  name: string;
  type: Prisma.RoomCreateInput["type"];
  entityType?: string | null;
  entityId?: string | null;
}): Promise<RoomRow> {
  return prisma.room.upsert({
    where: { id: data.id },
    create: {
      id: data.id,
      name: data.name,
      type: data.type,
      entityType: data.entityType ?? null,
      entityId: data.entityId ?? null,
    },
    update: { name: data.name },
  });
}

export async function findRoomById(id: string): Promise<RoomRow | null> {
  return prisma.room.findUnique({ where: { id } });
}

export async function findRoomsForUser(userId: string): Promise<RoomListRow[]> {
  return prisma.room.findMany({
    where: { OR: [{ id: globalRoomId() }, { members: { some: { userId } } }] },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: 100,
    include: roomListInclude,
  });
}

export async function findRoomMembersForRooms(roomIds: readonly string[]) {
  if (roomIds.length === 0) return [];
  return prisma.roomMember.findMany({
    where: { roomId: { in: [...roomIds] } },
    include: {
      user: { select: { id: true, name: true, username: true, image: true } },
    },
    orderBy: [{ roomId: "asc" }, { createdAt: "asc" }],
  });
}

/** One indexed join computes unread counts for all of this user's rooms. */
export async function findUnreadCountsForUser(userId: string): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ roomId: string; unreadCount: bigint }>>`
    SELECT m.roomId AS roomId, COUNT(*) AS unreadCount
    FROM message AS m
    INNER JOIN roomMember AS rm ON rm.roomId = m.roomId
    WHERE rm.userId = ${userId}
      AND m.senderId <> ${userId}
      AND m.deletedAt IS NULL
      AND m.createdAt > rm.lastReadAt
    GROUP BY m.roomId
  `;
  return new Map(rows.map((row) => [row.roomId, Number(row.unreadCount)]));
}

export async function createMessage(data: {
  roomId: string;
  senderId: string;
  content: string;
  uploadId?: string | null;
}): Promise<MessageWithSender> {
  return prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data,
      include: messageSenderSelect,
    });
    await tx.room.update({ where: { id: data.roomId }, data: { updatedAt: message.createdAt } });
    return message;
  });
}

/**
 * Messages newer than `since`, ascending, capped. This is the polling fallback
 * path: `GET /api/messages?room=X&since=<iso>`.
 */
export async function findMessagesSince(args: {
  roomId: string;
  viewerId: string;
  since: Date;
  afterId?: string;
  take: number;
}): Promise<MessageWithSender[]> {
  return prisma.message.findMany({
    where: {
      roomId: args.roomId,
      // "Deleted for me" rows never leave the server for that viewer.
      hiddenFor: { none: { userId: args.viewerId } },
      ...(args.afterId
        ? {
            OR: [
              { createdAt: { gt: args.since } },
              { createdAt: args.since, id: { gt: args.afterId } },
            ],
          }
        : { createdAt: { gt: args.since } }),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: args.take,
    include: messageSenderSelect,
  });
}

/** The newest page of a room, returned oldest-first for rendering. */
export async function findLatestMessages(args: {
  roomId: string;
  viewerId: string;
  take: number;
  before?: Date;
  beforeId?: string;
}): Promise<MessageWithSender[]> {
  const rows = await prisma.message.findMany({
    where: {
      roomId: args.roomId,
      hiddenFor: { none: { userId: args.viewerId } },
      ...(args.before
        ? args.beforeId
          ? {
              OR: [
                { createdAt: { lt: args.before } },
                { createdAt: args.before, id: { lt: args.beforeId } },
              ],
            }
          : { createdAt: { lt: args.before } }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: args.take,
    include: messageSenderSelect,
  });

  return rows.reverse();
}

export async function countMessagesInRoom(roomId: string): Promise<number> {
  return prisma.message.count({ where: { roomId } });
}

/**
 * Distinct senders in a room — the closest thing to a membership list this
 * schema has. Used to decide who gets notified about a new message: if you
 * have spoken in a conversation, you care about replies to it. The name rides
 * along so mention detection can match `@name` without a second query.
 */
export async function findRoomParticipantIds(
  roomId: string,
): Promise<Array<{ id: string; name: string }>> {
  const rows = await prisma.message.findMany({
    where: { roomId },
    select: { sender: { select: { id: true, name: true } } },
    distinct: ["senderId"],
    take: 200,
  });
  return rows.map((row) => row.sender);
}

export async function findMessageById(id: string): Promise<MessageWithSender | null> {
  return prisma.message.findUnique({
    where: { id },
    include: messageSenderSelect,
  });
}

export async function softDeleteMessage(id: string): Promise<MessageWithSender | null> {
  const result = await prisma.message.updateMany({
    where: { id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (result.count === 0) return null;
  return findMessageById(id);
}

export async function updateMessageContent(id: string, content: string): Promise<MessageWithSender> {
  return prisma.message.update({
    where: { id },
    data: { content, editedAt: new Date() },
    include: messageSenderSelect,
  });
}

/** "Delete for me": idempotent. */
export async function hideMessageForUser(messageId: string, userId: string): Promise<void> {
  await prisma.messageHide.upsert({
    where: { messageId_userId: { messageId, userId } },
    create: { messageId, userId },
    update: {},
  });
}

/** Rooms whose live channel a user's sockets should be in. */
export async function findMemberRoomIds(userId: string): Promise<string[]> {
  const rows = await prisma.roomMember.findMany({
    where: { userId, room: { type: { in: ["DIRECT", "GROUP"] } } },
    select: { roomId: true },
    take: 500,
  });
  return rows.map((row) => row.roomId);
}

/** The message just before `createdAt` in a room (for "first unread" checks). */
export async function findPreviousMessageAt(roomId: string, before: Date, excludeId: string): Promise<Date | null> {
  const row = await prisma.message.findFirst({
    where: { roomId, createdAt: { lte: before }, id: { not: excludeId } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

/** Is this upload the sender's own, an image, and not attached anywhere? */
export async function isAttachableImage(uploadId: string, userId: string): Promise<boolean> {
  const count = await prisma.upload.count({
    where: { id: uploadId, userId, mime: { startsWith: "image/" }, postMedia: null, message: null },
  });
  return count === 1;
}

export async function findRoomMembers(roomId: string) {
  return prisma.roomMember.findMany({
    where: { roomId },
    include: {
      user: {
        select: { id: true, name: true, username: true, image: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function findRoomMember(roomId: string, userId: string) {
  return prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });
}

export async function isRoomMember(roomId: string, userId: string): Promise<boolean> {
  const member = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
    select: { id: true },
  });
  return Boolean(member);
}

export async function addRoomMember(data: {
  roomId: string;
  userId: string;
  role?: string;
}) {
  return prisma.roomMember.upsert({
    where: { roomId_userId: { roomId: data.roomId, userId: data.userId } },
    create: {
      roomId: data.roomId,
      userId: data.userId,
      role: data.role ?? "MEMBER",
      lastReadAt: new Date(),
    },
    update: {
      role: data.role ?? undefined,
    },
  });
}

/** Add a group member under a room-row lock so the 51-member cap is race-safe. */
export async function addGroupRoomMember(
  roomId: string,
  userId: string,
): Promise<"added" | "exists" | "full"> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM room WHERE id = ${roomId} FOR UPDATE`;

    const existing = await tx.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      select: { id: true },
    });
    if (existing) return "exists";

    const memberCount = await tx.roomMember.count({ where: { roomId } });
    if (memberCount >= 51) return "full";

    await tx.roomMember.create({ data: { roomId, userId, role: "MEMBER" } });
    return "added";
  });
}

export async function removeRoomMember(roomId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({ where: { id: roomId }, select: { type: true } });
    const removed = await tx.roomMember.deleteMany({ where: { roomId, userId } });

    if (room?.type === "GROUP") {
      const admin = await tx.roomMember.findFirst({
        where: { roomId, role: "ADMIN" },
        select: { id: true },
      });
      if (!admin) {
        const nextAdmin = await tx.roomMember.findFirst({
          where: { roomId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true },
        });
        if (nextAdmin) {
          await tx.roomMember.update({ where: { id: nextAdmin.id }, data: { role: "ADMIN" } });
        }
      }
    }

    return removed;
  });
}

export async function updateRoomMemberLastRead(
  roomId: string,
  userId: string,
  date = new Date(),
) {
  return prisma.roomMember.upsert({
    where: { roomId_userId: { roomId, userId } },
    create: {
      roomId,
      userId,
      role: "MEMBER",
      lastReadAt: date,
    },
    update: {
      lastReadAt: date,
    },
  });
}

export async function findDirectRoom(userAId: string, userBId: string): Promise<RoomRow | null> {
  return prisma.room.findUnique({ where: { id: directRoomId(userAId, userBId) } });
}

function directRoomId(userAId: string, userBId: string): string {
  const pair = [userAId, userBId].sort().join("\u0000");
  return `dm_${createHash("sha256").update(pair).digest("hex")}`;
}

export async function createDirectRoom(userAId: string, userBId: string): Promise<RoomRow> {
  return prisma.$transaction(async (tx) => {
    const room = await tx.room.upsert({
      where: { id: directRoomId(userAId, userBId) },
      create: {
        id: directRoomId(userAId, userBId),
        name: "",
        type: "DIRECT",
      },
      update: {},
    });

    await tx.roomMember.createMany({
      data: [
        { roomId: room.id, userId: userAId, role: "MEMBER" },
        { roomId: room.id, userId: userBId, role: "MEMBER" },
      ],
      skipDuplicates: true,
    });

    return room;
  });
}

export async function createGroupRoom(
  name: string,
  creatorId: string,
  memberIds: string[],
): Promise<RoomRow> {
  const uniqueMemberIds = Array.from(new Set([creatorId, ...memberIds]));

  return prisma.$transaction(async (tx) => {
    const room = await tx.room.create({
      data: {
        name,
        type: "GROUP",
      },
    });

    await tx.roomMember.createMany({
      data: uniqueMemberIds.map((userId) => ({
        roomId: room.id,
        userId,
        role: userId === creatorId ? "ADMIN" : "MEMBER",
      })),
    });

    return room;
  });
}

export async function countUnreadMessages(
  roomId: string,
  userId: string,
  sinceDate: Date,
): Promise<number> {
  return prisma.message.count({
    where: {
      roomId,
      senderId: { not: userId },
      createdAt: { gt: sinceDate },
    },
  });
}

export async function findLatestMessageForRoom(roomId: string): Promise<MessageWithSender | null> {
  const messages = await prisma.message.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
    take: 1,
    include: messageSenderSelect,
  });
  return messages[0] ?? null;
}

export async function countMessagesBySender(senderId: string): Promise<number> {
  return prisma.message.count({ where: { senderId } });
}
