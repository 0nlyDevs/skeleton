/**
 * Socket event wiring.
 *
 * Rules every handler follows:
 *
 *   * **Identity comes from `socket.data`.** Set during the handshake, never read
 *     from a payload. A client cannot claim to be someone else by sending an id.
 *   * **Every payload is validated.** Client input is parsed with the same Zod
 *     schema the HTTP route uses.
 *   * **Every room join re-checks access.** Subscribing to `room:post-123` proves
 *     nothing; the server confirms the caller may read that post before joining.
 *   * **Errors are reported, not thrown.** A rejected event emits a typed error
 *     frame and leaves the connection alive, so one bad message cannot drop the
 *     socket.
 *   * **Guests are read-only.** A socket without a session may only follow the
 *     public feed and threads of published posts; every write event and every
 *     chat room requires an identity.
 */

import type { Server, Socket } from "socket.io";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { resolveClientIp } from "@/lib/http/client-ip";
import { logger } from "@/lib/logger";
import { loadReadablePost } from "@/modules/posts/posts.service";
import { GLOBAL_ROOM_ID } from "@/modules/messages/messages.constants";
import { sendMessageSchema } from "@/modules/messages/messages.schema";
import {
  assertRoomAccess,
  ensureGlobalRoom,
  sendMessage,
} from "@/modules/messages/messages.service";
import { markNotificationRead } from "@/modules/notifications/notifications.service";
import type { AuthUser } from "@/types";

import { authenticateHandshake, type SocketIdentity } from "./auth";
import { publishPresence, publishTyping, roomSize } from "./emit";
import {
  SOCKET_EVENTS,
  type ClientToServerEvents,
  type ReadyPayload,
  type ServerToClientEvents,
} from "./events";
import { FEED_ROOM, GLOBAL_PRESENCE_ROOM, chatRoom, parseRoom, postRoom, userRoom } from "./rooms";

export interface SocketData {
  /** `null` for a guest: read-only access to public content. */
  identity: SocketIdentity | null;
  ip: string;
}

/**
 * Sockets per client IP. A guest needs no account to connect, so this is what
 * stops one machine from opening thousands of idle connections. Generous
 * enough for a classroom behind one NAT.
 */
const MAX_SOCKETS_PER_IP = 60;
const socketsPerIp = new Map<string, number>();

/** Post threads a single socket may follow at once. */
const MAX_POST_SUBSCRIPTIONS = 50;

export type AppSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

const MAX_ROOM_ID_LENGTH = 120;

function isRoomId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ROOM_ID_LENGTH;
}

export function registerSocketHandlers(io: AppSocketServer): void {
  io.use(async (socket, next) => {
    const ip = handshakeIp(socket);
    const open = socketsPerIp.get(ip) ?? 0;
    if (open >= MAX_SOCKETS_PER_IP) {
      logger.warn("socket connection refused: per-IP limit", { ip });
      next(new Error("RATE_LIMITED"));
      return;
    }

    socket.data.ip = ip;
    socket.data.identity = await authenticateHandshake(socket.handshake.headers);
    next();
  });

  io.on("connection", (socket) => {
    const ip = socket.data.ip;
    socketsPerIp.set(ip, (socketsPerIp.get(ip) ?? 0) + 1);
    socket.on("disconnect", () => {
      const remaining = (socketsPerIp.get(ip) ?? 1) - 1;
      if (remaining <= 0) socketsPerIp.delete(ip);
      else socketsPerIp.set(ip, remaining);
    });

    void onConnection(io, socket).catch((error: unknown) => {
      logger.error("socket connection setup failed", { socketId: socket.id, error });
      socket.disconnect(true);
    });
  });
}

/**
 * The client IP for a handshake. WebSocket upgrades never pass through the
 * HTTP handler in `server.ts`, so a client-sent `x-connection-ip` would survive
 * untouched — it is replaced here with the real socket address before the
 * shared resolver (which also honours `TRUST_PROXY`) reads it.
 */
function handshakeIp(socket: AppSocket): string {
  const headers = new Headers();
  for (const [name, value] of Object.entries(socket.handshake.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }
  headers.delete("x-connection-ip");
  if (socket.handshake.address) headers.set("x-connection-ip", socket.handshake.address);
  return resolveClientIp(headers, env.trustProxy);
}

/** Feed and post-thread subscriptions: open to guests, gated by post visibility. */
function registerPublicHandlers(socket: AppSocket, user: AuthUser | null, log: ReturnType<typeof logger.child>): void {
  socket.on(SOCKET_EVENTS.feedSubscribe, () => {
    void socket.join(FEED_ROOM);
  });

  socket.on(SOCKET_EVENTS.feedUnsubscribe, () => {
    void socket.leave(FEED_ROOM);
  });

  socket.on(SOCKET_EVENTS.postSubscribe, (postId) => {
    void handle(socket, log, async () => {
      if (!isRoomId(postId)) throw new Error("Invalid post id.");
      const following = [...socket.rooms].filter((room) => room.startsWith("post:")).length;
      if (following >= MAX_POST_SUBSCRIPTIONS) return;
      // Same rule as the HTTP API: a draft's thread is not a public channel.
      await loadReadablePost(postId, user);
      await socket.join(postRoom(postId));
    });
  });

  socket.on(SOCKET_EVENTS.postUnsubscribe, (postId) => {
    if (isRoomId(postId)) void socket.leave(postRoom(postId));
  });
}

async function onConnection(io: AppSocketServer, socket: AppSocket): Promise<void> {
  const { identity } = socket.data;
  const log = logger.child({ socketId: socket.id, userId: identity?.userId ?? "guest" });

  const user = identity ? await loadAuthUser(identity) : null;
  registerPublicHandlers(socket, user, log);

  if (!identity || !user) {
    socket.emit(SOCKET_EVENTS.ready, { user: null, serverTime: new Date().toISOString() });
    log.debug("guest socket connected");
    return;
  }

  await ensureGlobalRoom();

  // One personal room plus the shared rooms. Joining the personal room is what
  // makes notification delivery a single targeted emit.
  await socket.join(userRoom(identity.userId));
  await socket.join(GLOBAL_PRESENCE_ROOM);
  await socket.join(chatRoom(GLOBAL_ROOM_ID));

  const ready: ReadyPayload = {
    user: { id: identity.userId, name: identity.name },
    serverTime: new Date().toISOString(),
  };
  socket.emit(SOCKET_EVENTS.ready, ready);

  publishPresence(GLOBAL_ROOM_ID, roomSize(chatRoom(GLOBAL_ROOM_ID)));
  log.info("socket connected", { role: identity.role });

  socket.on(SOCKET_EVENTS.joinRoom, (roomId) => {
    void handle(socket, log, async () => {
      if (!isRoomId(roomId)) throw new Error("Invalid room id.");
      await assertRoomAccess(roomId, user);
      await socket.join(chatRoom(roomId));
      publishPresence(roomId, roomSize(chatRoom(roomId)));
    });
  });

  socket.on(SOCKET_EVENTS.leaveRoom, (roomId) => {
    void handle(socket, log, async () => {
      if (!isRoomId(roomId)) throw new Error("Invalid room id.");
      await socket.leave(chatRoom(roomId));
      publishPresence(roomId, roomSize(chatRoom(roomId)));
    });
  });

  socket.on(SOCKET_EVENTS.sendMessage, (payload, acknowledge) => {
    void handle(socket, log, async () => {
      const parsed = sendMessageSchema.safeParse(payload);
      if (!parsed.success) throw new Error("Invalid message.");

      // The service persists *and* fans the message out to the room, so the
      // socket path and the HTTP path behave identically for other clients.
      const message = await sendMessage(parsed.data, { user });
      acknowledge?.(message);
    });
  });

  socket.on(SOCKET_EVENTS.typing, (payload) => {
    void handle(socket, log, async () => {
      const roomId = (payload as { roomId?: unknown } | null)?.roomId;
      const typing = (payload as { typing?: unknown } | null)?.typing;
      if (!isRoomId(roomId) || typeof typing !== "boolean") return;

      await assertRoomAccess(roomId, user);
      publishTyping(roomId, {
        roomId,
        userId: identity.userId,
        name: identity.name,
        typing,
      });
    });
  });

  socket.on(SOCKET_EVENTS.notificationRead, (notificationId) => {
    void handle(socket, log, async () => {
      if (typeof notificationId !== "string" || notificationId.length === 0) return;
      await markNotificationRead(identity.userId, notificationId);
    });
  });

  socket.on("disconnecting", () => {
    // Socket.IO emits this *before* the socket leaves its rooms, so
    // `socket.rooms` still lists every conversation it joined. The departing
    // socket is still a member at this instant, hence the -1: publishing the
    // raw size would advertise a ghost that is already gone. Any other client
    // in a post room would otherwise keep seeing the leaver as online until
    // the next join/leave.
    for (const roomName of socket.rooms) {
      const parsed = parseRoom(roomName);
      if (parsed?.kind !== "room") continue;
      publishPresence(parsed.id, Math.max(0, roomSize(roomName) - 1));
    }
  });

  socket.on("disconnect", (reason) => {
    log.info("socket disconnected", { reason });
  });
}

/**
 * Run an event handler, turning a failure into an error frame.
 * Never rethrows: an unhandled rejection on a socket event would be invisible.
 */
async function handle(
  socket: AppSocket,
  log: ReturnType<typeof logger.child>,
  run: () => Promise<void>,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    const message =
      error instanceof Error && "expose" in error && (error as { expose?: boolean }).expose === true
        ? error.message
        : "The action could not be completed.";

    log.warn("socket event rejected", { code: typeof code === "string" ? code : "UNKNOWN" });
    socket.emit(SOCKET_EVENTS.error, {
      code: typeof code === "string" ? code : "INTERNAL_ERROR",
      message,
    });
  }
}

async function loadAuthUser(identity: SocketIdentity): Promise<AuthUser | null> {
  // Everything an `AuthUser` promises — verified email, 2FA state, creation
  // date — comes from this row. The handshake identity only proves *who* is
  // connecting; it is not a source of profile truth.
  const row = await prisma.user.findUnique({
    where: { id: identity.userId },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      image: true,
      role: true,
      banned: true,
      emailVerified: true,
      twoFactorEnabled: true,
      createdAt: true,
    },
  });

  if (!row || row.banned) return null;

  return {
    id: row.id,
    email: row.email,
    name: row.name,
    username: row.username,
    image: row.image,
    role: row.role,
    emailVerified: row.emailVerified,
    twoFactorEnabled: row.twoFactorEnabled,
    createdAt: row.createdAt.toISOString(),
  };
}
