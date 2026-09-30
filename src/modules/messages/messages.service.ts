/**
 * Chat business rules.
 *
 * Access control is the interesting part. A room is either shared (the global
 * room, open to every authenticated user) or attached to an entity (a post), in
 * which case read access is exactly the read access of that entity. Because the
 * entity's own visibility rule is reused rather than re-implemented, a private
 * post can never acquire a public chat room.
 */

import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import { isStaff } from "@/lib/auth/guards";
import { parseDateInput } from "@/lib/utils";
import type { AuthUser } from "@/types";

import { publishMessage } from "@/lib/socket/emit";

import { notifyMention, notifyNewMessage } from "../notifications/notifications.service";
import { findPostById } from "../posts/posts.repository";
import {
  GLOBAL_ROOM_ID,
  GLOBAL_ROOM_NAME,
  MAX_MESSAGE_LENGTH,
  MAX_POLL_BATCH,
} from "./messages.constants";
import { toMessageDto, toMessageDtos, toRoomDto, type MessageDto, type RoomDto } from "./messages.dto";
import {
  countMessagesBySender,
  countMessagesInRoom,
  createMessage,
  entityRoomId,
  findLatestMessages,
  findMessagesSince,
  findRoomById,
  findRoomParticipantIds,
  findRooms,
  globalRoomId,
  upsertRoom,
  type RoomRow,
} from "./messages.repository";
import type { ListMessagesQuery, SendMessageInput } from "./messages.schema";

export interface ActorContext {
  readonly user: AuthUser;
}

/** Idempotently create the shared room. Safe to call on every boot. */
export async function ensureGlobalRoom(): Promise<RoomDto> {
  const room = await upsertRoom({
    id: globalRoomId(),
    name: GLOBAL_ROOM_NAME,
    type: "GLOBAL",
  });
  return toRoomDto(room);
}

/** Create (or fetch) the room attached to an entity, e.g. a post. */
export async function ensureEntityRoom(
  entityType: string,
  entityId: string,
  name: string,
): Promise<RoomDto> {
  const room = await upsertRoom({
    id: entityRoomId(entityType, entityId),
    name,
    type: "POST",
    entityType,
    entityId,
  });
  return toRoomDto(room);
}

/**
 * Return the room if the caller may read it, otherwise 404.
 *
 * A 403 would confirm the room exists; 404 keeps the existence of private
 * content private, exactly like the posts module does.
 */
export async function assertRoomAccess(roomId: string, actor: AuthUser): Promise<RoomRow> {
  const room = await findRoomById(roomId);
  if (!room) throw new NotFoundError("This conversation does not exist.");

  if (room.type === "GLOBAL") return room;

  if (room.type === "POST" && room.entityId) {
    const post = await findPostById(room.entityId);
    if (!post || post.deletedAt) throw new NotFoundError("This conversation does not exist.");

    const visible = post.published || post.userId === actor.id || isStaff(actor);
    if (!visible) throw new NotFoundError("This conversation does not exist.");

    return room;
  }

  // DIRECT rooms are not implemented; denying by default keeps an unknown type
  // from silently becoming world-readable.
  throw new ForbiddenError("This conversation is not available.");
}

export async function listRooms(actor: AuthUser): Promise<RoomDto[]> {
  await ensureGlobalRoom();
  const rooms = await findRooms();

  const allowed: RoomDto[] = [];
  for (const room of rooms) {
    try {
      await assertRoomAccess(room.id, actor);
      allowed.push(toRoomDto(room));
    } catch {
      // Not visible to this caller: omit it entirely rather than leaking a name.
    }
  }
  return allowed;
}

export interface MessagePage {
  readonly data: MessageDto[];
  /** Cursor to send back as `since` on the next poll. */
  readonly serverTime: string;
}

export async function listMessages(
  query: ListMessagesQuery,
  actor: AuthUser,
): Promise<MessagePage> {
  await assertRoomAccess(query.room, actor);

  const limit = Math.min(query.limit, MAX_POLL_BATCH);
  const since = parseDateInput(query.since);
  const before = parseDateInput(query.before);

  const rows = since
    ? await findMessagesSince({ roomId: query.room, since, take: limit })
    : await findLatestMessages({ roomId: query.room, take: limit, before });

  return {
    data: toMessageDtos(rows),
    serverTime: new Date().toISOString(),
  };
}

/**
 * Persist a message.
 *
 * Throttled to one message per second per user. The check and the write are
 * separate steps, but a duplicate message is harmless here — the goal is to stop
 * a flood, not to enforce exactly-once delivery.
 */
export async function sendMessage(
  input: SendMessageInput,
  actor: ActorContext,
): Promise<MessageDto> {
  await assertRoomAccess(input.roomId, actor.user);

  // Throws `RateLimitedError`, which the route wrapper serializes as a 429 with
  // a `Retry-After` header.
  await enforceThenRecord([
    {
      key: rateLimitKey("chat:send", actor.user.id),
      rule: RATE_LIMITS.chatMessage,
    },
  ]);

  const row = await createMessage({
    roomId: input.roomId,
    senderId: actor.user.id,
    content: input.content.slice(0, MAX_MESSAGE_LENGTH),
  });

  const message = toMessageDto(row);

  // Publication is part of this module's contract, not the caller's job. Doing
  // it here means the HTTP endpoint and the socket handler cannot drift into
  // broadcasting differently — and there is exactly one place to look when a
  // message does not arrive.
  publishMessage(message.roomId, message);

  // Notifications are best-effort: a failed bell entry must never roll back a
  // message that is already visible to everyone in the room.
  void notifyRoomAboutMessage(message, actor.user).catch((error: unknown) => {
    logger.warn("message notification failed", {
      roomId: message.roomId,
      error,
    });
  });

  return message;
}

/**
 * Tell everyone who has spoken in this room that a new message arrived.
 *
 * A participant named in the text gets the `MENTION` notification instead of
 * the generic one — one bell entry per person, never both. The match requires
 * `@name` to end at a word boundary, so `@ada` does not fire for `@adaline`.
 */
async function notifyRoomAboutMessage(
  message: MessageDto,
  sender: AuthUser,
): Promise<void> {
  const participants = await findRoomParticipantIds(message.roomId);

  for (const participant of participants) {
    if (participant.id === sender.id) continue;

    const notify = mentionsName(message.content, participant.name)
      ? notifyMention
      : notifyNewMessage;

    await notify({
      userId: participant.id,
      senderName: sender.name,
      roomId: message.roomId,
      preview: message.content,
    });
  }
}

function mentionsName(content: string, name: string): boolean {
  const needle = name.trim().toLowerCase();
  if (needle.length === 0) return false;

  const haystack = content.toLowerCase();
  const at = haystack.indexOf(`@${needle}`);
  if (at === -1) return false;

  const after = haystack[at + 1 + needle.length];
  return after === undefined || !/[a-z0-9]/.test(after);
}

export async function getRoomStats(roomId = GLOBAL_ROOM_ID): Promise<{ messages: number }> {
  return { messages: await countMessagesInRoom(roomId) };
}

export async function countMessagesForUser(userId: string): Promise<number> {
  return countMessagesBySender(userId);
}
