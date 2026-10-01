/**
 * Publish helpers.
 *
 * Route handlers and services call these to push realtime updates; they never
 * touch `io` directly. Each helper is a no-op when no socket server is
 * registered, which is what lets the exact same service code run under
 * `next start` (no realtime) and under the custom server (realtime).
 *
 * Messages are emitted to the whole room *including* the sender. That is
 * deliberate: the client dedupes by message id, which it must do anyway to
 * reconcile the socket stream with the polling fallback. Excluding the sender
 * would mean tracking socket ids per user for no real benefit.
 */

import {
  SOCKET_EVENTS,
  type CommentEventPayload,
  type FeedPostPayload,
  type MessagePayload,
  type PostEngagementPayload,
  type NotificationPayload,
  type PresencePayload,
  type RoomUnreadPayload,
  type RoomMembersPayload,
  type TypingPayload,
} from "./events";
import { getSocketServer } from "./registry";
import { FEED_ROOM, chatRoom, postRoom, userRoom } from "./rooms";

function publish(room: string, event: string, payload: unknown): void {
  getSocketServer()?.to(room).emit(event, payload);
}

/** Deliver a notification to every device the user has open. */
export function publishNotification(userId: string, payload: NotificationPayload): void {
  publish(userRoom(userId), SOCKET_EVENTS.notification, payload);
}

/** Fan a persisted message out to everyone in the room. */
export function publishMessage(roomId: string, payload: MessagePayload): void {
  publish(chatRoom(roomId), SOCKET_EVENTS.message, payload);
}

/** Ephemeral typing indicator; never persisted. */
export function publishTyping(roomId: string, payload: TypingPayload): void {
  publish(chatRoom(roomId), SOCKET_EVENTS.typingUpdate, payload);
}

export function publishPresence(roomId: string, online: number): void {
  const payload: PresencePayload = { roomId, online };
  publish(chatRoom(roomId), SOCKET_EVENTS.presence, payload);
}

/** Keep each user's room list unread badge in sync across open tabs. */
export function publishRoomUnread(userId: string, payload: RoomUnreadPayload): void {
  publish(userRoom(userId), SOCKET_EVENTS.roomUnread, payload);
}

/** Refresh member lists for participants already connected to a group. */
export function publishRoomMembers(payload: RoomMembersPayload): void {
  publish(chatRoom(payload.roomId), SOCKET_EVENTS.roomMembers, payload);
}

/** Remove every open device for a user from a room after access is revoked. */
export function revokeRoomMembership(userId: string, roomId: string): void {
  const server = getSocketServer();
  if (!server) return;
  const room = chatRoom(roomId);
  server.in(userRoom(userId)).socketsLeave(room);
  publishPresence(roomId, Math.max(0, roomSize(room)));
}

/** Force a fresh authenticated handshake after a ban or privileged role change. */
export function disconnectUserSockets(userId: string): void {
  getSocketServer()?.in(userRoom(userId)).disconnectSockets(true);
}

/** A published post appeared, changed or disappeared from the public feed. */
export function publishFeedPost(payload: FeedPostPayload): void {
  publish(FEED_ROOM, SOCKET_EVENTS.feedPost, payload);
}

/**
 * New counters for a post, to its open thread and — when the post is public —
 * to every feed card showing it. One emit per room, whatever the audience size.
 */
export function publishEngagement(payload: PostEngagementPayload, isPublic: boolean): void {
  const server = getSocketServer();
  if (!server) return;
  const rooms = isPublic ? [postRoom(payload.postId), FEED_ROOM] : [postRoom(payload.postId)];
  server.to(rooms).emit(SOCKET_EVENTS.postEngagement, payload);
}

export function publishComment(payload: CommentEventPayload): void {
  publish(postRoom(payload.postId), SOCKET_EVENTS.comment, payload);
}

/** Current number of sockets in a room, straight from the adapter. */
export function roomSize(roomName: string): number {
  return getSocketServer()?.sockets.adapter.rooms.get(roomName)?.size ?? 0;
}
