"use client";

import { useEffect, useSyncExternalStore } from "react";

import { SOCKET_EVENTS, type ProfileUpdatedPayload } from "@/lib/socket/events";

import { useSocket, type AppClientSocket } from "./use-socket";

/**
 * Live identity patches. When someone changes their avatar or name, the server
 * broadcasts `profile:updated`; every avatar and name rendered from older data
 * reads this map first, so the change shows everywhere without a reload.
 */
const overrides = new Map<string, ProfileUpdatedPayload>();
const listeners = new Set<() => void>();
let version = 0;
let attached: AppClientSocket | null = null;

function apply(payload: ProfileUpdatedPayload): void {
  overrides.set(payload.userId, payload);
  version += 1;
  for (const listener of listeners) listener();
}

/** Local patch for our own change, before the broadcast echoes back. */
export function patchProfile(payload: ProfileUpdatedPayload): void {
  apply(payload);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useProfileOverridesListener(): void {
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket || attached === socket) return;
    attached?.off(SOCKET_EVENTS.profileUpdated, apply);
    attached = socket;
    socket.on(SOCKET_EVENTS.profileUpdated, apply);
  }, [socket]);
}

export function useProfileOverride(userId: string | undefined): ProfileUpdatedPayload | undefined {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return userId ? overrides.get(userId) : undefined;
}
