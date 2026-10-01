/**
 * The real-time contract, in one place.
 *
 * Both sides import these constants, so a typo in an event name is a TypeScript
 * error rather than a handler that silently never fires. Payload types are
 * declared here too, which makes the wire format reviewable in a single file.
 *
 * Nothing in this module may import a server or browser API: it is shared.
 */

import type { CommentDto } from "@/modules/comments/comments.dto";
import type { MessageDto } from "@/modules/messages/messages.dto";
import type { FeedItemDto, PostEngagementDto } from "@/modules/posts/posts.dto";

/** Socket.IO event names. */
export const SOCKET_EVENTS = {
  /** Server → client: the connection is authenticated and ready. */
  ready: "session:ready",
  /** Server → client: a notification was created for this user. */
  notification: "notification:new",
  /** Client → server: mark one notification as read from the bell. */
  notificationRead: "notification:read",
  /** Client → server: subscribe to a chat room. */
  joinRoom: "room:join",
  /** Client → server: leave a chat room. */
  leaveRoom: "room:leave",
  /** Server → client: a message was persisted in a room. */
  message: "message:new",
  /** Client → server: forward a message over the socket instead of HTTP. */
  sendMessage: "message:send",
  /** Client → server: typing indicator toggle. */
  typing: "typing:update",
  /** Server → client: someone is typing (or stopped). */
  typingUpdate: "typing:state",
  /** Server → client: room occupancy changed. */
  presence: "presence:update",
  /** Server → client: unread messages changed for the current user. */
  roomUnread: "room:unread",
  /** Server → client: membership or roles changed in a conversation. */
  roomMembers: "room:members",
  /** Server → client: something went wrong handling a client event. */
  error: "session:error",
  /** Client → server: start/stop receiving public feed updates. */
  feedSubscribe: "feed:subscribe",
  feedUnsubscribe: "feed:unsubscribe",
  /** Client → server: start/stop receiving one post's thread. */
  postSubscribe: "post:subscribe",
  postUnsubscribe: "post:unsubscribe",
  /** Server → client: a published post appeared, changed or disappeared. */
  feedPost: "feed:post",
  /** Server → client: a post's comment/reaction counters changed. */
  postEngagement: "post:engagement",
  /** Server → client: a comment was added, edited or removed. */
  comment: "comment:event",
  /** Server → client: a message was edited or deleted for everyone. */
  messageUpdated: "message:updated",
  /** Server → client (own sockets only): a message was deleted for me. */
  messageHidden: "message:hidden",
  /** Server → client: a member's read cursor moved (read receipts). */
  roomRead: "room:read",
  /** Client → server: follow the presence of these users (ack: snapshot). */
  presenceWatch: "presence:watch",
  /** Server → client: someone came online or went offline. */
  presenceState: "presence:state",
  /** Client → server: follow a community group's live feed. */
  groupSubscribe: "group:subscribe",
  groupUnsubscribe: "group:unsubscribe",
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

// --- Payloads ---------------------------------------------------------------

export interface FeedPostPayload {
  readonly kind: "created" | "updated" | "deleted";
  readonly postId: string;
  /** Absent for `deleted`. Viewer-specific fields are reset to neutral. */
  readonly post?: FeedItemDto;
}

export type PostEngagementPayload = PostEngagementDto;

export interface RoomReadPayload {
  readonly roomId: string;
  readonly userId: string;
  readonly lastReadAt: string;
}

export interface MessageHiddenPayload {
  readonly roomId: string;
  readonly messageId: string;
}

export interface PresenceStatePayload {
  readonly userId: string;
  readonly online: boolean;
  /** `null` when the user hides their presence or was never seen. */
  readonly lastSeenAt: string | null;
}

export interface CommentEventPayload {
  readonly kind: "created" | "updated" | "deleted";
  readonly postId: string;
  readonly comment: CommentDto;
}

/** The wire shape of a message is exactly the API's DTO. */
export type MessagePayload = MessageDto;

export interface NotificationPayload {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string | null;
  readonly link: string | null;
  readonly read: boolean;
  readonly createdAt: string;
}

export interface TypingPayload {
  readonly roomId: string;
  readonly userId: string;
  readonly name: string;
  readonly typing: boolean;
}

export interface PresencePayload {
  readonly roomId: string;
  readonly online: number;
}

export interface RoomUnreadPayload {
  readonly roomId: string;
  readonly increment: number;
}

export interface RoomMembersPayload {
  readonly roomId: string;
}

export interface ReadyPayload {
  /** `null` on a guest (read-only) connection. */
  readonly user: {
    readonly id: string;
    readonly name: string;
  } | null;
  readonly serverTime: string;
}

export interface SocketErrorPayload {
  readonly code: string;
  readonly message: string;
}

/** Events the client may emit, with their expected argument shapes. */
export interface ClientToServerEvents {
  [SOCKET_EVENTS.joinRoom]: (roomId: string) => void;
  [SOCKET_EVENTS.leaveRoom]: (roomId: string) => void;
  [SOCKET_EVENTS.notificationRead]: (notificationId: string) => void;
  [SOCKET_EVENTS.sendMessage]: (
    payload: { roomId: string; content: string },
    acknowledge?: (message: MessagePayload) => void,
  ) => void;
  [SOCKET_EVENTS.typing]: (payload: { roomId: string; typing: boolean }) => void;
  [SOCKET_EVENTS.presenceWatch]: (userIds: string[], ack?: (snapshot: PresenceStatePayload[]) => void) => void;
  [SOCKET_EVENTS.groupSubscribe]: (groupId: string) => void;
  [SOCKET_EVENTS.groupUnsubscribe]: (groupId: string) => void;
  [SOCKET_EVENTS.feedSubscribe]: () => void;
  [SOCKET_EVENTS.feedUnsubscribe]: () => void;
  [SOCKET_EVENTS.postSubscribe]: (postId: string) => void;
  [SOCKET_EVENTS.postUnsubscribe]: (postId: string) => void;
}

/** Events the server may emit, with their payload shapes. */
export interface ServerToClientEvents {
  [SOCKET_EVENTS.ready]: (payload: ReadyPayload) => void;
  [SOCKET_EVENTS.notification]: (payload: NotificationPayload) => void;
  [SOCKET_EVENTS.message]: (payload: MessagePayload) => void;
  [SOCKET_EVENTS.typingUpdate]: (payload: TypingPayload) => void;
  [SOCKET_EVENTS.presence]: (payload: PresencePayload) => void;
  [SOCKET_EVENTS.roomUnread]: (payload: RoomUnreadPayload) => void;
  [SOCKET_EVENTS.roomMembers]: (payload: RoomMembersPayload) => void;
  [SOCKET_EVENTS.error]: (payload: SocketErrorPayload) => void;
  [SOCKET_EVENTS.feedPost]: (payload: FeedPostPayload) => void;
  [SOCKET_EVENTS.postEngagement]: (payload: PostEngagementPayload) => void;
  [SOCKET_EVENTS.comment]: (payload: CommentEventPayload) => void;
  [SOCKET_EVENTS.messageUpdated]: (payload: MessagePayload) => void;
  [SOCKET_EVENTS.messageHidden]: (payload: MessageHiddenPayload) => void;
  [SOCKET_EVENTS.roomRead]: (payload: RoomReadPayload) => void;
  [SOCKET_EVENTS.presenceState]: (payload: PresenceStatePayload) => void;
}
