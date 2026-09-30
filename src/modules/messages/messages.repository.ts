/**
 * Message and room persistence.
 *
 * The hot query is "the newest N messages in a room", which is why the schema
 * carries a composite index on `[roomId, createdAt]` — without it, every poll
 * would be a full scan of a table that grows for the whole contest.
 */

import { type Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/db/prisma";

export const messageSenderSelect = {
  sender: { select: { id: true, name: true, image: true } },
} satisfies Prisma.MessageInclude;

export type MessageWithSender = Prisma.MessageGetPayload<{
  include: typeof messageSenderSelect;
}>;

export type RoomRow = Prisma.RoomGetPayload<Record<string, never>>;

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

export async function findRooms(): Promise<RoomRow[]> {
  return prisma.room.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });
}

export async function createMessage(data: {
  roomId: string;
  senderId: string;
  content: string;
}): Promise<MessageWithSender> {
  return prisma.message.create({
    data,
    include: messageSenderSelect,
  });
}

/**
 * Messages newer than `since`, ascending, capped. This is the polling fallback
 * path: `GET /api/messages?room=X&since=<iso>`.
 */
export async function findMessagesSince(args: {
  roomId: string;
  since: Date;
  take: number;
}): Promise<MessageWithSender[]> {
  return prisma.message.findMany({
    where: { roomId: args.roomId, createdAt: { gt: args.since } },
    orderBy: { createdAt: "asc" },
    take: args.take,
    include: messageSenderSelect,
  });
}

/** The newest page of a room, returned oldest-first for rendering. */
export async function findLatestMessages(args: {
  roomId: string;
  take: number;
  before?: Date;
}): Promise<MessageWithSender[]> {
  const rows = await prisma.message.findMany({
    where: {
      roomId: args.roomId,
      ...(args.before ? { createdAt: { lt: args.before } } : {}),
    },
    orderBy: { createdAt: "desc" },
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

export async function countMessagesBySender(senderId: string): Promise<number> {
  return prisma.message.count({ where: { senderId } });
}
