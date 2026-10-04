/**
 * Chat business rules.
 *
 * Access control is the interesting part. A room is either shared (the global
 * room, open to every authenticated user) or attached to an entity (a post), in
 * which case read access is exactly the read access of that entity. Because the
 * entity's own visibility rule is reused rather than re-implemented, a private
 * post can never acquire a public chat room.
 */

import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { decryptField } from "@/lib/crypto/field-encryption";
import { extractMentions } from "@/lib/mentions";
import { logger } from "@/lib/logger";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import { isStaff } from "@/lib/auth/guards";
import { parseDateInput } from "@/lib/utils";
import type { AuthUser, ReactionType } from "@/types";

import { publishMessageAlert,
  grantRoomMembership,
  publishMessage,
  publishMessageHidden,
  publishMessageUpdated,
  publishRoomMembers,
  publishRoomRead,
  publishRoomUnread,
  revokeRoomMembership,
} from "@/lib/socket/emit";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { notifyGroupInvite, notifyInBackground, notifyMention, notifyModeration } from "../notifications/notifications.service";
import { findPostById } from "../posts/posts.repository";
import { findActiveUserById, findActiveUsersByIds, findActiveUsersByUsernames } from "../users/users.repository";
import {
  GLOBAL_ROOM_ID,
  GLOBAL_ROOM_NAME,
  MAX_MESSAGE_LENGTH,
  MAX_POLL_BATCH,
} from "./messages.constants";
import { toMessageDto, toMessageDtos, toRoomDto, type MessageDto, type RoomDto, type RoomMemberDto } from "./messages.dto";
import {
  addRoomMember,
  clearRoomForMember,
  deleteRoom,
  findClearedRoomIds,
  updateRoomDetails,
  setMessageReaction,
  findMessageReactors,
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
  findUnreadCountsForUser,
  findRoomsForUser,
  globalRoomId,
  hideMessageForUser,
  isAttachableImage,
  isRoomMember,
  removeRoomMember,
  softDeleteMessage,
  updateMessageContent,
  updateRoomMemberLastRead,
  upsertRoom,
  type RoomRow,
} from "./messages.repository";
import { assertOwnPublicImage } from "../uploads/uploads.service";
import type { ListMessagesQuery, SendMessageInput } from "./messages.schema";
import { isBlockedBetween } from "../blocks/blocks.service";

interface MemberRowLike {
  readonly id: string;
  readonly role: string;
  readonly lastReadAt: Date | null;
  readonly user: { id: string; name: string; username: string | null; image: string | null };
}

function toMemberDto(m: MemberRowLike): RoomMemberDto {
  return {
    id: m.id,
    userId: m.user.id,
    name: m.user.name,
    username: m.user.username,
    image: m.user.image,
    role: m.role,
    lastReadAt: m.lastReadAt ? m.lastReadAt.toISOString() : null,
  };
}

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
  const [allRooms, unreadCounts, cleared] = await Promise.all([
    findRoomsForUser(actor.id),
    findUnreadCountsForUser(actor.id),
    findClearedRoomIds(actor.id),
  ]);
  // A conversation the member deleted stays out of the list until a new message.
  const rooms = allRooms.filter((room) => !cleared.has(room.id));
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
      const memberDtos = members.map(toMemberDto);

      const unreadCount = unreadCounts.get(room.id) ?? 0;
      const latestMsg = room.messages[0];
      const lastMessage = latestMsg
        ? {
            id: latestMsg.id,
            content: latestMsg.deletedAt ? "" : decryptField(latestMsg.content),
            deleted: latestMsg.deletedAt !== null,
            senderId: latestMsg.sender.id,
            senderName: latestMsg.sender.name,
            hasImage: latestMsg.uploadId !== null && latestMsg.deletedAt === null,
            systemKind: latestMsg.systemKind ?? null,
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
  const notBefore = (await findRoomMember(roomId, actor.id))?.clearedAt ?? null;

  if (since) {
    const fetched = await findMessagesSince({
      roomId,
      viewerId: actor.id,
      since,
      afterId: query.afterId,
      take: limit + 1,
      notBefore,
    });
    hasMore = fetched.length > limit;
    rows = hasMore ? fetched.slice(0, limit) : fetched;
  } else {
    const fetched = await findLatestMessages({
      roomId,
      viewerId: actor.id,
      take: limit + 1,
      before,
      beforeId: query.beforeId,
      notBefore,
    });
    if (fetched.length > limit) {
      hasMore = true;
      rows = fetched.slice(fetched.length - limit);
    } else {
      rows = fetched;
    }
  }

  // Automatically update last read for caller in this room
  // Opening the newest page counts as reading it.
  if (!before) void markReadAndAnnounce(roomId, actor.id, new Date());

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
/** A reply must point at a live message of the same conversation. */
async function validReplyTarget(replyToId: string, roomId: string): Promise<string> {
  const target = await findMessageById(replyToId);
  if (!target || target.roomId !== roomId || target.deletedAt) throw new BadRequestError("The message you are replying to no longer exists.");
  return target.id;
}

export async function sendMessage(
  input: SendMessageInput,
  actor: ActorContext,
): Promise<MessageDto> {
  const sendingRoom = await assertRoomAccess(input.roomId, actor.user);
  if (sendingRoom.type === "DIRECT") {
    const other = (await findRoomMembers(input.roomId)).find((member) => member.userId !== actor.user.id);
    if (other && (await isBlockedBetween(actor.user.id, other.userId))) throw new ForbiddenError("You cannot message this person.");
  }

  // Throws `RateLimitedError`, which the route wrapper serializes as a 429 with
  // a `Retry-After` header.
  await enforceThenRecord([
    { key: rateLimitKey("chat:send", actor.user.id), rule: RATE_LIMITS.chatMessage },
    { key: rateLimitKey("chat:send:sustained", actor.user.id), rule: RATE_LIMITS.chatMessageSustained },
  ]);

  if (input.uploadId && !(await isAttachableImage(input.uploadId, actor.user.id))) {
    throw new BadRequestError("This image is unavailable. Upload it again.");
  }

  const row = await createMessage({
    roomId: input.roomId,
    senderId: actor.user.id,
    content: input.content.slice(0, MAX_MESSAGE_LENGTH),
    uploadId: input.uploadId ?? null,
    replyToId: input.replyToId ? await validReplyTarget(input.replyToId, input.roomId) : null,
  });

  // Sending implies having read everything up to now.
  void markReadAndAnnounce(input.roomId, actor.user.id, row.createdAt);

  const message = toMessageDto(row);

  // Publications are part of this module's contract, not the caller's job. Doing
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
 * Persist a system event message (member joined/left/removed) and fan it out
 * to the room over the socket, same as a regular message.
 */
async function announceSystemMessage(
  roomId: string,
  senderId: string,
  systemKind: string,
): Promise<void> {
  const row = await createMessage({ roomId, senderId, content: "", systemKind });
  publishMessage(roomId, toMessageDto(row));
}

/**
 * Fan-out after a message.
 *
 *   * private conversations: every other member's unread badge moves live,
 *     and a bell entry is created only for the *first* unread message of a
 *     burst (when the member had read everything before it) — a chatty
 *     conversation must not bury the bell;
 *   * any room: a structured `@username` mention of a member notifies them.
 */
async function notifyRoomAboutMessage(message: MessageDto, sender: AuthUser): Promise<void> {
  const room = await findRoomById(message.roomId);
  if (!room) return;

  const mentioned = new Set(
    (await findActiveUsersByUsernames(extractMentions(message.content))).map((user) => user.id),
  );

  if (room.type === "DIRECT" || room.type === "GROUP") {
    const members = await findRoomMembers(message.roomId);

    for (const member of members) {
      if (member.userId === sender.id) continue;
      publishRoomUnread(member.userId, { roomId: message.roomId, increment: 1 });

      const preview = message.content || "Photo";
      if (mentioned.has(member.userId)) {
        await notifyMention({ userId: member.userId, senderName: sender.name, roomId: message.roomId, preview });
        continue;
      }
      // A popup only: messages are counted by the inbox badge, not the bell.
      publishMessageAlert(member.userId, {
        roomId: message.roomId,
        senderName: sender.name,
        senderImage: sender.image ?? null,
        preview: preview.slice(0, 140),
      });
    }
    return;
  }

  // Shared rooms: only explicit mentions, never "someone spoke".
  for (const userId of mentioned) {
    if (userId === sender.id) continue;
    await notifyMention({ userId, senderName: sender.name, roomId: message.roomId, preview: message.content });
  }
}

async function markReadAndAnnounce(roomId: string, userId: string, at: Date): Promise<void> {
  try {
    await updateRoomMemberLastRead(roomId, userId, at);
    publishRoomRead({ roomId, userId, lastReadAt: at.toISOString() });
  } catch (error) {
    logger.debug("read cursor update failed", { roomId, error });
  }
}

/** Edits are the sender's own, on a live message, within 24 hours. */
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function editMessage(id: string, content: string, actor: ActorContext): Promise<MessageDto> {
  const existing = await findMessageById(id);
  // Not-yours is not-found, here as everywhere.
  if (!existing || existing.senderId !== actor.user.id) throw new NotFoundError("This message does not exist.");
  await assertRoomAccess(existing.roomId, actor.user);
  if (existing.deletedAt) throw new ConflictError("This message was deleted.");
  if (Date.now() - existing.createdAt.getTime() > EDIT_WINDOW_MS) {
    throw new ConflictError("Messages can only be edited within 24 hours.");
  }

  await enforceThenRecord([{ key: rateLimitKey("message:edit", actor.user.id), rule: RATE_LIMITS.messageEdit }]);

  const message = toMessageDto(await updateMessageContent(id, content));
  publishMessageUpdated(message.roomId, message);
  return message;
}

/** Who reacted to a message: members of its conversation only. */
export async function listMessageReactors(id: string, viewer: AuthUser) {
  const existing = await findMessageById(id);
  if (!existing) throw new NotFoundError("This message does not exist.");
  await assertRoomAccess(existing.roomId, viewer);
  return (await findMessageReactors(id)).map((row) => ({ type: row.type as ReactionType, user: row.user }));
}

/** React to a message (one reaction per member; `null` removes it). */
export async function reactToMessage(id: string, type: ReactionType | null, actor: ActorContext): Promise<MessageDto> {
  const existing = await findMessageById(id);
  if (!existing) throw new NotFoundError("This message does not exist.");
  await assertRoomAccess(existing.roomId, actor.user);
  if (existing.deletedAt) throw new ConflictError("This message was deleted.");

  await enforceThenRecord([{ key: rateLimitKey("message:react", actor.user.id), rule: RATE_LIMITS.reaction }]);

  const row = await setMessageReaction(id, actor.user.id, type);
  if (!row) throw new NotFoundError("This message does not exist.");
  const message = toMessageDto(row);
  publishMessageUpdated(message.roomId, message);
  return message;
}

/**
 * `me`: hide it from the caller's history only (any member, any message).
 * `everyone`: the sender withdraws it for all; a tombstone keeps the thread's
 * shape ("message deleted") and the content is never sent again.
 */
export async function deleteMessage(
  id: string,
  scope: "me" | "everyone",
  actor: ActorContext,
): Promise<void> {
  const existing = await findMessageById(id);
  if (!existing) throw new NotFoundError("This message does not exist.");
  await assertRoomAccess(existing.roomId, actor.user);

  await enforceThenRecord([{ key: rateLimitKey("message:edit", actor.user.id), rule: RATE_LIMITS.messageEdit }]);

  if (scope === "me") {
    await hideMessageForUser(id, actor.user.id);
    publishMessageHidden(actor.user.id, { roomId: existing.roomId, messageId: id });
    return;
  }

  if (existing.senderId !== actor.user.id) {
    throw new ForbiddenError("Only the sender can delete a message for everyone.");
  }
  if (existing.deletedAt) return;

  const removed = await softDeleteMessage(id);
  if (removed) publishMessageUpdated(removed.roomId, toMessageDto(removed));
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
  if (await isBlockedBetween(actor.id, targetUserId)) throw new ForbiddenError("You cannot message this person.");

  let room = await findDirectRoom(actor.id, targetUserId);
  if (!room) {
    room = await createDirectRoom(actor.id, targetUserId);
    grantRoomMembership(actor.id, room.id);
    grantRoomMembership(targetUserId, room.id);
  }

  const members = await findRoomMembers(room.id);
  const otherMember = members.find((m) => m.userId !== actor.id);

  return toRoomDto(room, {
    name: otherMember?.user.name ?? "Direct Message",
    members: members.map(toMemberDto),
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
  await enforceThenRecord([{ key: rateLimitKey("chat:group", actor.id), rule: RATE_LIMITS.conversation }]);

  const uniqueIds = [...new Set(memberIds)].filter((id) => id !== actor.id);
  if (uniqueIds.length > 50) throw new BadRequestError("A group can have at most 51 members.");
  const activeMembers = await findActiveUsersByIds(uniqueIds);
  if (activeMembers.length !== uniqueIds.length) {
    throw new NotFoundError("One or more selected accounts do not exist.");
  }

  const room = await createGroupRoom(trimmedName, actor.id, uniqueIds);
  const members = await findRoomMembers(room.id);
  for (const member of members) grantRoomMembership(member.userId, room.id);

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
    members: members.map(toMemberDto),
  });
}

export async function markRoomRead(roomId: string, actor: AuthUser): Promise<void> {
  await assertRoomAccess(roomId, actor);
  await markReadAndAnnounce(roomId, actor.id, new Date());
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
  return members.map(toMemberDto);
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

  grantRoomMembership(targetUserId, roomId);
  publishRoomMembers({ roomId });
  void notifyGroupInvite({
    userId: targetUserId,
    actor: { name: actor.name },
    roomId,
    groupName: room.name,
  }).catch((error: unknown) => {
    logger.warn("group invite notification failed", { roomId, userId: targetUserId, error });
  });

  void announceSystemMessage(roomId, targetUserId, "MEMBER_JOINED");
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

  void announceSystemMessage(roomId, actor.id, "MEMBER_LEFT");
}

/** Remove a member from a group conversation (group admins only). */
export async function removeMemberFromGroup(
  roomId: string,
  targetUserId: string,
  actor: AuthUser,
): Promise<void> {
  const room = await assertRoomAccess(roomId, actor);
  if (room.type !== "GROUP") {
    throw new ForbiddenError("Members can only be removed from group conversations.");
  }

  const actorMember = await findRoomMember(roomId, actor.id);
  if (actorMember?.role !== "ADMIN") {
    throw new ForbiddenError("Only a group admin can remove members.");
  }
  if (targetUserId === actor.id) {
    throw new BadRequestError("Use the leave action to remove yourself from the group.");
  }
  const target = await findActiveUserById(targetUserId);
  if (!target) throw new NotFoundError("That account does not exist.");

  await removeRoomMember(roomId, targetUserId);
  publishRoomMembers({ roomId });
  revokeRoomMembership(targetUserId, roomId);

  void announceSystemMessage(roomId, targetUserId, "MEMBER_REMOVED");
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
  publishMessageUpdated(message.roomId, message);
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

/** Unread counts per private conversation, for the header badge. */
export async function getUnreadSummary(actor: AuthUser): Promise<{ total: number; rooms: Record<string, number> }> {
  const counts = await findUnreadCountsForUser(actor.id);
  const rooms: Record<string, number> = {};
  let total = 0;
  for (const [roomId, count] of counts) {
    if (roomId === GLOBAL_ROOM_ID) continue;
    rooms[roomId] = count;
    total += count;
  }
  return { total, rooms };
}

/**
 * Remove a conversation from one's list. `me` (any member): history up to now
 * is hidden and the conversation disappears until a newer message arrives.
 * `everyone` (group admins only): the group conversation is deleted for all.
 */
export async function deleteConversation(roomId: string, scope: "me" | "everyone", actor: AuthUser): Promise<void> {
  const room = await assertRoomAccess(roomId, actor);
  if (room.type !== "DIRECT" && room.type !== "GROUP") throw new ForbiddenError("This conversation cannot be deleted.");
  if (scope === "me") {
    await clearRoomForMember(roomId, actor.id);
    return;
  }
  if (room.type !== "GROUP") throw new ForbiddenError("Only group conversations can be deleted for everyone.");
  const member = await findRoomMember(roomId, actor.id);
  if (member?.role !== "ADMIN" && !isStaff(actor)) throw new ForbiddenError("Only the group's admins can delete it.");
  const members = await findRoomMembers(roomId);
  await deleteRoom(roomId);
  for (const entry of members) {
    publishRoomMembers({ roomId });
    revokeRoomMembership(entry.userId, roomId);
  }
}

/** Rename a group conversation or change its photo (group admins). */
export async function updateConversation(roomId: string, input: { name?: string; image?: string | null }, actor: AuthUser): Promise<RoomDto> {
  const room = await assertRoomAccess(roomId, actor);
  if (room.type !== "GROUP") throw new ForbiddenError("Only group conversations can be renamed.");
  const member = await findRoomMember(roomId, actor.id);
  if (member?.role !== "ADMIN") throw new ForbiddenError("Only the group's admins can change it.");
  if (input.image) await assertOwnPublicImage(input.image, actor.id);
  const updated = await updateRoomDetails(roomId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.image !== undefined ? { image: input.image } : {}),
  });
  publishRoomMembers({ roomId });
  return toRoomDto(updated);
}

