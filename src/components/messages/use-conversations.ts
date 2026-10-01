"use client";

import { useCallback, useEffect, useState } from "react";

import { useSocket } from "@/hooks/use-socket";
import { apiFetch } from "@/lib/api/client";
import { SOCKET_EVENTS, type MessagePayload } from "@/lib/socket/events";
import type { RoomDto } from "@/modules/messages/messages.dto";

/** Private conversations only: DMs and group chats (communities are Groups). */
function isPrivate(room: RoomDto): boolean {
  return room.type === "DIRECT" || room.type === "GROUP";
}

function preview(message: MessagePayload): RoomDto["lastMessage"] {
  return {
    id: message.id,
    content: message.content,
    deleted: message.deleted,
    senderId: message.sender.id,
    senderName: message.sender.name,
    hasImage: message.image !== null,
    createdAt: message.createdAt,
  };
}

/**
 * The inbox. Loaded once, then kept live by the socket: every message in any
 * of the user's conversations (their sockets joined all of them at connect)
 * moves that conversation to the top with a fresh preview.
 */
export function useConversations() {
  const { socket } = useSocket();
  const [rooms, setRooms] = useState<RoomDto[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await apiFetch<{ data: RoomDto[] }>("/api/messages/rooms");
      setRooms(response.data.filter(isPrivate));
      setError(null);
    } catch (caught) {
      setError(caught);
      setRooms((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket) return;
    const onMessage = (message: MessagePayload) => {
      setRooms((current) => {
        if (!current) return current;
        const room = current.find((entry) => entry.id === message.roomId);
        if (!room) {
          // A conversation we have not loaded yet (someone just wrote to us).
          if (message.roomId !== "global") void refresh();
          return current;
        }
        return [{ ...room, lastMessage: preview(message) }, ...current.filter((entry) => entry.id !== room.id)];
      });
    };
    const onUpdated = (message: MessagePayload) => {
      setRooms((current) =>
        current?.map((room) => (room.lastMessage?.id === message.id ? { ...room, lastMessage: preview(message) } : room)) ?? current,
      );
    };
    const onMembers = () => void refresh();
    socket.on(SOCKET_EVENTS.message, onMessage);
    socket.on(SOCKET_EVENTS.messageUpdated, onUpdated);
    socket.on(SOCKET_EVENTS.roomMembers, onMembers);
    socket.on("connect", onMembers);
    return () => {
      socket.off(SOCKET_EVENTS.message, onMessage);
      socket.off(SOCKET_EVENTS.messageUpdated, onUpdated);
      socket.off(SOCKET_EVENTS.roomMembers, onMembers);
      socket.off("connect", onMembers);
    };
  }, [socket, refresh]);

  const upsert = useCallback((room: RoomDto) => {
    setRooms((current) => [room, ...(current ?? []).filter((entry) => entry.id !== room.id)]);
  }, []);

  return { rooms, error, refresh, upsert };
}
