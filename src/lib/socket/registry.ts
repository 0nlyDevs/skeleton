/**
 * Socket server registry.
 *
 * The Socket.IO server is created by `server.ts`, outside Next's module graph
 * (Next never sees it, so it is never bundled into a page). Route handlers still
 * need to *publish* to it — so the instance is parked on `globalThis` under a
 * namespaced key and looked up here.
 *
 * `import type` is deliberate: the type is erased at compile time, so importing
 * this module from a route does not pull `socket.io` into the server bundle.
 *
 * When the app runs under `next start` without the custom server, no instance is
 * registered and every publish becomes a no-op. Notifications still work — they
 * are persisted and the client polls — which is exactly the graceful degradation
 * the contest brief asks for.
 */

import type { Server as SocketIOServer } from "socket.io";

import { logger } from "@/lib/logger";

const REGISTRY_KEY = "__webcupSocketServer";

type GlobalWithSocket = typeof globalThis & {
  [REGISTRY_KEY]?: SocketIOServer;
};

export function registerSocketServer(server: SocketIOServer): void {
  (globalThis as GlobalWithSocket)[REGISTRY_KEY] = server;
  logger.info("socket server registered", { namespace: "/" });
}

export function unregisterSocketServer(): void {
  delete (globalThis as GlobalWithSocket)[REGISTRY_KEY];
}

export function getSocketServer(): SocketIOServer | null {
  return (globalThis as GlobalWithSocket)[REGISTRY_KEY] ?? null;
}

/** True when a realtime transport is available in this process. */
export function isRealtimeAvailable(): boolean {
  return getSocketServer() !== null;
}
