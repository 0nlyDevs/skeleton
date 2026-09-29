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
 */

import type { Server, Socket } from "socket.io";

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
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
import { GLOBAL_PRESENCE_ROOM, chatRoom, userRoom } from "./rooms";

export interface SocketData {
  identity: SocketIdentity;
}

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

/** Rebuild the minimum `AuthUser` the services need from the handshake identity. */
function toAuthUser(identity: SocketIdentity, email: string): AuthUser {
  return {
    id: identity.userId,
    email,
    name: identity.name,
    image: null,
    role: identity.role,
    emailVerified: true,
    twoFactorEnabled: false,
    createdAt: new Date().toISOString(),
  };
}

export function registerSocketHandlers(io: AppSocketServer): void {
  io.use(async (socket, next) => {
    const identity = await authenticateHandshake(socket.handshake.headers);
    if (!identity) {
      logger.warn("socket connection rejected", { socketId: socket.id });
      next(new Error("UNAUTHENTICATED"));
      return;
    }
    socket.data.identity = identity;
    next();
  });

  io.on("connection", (socket) => {
    void onConnection(io, socket).catch((error: unknown) => {
      logger.error("socket connection setup failed", { socketId: socket.id, error });
      socket.disconnect(true);
    });
  });
}

async function onConnection(io: AppSocketServer, socket: AppSocket): Promise<void> {
  const { identity } = socket.data;
  const log = logger.child({ socketId: socket.id, userId: identity.userId });

  const user = await loadAuthUser(identity);
  if (!user) {
    socket.disconnect(true);
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

  socket.on(SOCKET_EVENTS.sendMessage, (payload) => {
    void handle(socket, log, async () => {
      const parsed = sendMessageSchema.safeParse(payload);
      if (!parsed.success) throw new Error("Invalid message.");

      // The service persists *and* fans the message out to the room, so the
      // socket path and the HTTP path behave identically for other clients.
      await sendMessage(parsed.data, { user });
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

  socket.on("disconnect", (reason) => {
    publishPresence(GLOBAL_ROOM_ID, roomSize(chatRoom(GLOBAL_ROOM_ID)));
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
  const row = await prisma.user.findUnique({
    where: { id: identity.userId },
    select: { id: true, email: true, name: true, image: true, role: true, banned: true },
  });

  if (!row || row.banned) return null;

  return {
    ...toAuthUser(identity, row.email),
    name: row.name,
    image: row.image,
    role: row.role,
  };
}
