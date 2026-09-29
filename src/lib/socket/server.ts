/**
 * Socket.IO server lifecycle.
 *
 * The server is attached to the same HTTP server Next.js runs on, under the
 * `/api/socket` path. Mounting it on the existing server (rather than a second
 * port) is what makes it work behind cPanel/Passenger, where only one port is
 * proxied to the application.
 *
 * `transports` lists `websocket` first and `polling` second: when a reverse proxy
 * strips the `Upgrade` header the client silently degrades to long-polling
 * instead of failing, and the application-level polling fallback in
 * `/api/messages?since=` covers a hard block.
 */

import type { Server as HttpServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

import type { ClientToServerEvents, ServerToClientEvents } from "./events";
import {
  registerSocketHandlers,
  type AppSocketServer,
  type SocketData,
} from "./handlers";
import { registerSocketServer, unregisterSocketServer } from "./registry";

export function attachRealtimeServer(httpServer: HttpServer): AppSocketServer {
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, {
    path: "/api/socket",
    // The client is bundled by the app; Socket.IO must not serve its own copy.
    serveClient: false,
    transports: ["websocket", "polling"],
    // Keep-alive tuned for shared hosting: a 25s ping interval survives
    // aggressive proxy idle timeouts without generating constant traffic.
    pingInterval: 25_000,
    pingTimeout: 20_000,
    // A chat message is a few kilobytes at most; refuse anything larger so a
    // hostile client cannot buffer megabytes inside the process.
    maxHttpBufferSize: 100_000,
    cors: {
      origin: [...env.corsAllowedOrigins],
      credentials: true,
    },
  });

  registerSocketHandlers(io);
  registerSocketServer(io);

  httpServer.on("close", () => {
    unregisterSocketServer();
  });

  logger.info("realtime server attached", { path: "/api/socket" });

  return io;
}
