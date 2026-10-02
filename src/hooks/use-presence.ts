"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

import { SOCKET_EVENTS, type PresenceStatePayload } from "@/lib/socket/events";

import { getSocket, useSocket, type AppClientSocket } from "./use-socket";

/**
 * Presence for any list of users, shared by every component on the page.
 *
 * Consumers register the ids they display; the union (bounded server-side to
 * 200) is sent as one `presence:watch`, whose acknowledgement is a snapshot.
 * Live `presence:state` frames update the shared map, and the watch is re-sent
 * after every reconnect. No polling anywhere.
 */
const states = new Map<string, PresenceStatePayload>();
const watchers = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;
let attached: AppClientSocket | null = null;
let resendTimer: ReturnType<typeof setTimeout> | null = null;

function notify(): void {
  version += 1;
  for (const listener of listeners) listener();
}

function applyState(state: PresenceStatePayload): void {
  states.set(state.userId, state);
  notify();
}

function sendWatch(): void {
  const socket = getSocket();
  if (!socket?.connected) return;
  socket.emit(SOCKET_EVENTS.presenceWatch, [...watchers.keys()], (snapshot) => {
    for (const state of snapshot) states.set(state.userId, state);
    notify();
  });
}

function scheduleWatch(): void {
  if (resendTimer) clearTimeout(resendTimer);
  // Coalesce many components mounting in the same tick into one frame.
  resendTimer = setTimeout(sendWatch, 50);
}

function attach(socket: AppClientSocket): void {
  if (attached === socket) return;
  attached?.off(SOCKET_EVENTS.presenceState, applyState);
  attached?.off("connect", scheduleWatch);
  attached = socket;
  socket.on(SOCKET_EVENTS.presenceState, applyState);
  socket.on("connect", scheduleWatch);
  scheduleWatch();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePresence(userIds: readonly string[]): ReadonlyMap<string, PresenceStatePayload> {
  const { socket } = useSocket();
  const key = useMemo(() => [...new Set(userIds)].sort().join(","), [userIds]);

  useEffect(() => {
    if (socket) attach(socket);
  }, [socket]);

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    for (const id of ids) watchers.set(id, (watchers.get(id) ?? 0) + 1);
    scheduleWatch();
    return () => {
      for (const id of ids) {
        const count = (watchers.get(id) ?? 1) - 1;
        if (count <= 0) watchers.delete(id);
        else watchers.set(id, count);
      }
    };
  }, [key]);

  useSyncExternalStore(subscribe, () => version, () => 0);
  return states;
}
