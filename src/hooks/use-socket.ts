"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { publicEnv } from "@/lib/env.public";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/socket/events";

export type SocketStatus = "idle" | "connecting" | "socket" | "polling" | "offline";

export type AppClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * One socket per tab, shared by every consumer.
 *
 * A module-level singleton avoids the classic bug where three components each
 * mount their own connection and the server sees three sessions for one user.
 * Reference counting closes the connection only when the last consumer unmounts,
 * so navigating between pages does not churn the transport.
 *
 * Failure handling is explicit: the first failed handshake or connection drops
 * the status to `polling`, and consumers switch to `GET /api/messages?since=`.
 * Reconnection keeps being retried in the background, so a transient proxy hiccup
 * recovers on its own.
 */
let socket: AppClientSocket | null = null;
let consumers = 0;
let failures = 0;

const listeners = new Set<(status: SocketStatus) => void>();
let currentStatus: SocketStatus = "idle";

function setStatus(next: SocketStatus): void {
  if (currentStatus === next) return;
  currentStatus = next;
  for (const listener of listeners) listener(next);
}

function ensureSocket(): AppClientSocket | null {
  if (typeof window === "undefined") return null;
  if (publicEnv.realtimeMode === "polling") {
    setStatus("polling");
    return null;
  }
  if (socket) return socket;

  setStatus("connecting");

  socket = io({
    path: "/api/socket",
    // Same origin, so no CORS and no credentials dance: the session cookie rides
    // along with the handshake.
    withCredentials: true,
    transports: ["websocket", "polling"],
    // Bounded reconnection: after a few attempts we stop hammering and stay on
    // the polling fallback until the tab is reloaded.
    reconnectionAttempts: 6,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    timeout: 10_000,
  });

  socket.on("connect", () => {
    failures = 0;
    setStatus("socket");
  });

  socket.on("disconnect", (reason) => {
    setStatus(reason === "io client disconnect" ? "idle" : "polling");
  });

  socket.on("connect_error", () => {
    failures += 1;
    setStatus(failures >= 2 ? "polling" : "connecting");
  });

  return socket;
}

function releaseSocket(): void {
  consumers -= 1;
  if (consumers > 0 || !socket) return;

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  setStatus("idle");
}

/** The shared socket instance, or `null` when realtime is unavailable. */
export function getSocket(): AppClientSocket | null {
  return socket;
}

/**
 * Subscribe to the shared connection.
 *
 * Returns the status so a component can render the transport indicator and, when
 * it is `polling`, use the HTTP fallback instead of waiting for events.
 */
export function useSocket(): { socket: AppClientSocket | null; status: SocketStatus } {
  const [status, setStatus] = useState<SocketStatus>(currentStatus);

  useEffect(() => {
    consumers += 1;
    listeners.add(setStatus);
    ensureSocket();

    return () => {
      listeners.delete(setStatus);
      releaseSocket();
    };
  }, []);

  return { socket: socket, status };
}
