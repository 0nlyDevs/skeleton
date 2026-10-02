"use client";

import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";

import { publicEnv } from "@/lib/env.public";
import type { ClientToServerEvents, ServerToClientEvents } from "@/lib/socket/events";
import { HybridSocket } from "@/lib/socket/hybrid-client";

/**
 * `socket`     — connected; every update is pushed.
 * `connecting` — first handshake or a reconnect in progress; nothing to do yet.
 * `polling`    — the socket has failed repeatedly; consumers may poll the HTTP
 *                API slowly until it comes back (it keeps retrying meanwhile).
 * `offline`    — the browser reports no network at all.
 */
export type SocketStatus = "idle" | "connecting" | "socket" | "polling" | "offline";

export type AppClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** Consecutive failed handshakes before consumers are told to fall back. */
const FAILURES_BEFORE_FALLBACK = 3;

/**
 * One socket per tab, shared by every consumer — socket first, always.
 *
 *  * WebSocket is tried first; if a proxy blocks it, Socket.IO's own HTTP
 *    long-polling transport takes over (`tryAllTransports`). That is still a
 *    push channel, so the app keeps receiving events without polling the API.
 *  * Reconnection never gives up. It backs off to 10s with jitter, so a fleet of
 *    tabs coming back after a deploy does not reconnect in lockstep.
 *  * Only after several consecutive failures does the status become `polling`,
 *    and it flips back to `socket` the moment a reconnect succeeds.
 *  * The server keeps a short connection-state recovery window, so a brief
 *    network blip replays the events missed instead of losing them.
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

function onBrowserOffline(): void {
  setStatus("offline");
}

function onBrowserOnline(): void {
  if (!socket) return;
  setStatus(socket.connected ? "socket" : "connecting");
  if (!socket.connected) socket.connect();
}

function ensureSocket(): AppClientSocket | null {
  if (typeof window === "undefined") return null;
  if (publicEnv.realtimeMode === "polling") {
    setStatus("polling");
    return null;
  }
  if (socket) return socket;

  setStatus(navigator.onLine === false ? "offline" : "connecting");

  // The server picks the transport (Socket.IO, or the short-poll relay on
  // hosts that cap concurrent requests); the API is the same either way.
  socket = new HybridSocket() as unknown as AppClientSocket;
  socket.connect();

  socket.on("connect", () => {
    failures = 0;
    setStatus("socket");
  });

  socket.on("disconnect", (reason) => {
    if (reason === "io client disconnect") {
      setStatus("idle");
      return;
    }
    setStatus(navigator.onLine === false ? "offline" : "connecting");
    // A server-side disconnect (e.g. the session was revoked) is not retried
    // automatically by Socket.IO; reconnect explicitly so a new handshake
    // decides what this tab may still do.
    if (reason === "io server disconnect") socket?.connect();
  });

  socket.on("connect_error", () => {
    failures += 1;
    if (navigator.onLine === false) setStatus("offline");
    else setStatus(failures >= FAILURES_BEFORE_FALLBACK ? "polling" : "connecting");
  });

  window.addEventListener("offline", onBrowserOffline);
  window.addEventListener("online", onBrowserOnline);

  return socket;
}

function releaseSocket(): void {
  consumers -= 1;
  if (consumers > 0 || !socket) return;

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  window.removeEventListener("offline", onBrowserOffline);
  window.removeEventListener("online", onBrowserOnline);
  setStatus("idle");
}

/** The shared socket instance, or `null` when realtime is unavailable. */
export function getSocket(): AppClientSocket | null {
  return socket;
}

/**
 * Subscribe to the shared connection.
 *
 * Returns the status so a component can render the transport indicator and,
 * only when it is `polling`, use the HTTP fallback.
 */
export function useSocket(): { socket: AppClientSocket | null; status: SocketStatus } {
  const [status, setLocalStatus] = useState<SocketStatus>(currentStatus);

  useEffect(() => {
    consumers += 1;
    listeners.add(setLocalStatus);
    // Creating the socket moves the status off `idle`, which re-renders this
    // consumer — that render reads the now-populated module instance below.
    ensureSocket();

    return () => {
      listeners.delete(setLocalStatus);
      releaseSocket();
    };
  }, []);

  // `status` is in the dependency chain of every consumer, so reading the
  // module-level instance here always reflects the latest connection.
  return { socket: status === "idle" ? null : socket, status };
}

/**
 * Keep a server-side subscription alive for as long as the component is
 * mounted, re-sending it after every reconnect (a new connection starts with
 * no rooms unless the recovery window restored them; joining twice is a no-op).
 */
export function useSocketSubscription(
  subscribe: ((socket: AppClientSocket) => void) | null,
  unsubscribe: ((socket: AppClientSocket) => void) | null,
  key: string | null,
): void {
  const { socket: instance } = useSocket();
  const handlers = useRef({ subscribe, unsubscribe });
  useEffect(() => {
    handlers.current = { subscribe, unsubscribe };
  });

  useEffect(() => {
    if (!instance || key === null) return;

    const join = () => handlers.current.subscribe?.(instance);
    if (instance.connected) join();
    instance.on("connect", join);

    return () => {
      instance.off("connect", join);
      if (instance.connected) handlers.current.unsubscribe?.(instance);
    };
  }, [instance, key]);
}
