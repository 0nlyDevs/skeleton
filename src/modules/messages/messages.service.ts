/**
 * Chat business rules.
 *
 * Access control is the interesting part. A room is either shared (the global
 * room, open to every authenticated user) or attached to an entity (a post), in
 * which case read access is exactly the read access of that entity. Because the
 * entity's own visibility rule is reused rather than re-implemented, a private
 * post can never acquire a public chat room.
 */

import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import { isStaff } from "@/lib/auth/guards";
import { parseDateInput } from "@/lib/utils";
import type { AuthUser } from "@/types";

import { publishMessage, publishRoomMembers, publishRoomUnread, revokeRoomMembership } from "@/lib/socket/emit";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { notifyGroupInvite, notifyInBackground, notifyMention, notifyModeration, notifyNewMessage } from "../notifications/notifications.service";
import { findPostById } from "../posts/posts.repository";
import { findActiveUsersByIds, findActiveUserById } from "../users/users.repository";
import {
  GLOBAL_ROOM_ID,
  GLOBAL_ROOM_NAME,
  MAX_MESSAGE_LENGTH,
  MAX_POLL_BATCH,
} from "./messages.constants";
import { toMessageDto, toMessageDtos, toRoomDto, type MessageDto, type RoomDto } from "./messages.dto";
import {
  addRoomMember,
  addGroupRoomMember,
  countMessagesBySender,
  countMessagesInRoom,
  createDirectRoom,
  createGroupRoom,
  createMessage,
  entityRoomId,
  findDirectRoom,
  findLatestMessages,
  findMessageById,
  findMessagesSince,
  findRoomById,
  findRoomMember,
  findRoomMembers,
  findRoomMembersForRooms,
  findRoomParticipantIds,
  findUnreadCountsForUser,
  findRoomsForUser,
  globalRoomId,
  isRoomMember,
  removeRoomMember,
  softDeleteMessage,
  updateRoomMemberLastRead,
  upsertRoom,
  type RoomRow,
} from "./messages.repository";
import type { ListMessagesQuery, SendMessageInput } from "./messages.schema";

export interface ActorContext {
  readonly user: AuthUser;
  readonly ip?: string;
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

  if (room.type === "DIRECT" || room.type === "GROUP") {
    const isMember = await isRoomMember(roomId, actor.id);
    if (isMember) return room;
    throw new NotFoundError("This conversation does not exist.");
  }

  throw new ForbiddenError("This conversation is not available.");
}

export async function listRooms(actor: AuthUser): Promise<RoomDto[]> {
  await ensureGlobalRoom();
  // Give the shared room a per-user read marker without resetting an existing
  // user's unread cursor on each room-list refresh.
  await addRoomMember({ roomId: globalRoomId(), userId: actor.id });
  const [rooms, unreadCounts] = await Promise.all([
    findRoomsForUser(actor.id),
    findUnreadCountsForUser(actor.id),
  ]);
  const memberRoomIds = rooms
    .filter((room) => room.type === "DIRECT" || room.type === "GROUP")
    .map((room) => room.id);
  const memberRows = await findRoomMembersForRooms(memberRoomIds);
  const membersByRoom = new Map<string, typeof memberRows>();
  for (const member of memberRows) {
    const current = membersByRoom.get(member.roomId) ?? [];
    current.push(member);
    membersByRoom.set(member.roomId, current);
  }

  const allowed = rooms.map((room) => {
      const members = membersByRoom.get(room.id) ?? [];
      const memberDtos = members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        username: m.user.username,
        image: m.user.image,
        role: m.role,
      }));

      const unreadCount = unreadCounts.get(room.id) ?? 0;
      const latestMsg = room.messages[0];
      const lastMessage = latestMsg
        ? {
            id: latestMsg.id,
            content: latestMsg.deletedAt ? "" : latestMsg.content,
            deleted: latestMsg.deletedAt !== null,
            senderName: latestMsg.sender.name,
            createdAt: latestMsg.createdAt.toISOString(),
          }
        : null;

      let displayName = room.name;
      let targetUser: RoomDto["targetUser"] = null;

      if (room.type === "DIRECT") {
        const otherMember = members.find((m) => m.userId !== actor.id);
        if (otherMember) {
          displayName = otherMember.user.name;
          targetUser = {
            id: otherMember.user.id,
            name: otherMember.user.name,
            username: otherMember.user.username,
            image: otherMember.user.image,
          };
        } else {
          displayName = actor.name;
        }
      }

      return toRoomDto(room, {
          name: displayName,
          unreadCount,
          lastMessage,
          members: memberDtos,
          targetUser,
        });
    });

  // Sort rooms: GLOBAL first, then by last message / update date
  return allowed.sort((a, b) => {
    if (a.type === "GLOBAL") return -1;
    if (b.type === "GLOBAL") return 1;
    const aTime = a.lastMessage?.createdAt ?? "";
    const bTime = b.lastMessage?.createdAt ?? "";
    return bTime.localeCompare(aTime);
  });
}

export interface MessagePage {
  readonly data: MessageDto[];
  readonly meta: { readonly hasMore: boolean };
  readonly serverTime: string;
}

export async function listMessages(
  query: ListMessagesQuery,
  actor: AuthUser,
): Promise<MessagePage> {
  const roomId = query.roomId ?? query.room ?? GLOBAL_ROOM_ID;
  await assertRoomAccess(roomId, actor);

  const limit = Math.min(query.limit ?? 50, MAX_POLL_BATCH);

  // Cursor timestamps stay dates in the API contract; ids only break ties when
  // multiple rows share the same millisecond timestamp.
  const since = query.since ? parseDateInput(query.since) : undefined;
  const before = query.before ? parseDateInput(query.before) : undefined;
  if (query.since && !since) throw new BadRequestError("Invalid message cursor date.");
  if (query.before && !before) throw new BadRequestError("Invalid message cursor date.");

  let hasMore = false;
  let rows;

  if (since) {
    const fetched = await findMessagesSince({
      roomId,
      since,
      afterId: query.afterId,
      take: limit + 1,
    });
    hasMore = fetched.length > limit;
    rows = hasMore ? fetched.slice(0, limit) : fetched;
  } else {
    const fetched = await findLatestMessages({
      roomId,
      take: limit + 1,
      before,
      beforeId: query.beforeId,
    });
    if (fetched.length > limit) {
      hasMore = true;
      rows = fetched.slice(fetched.length - limit);
    } else {
      rows = fetched;
    }
  }

  // Automatically update last read for caller in this room
  void updateRoomMemberLastRead(roomId, actor.id).catch(() => undefined);

  return {
    data: toMessageDtos(rows),
    meta: { hasMore },
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
  const room = await findRoomById(message.roomId);
  const targetMap = new Map<string, string>();
  if (room?.type === "DIRECT" || room?.type === "GROUP") {
    for (const member of await findRoomMembers(message.roomId)) {
      targetMap.set(member.user.id, member.user.name);
    }
  } else {
    for (const participant of await findRoomParticipantIds(message.roomId)) {
      targetMap.set(participant.id, participant.name);
    }
  }

  for (const [userId, name] of targetMap.entries()) {
    if (userId === sender.id) continue;

    if (room?.type === "DIRECT" || room?.type === "GROUP") {
      publishRoomUnread(userId, { roomId: message.roomId, increment: 1 });
    }

    const notify = mentionsName(message.content, name)
      ? notifyMention
      : notifyNewMessage;

    await notify({
      userId,
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

/** Narrow lookup used by report intake after the caller has an authenticated session. */
export async function findMessageForModeration(id: string) {
  return findMessageById(id);
}

export async function getOrCreateDirectRoom(
  targetUserId: string,
  actor: AuthUser,
): Promise<RoomDto> {
  if (targetUserId === actor.id) {
    throw new ForbiddenError("You cannot open a direct conversation with yourself.");
  }
  const target = await findActiveUserById(targetUserId);
  if (!target) throw new NotFoundError("That account does not exist.");

  let room = await findDirectRoom(actor.id, targetUserId);
  if (!room) {
    room = await createDirectRoom(actor.id, targetUserId);
  }

  const members = await findRoomMembers(room.id);
  const otherMember = members.find((m) => m.userId !== actor.id);

  return toRoomDto(room, {
    name: otherMember?.user.name ?? "Direct Message",
    members: members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      username: m.user.username,
      image: m.user.image,
      role: m.role,
    })),
    targetUser: otherMember
      ? {
          id: otherMember.user.id,
          name: otherMember.user.name,
          username: otherMember.user.username,
          image: otherMember.user.image,
        }
      : null,
  });
}

export async function createGroup(
  name: string,
  memberIds: string[],
  actor: AuthUser,
): Promise<RoomDto> {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new BadRequestError("Please provide a group name.");
  }

  const uniqueIds = [...new Set(memberIds)].filter((id) => id !== actor.id);
  if (uniqueIds.length > 50) throw new BadRequestError("A group can have at most 51 members.");
  const activeMembers = await findActiveUsersByIds(uniqueIds);
  if (activeMembers.length !== uniqueIds.length) {
    throw new NotFoundError("One or more selected accounts do not exist.");
  }

  const room = await createGroupRoom(trimmedName, actor.id, uniqueIds);
  const members = await findRoomMembers(room.id);

  for (const userId of uniqueIds) {
    void notifyGroupInvite({
      userId,
      actor: { name: actor.name },
      roomId: room.id,
      groupName: room.name,
    }).catch((error: unknown) => {
      logger.warn("group invite notification failed", { roomId: room.id, userId, error });
    });
  }

  return toRoomDto(room, {
    name: room.name,
    members: members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      username: m.user.username,
      image: m.user.image,
      role: m.role,
    })),
  });
}

export async function markRoomRead(roomId: string, actor: AuthUser): Promise<void> {
  await assertRoomAccess(roomId, actor);
  await updateRoomMemberLastRead(roomId, actor.id, new Date());
}

export async function getRoomMembersList(
  roomId: string,
  actor: AuthUser,
) {
  const room = await assertRoomAccess(roomId, actor);
  if (room.type !== "DIRECT" && room.type !== "GROUP") {
    throw new ForbiddenError("Member lists are only available for private conversations.");
  }
  const members = await findRoomMembers(roomId);
  return members.map((m) => ({
    id: m.id,
    userId: m.user.id,
    name: m.user.name,
    username: m.user.username,
    image: m.user.image,
    role: m.role,
  }));
}

export async function addMemberToGroup(
  roomId: string,
  targetUserId: string,
  actor: AuthUser,
): Promise<void> {
  const room = await assertRoomAccess(roomId, actor);
  if (room.type !== "GROUP") {
    throw new ForbiddenError("Members can only be added to group conversations.");
  }

  const actorMember = await findRoomMember(roomId, actor.id);
  if (actorMember?.role !== "ADMIN") {
    throw new ForbiddenError("Only a group admin can add members.");
  }
  const target = await findActiveUserById(targetUserId);
  if (!target) throw new NotFoundError("That account does not exist.");

  const result = await addGroupRoomMember(roomId, targetUserId);
  if (result === "full") throw new BadRequestError("A group can have at most 51 members.");
  if (result === "exists") return;

  publishRoomMembers({ roomId });
  void notifyGroupInvite({
    userId: targetUserId,
    actor: { name: actor.name },
    roomId,
    groupName: room.name,
  }).catch((error: unknown) => {
    logger.warn("group invite notification failed", { roomId, userId: targetUserId, error });
  });
}

export async function leaveGroupRoom(
  roomId: string,
  actor: AuthUser,
): Promise<void> {
  const room = await assertRoomAccess(roomId, actor);
  if (room.type !== "GROUP") {
    throw new ForbiddenError("Only group conversations can be left.");
  }

  await removeRoomMember(roomId, actor.id);
  publishRoomMembers({ roomId });
  revokeRoomMembership(actor.id, roomId);
}

/** Staff-only removal path used while resolving a message report. */
export async function removeMessageAsStaff(
  id: string,
  actor: ActorContext,
  reason: string | null,
): Promise<void> {
  if (!isStaff(actor.user)) throw new ForbiddenError();
  const existing = await findMessageById(id);
  if (!existing || existing.deletedAt) return;

  const removed = await softDeleteMessage(id);
  if (!removed) return;
  const message = toMessageDto(removed);
  publishMessage(message.roomId, message);
  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.messageDeleted,
    targetType: "message",
    targetId: id,
    metadata: { authorId: existing.senderId, roomId: existing.roomId },
    ip: actor.ip ?? null,
  });
  notifyInBackground(
    notifyModeration({ userId: existing.senderId, what: "message", reason }),
    { messageId: id },
  );
}
