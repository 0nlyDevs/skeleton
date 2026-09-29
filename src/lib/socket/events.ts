/**
 * The real-time contract, in one place.
 *
 * Both sides import these constants, so a typo in an event name is a TypeScript
 * error rather than a handler that silently never fires. Payload types are
 * declared here too, which makes the wire format reviewable in a single file.
 *
 * Nothing in this module may import a server or browser API: it is shared.
 */

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
  /** Server → client: something went wrong handling a client event. */
  error: "session:error",
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

// --- Payloads ---------------------------------------------------------------

export interface MessagePayload {
  readonly id: string;
  readonly roomId: string;
  readonly content: string;
  readonly createdAt: string;
  readonly sender: {
    readonly id: string;
    readonly name: string;
    readonly image: string | null;
  };
}

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

export interface ReadyPayload {
  readonly user: {
    readonly id: string;
    readonly name: string;
  };
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
  [SOCKET_EVENTS.sendMessage]: (payload: { roomId: string; content: string }) => void;
  [SOCKET_EVENTS.typing]: (payload: { roomId: string; typing: boolean }) => void;
}

/** Events the server may emit, with their payload shapes. */
export interface ServerToClientEvents {
  [SOCKET_EVENTS.ready]: (payload: ReadyPayload) => void;
  [SOCKET_EVENTS.notification]: (payload: NotificationPayload) => void;
  [SOCKET_EVENTS.message]: (payload: MessagePayload) => void;
  [SOCKET_EVENTS.typingUpdate]: (payload: TypingPayload) => void;
  [SOCKET_EVENTS.presence]: (payload: PresencePayload) => void;
  [SOCKET_EVENTS.error]: (payload: SocketErrorPayload) => void;
}
