import { decryptField } from "@/lib/crypto/field-encryption";
import { REACTION_TYPES, type ReactionType } from "@/types";

import type { MessageWithSender, RoomRow } from "./messages.repository";

export interface MessageSenderDto {
  readonly id: string;
  readonly name: string;
  readonly username: string | null;
  readonly image: string | null;
}

export interface MessageImageDto {
  readonly id: string;
  readonly url: string;
  readonly width: number | null;
  readonly height: number | null;
}

export interface MessageDto {
  readonly id: string;
  readonly roomId: string;
  readonly content: string;
  /** "Deleted for everyone": content and image are withheld. */
  readonly deleted: boolean;
  readonly editedAt: string | null;
  readonly image: MessageImageDto | null;
  readonly sender: MessageSenderDto;
  /** Who reacted with what; members only ever see their own rooms' messages. */
  readonly reactions: readonly MessageReactionDto[];
  readonly createdAt: string;
}

export interface MessageReactionDto {
  readonly type: ReactionType;
  readonly userIds: readonly string[];
}

export interface RoomMemberDto {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly username: string | null;
  readonly image: string | null;
  readonly role: string;
  /** Read-receipt cursor: everything at or before it has been seen. */
  readonly lastReadAt: string | null;
}

export interface RoomLastMessageDto {
  readonly id: string;
  readonly content: string;
  readonly deleted: boolean;
  readonly senderId: string;
  readonly senderName: string;
  readonly hasImage: boolean;
  readonly createdAt: string;
}

export interface RoomDto {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
  readonly unreadCount?: number;
  readonly lastMessage?: RoomLastMessageDto | null;
  readonly members?: RoomMemberDto[];
  readonly targetUser?: {
    readonly id: string;
    readonly name: string;
    readonly username: string | null;
    readonly image: string | null;
  } | null;
}

export function toMessageDto(row: MessageWithSender): MessageDto {
  return {
    id: row.id,
    roomId: row.roomId,
    // Content is stored verbatim and rendered as text by the client. It is
    // never interpreted as markup, so no HTML escaping is needed at this layer
    // — and escaping here would corrupt the stored message.
    content: row.deletedAt ? "" : decryptField(row.content),
    deleted: row.deletedAt !== null,
    editedAt: row.deletedAt || !row.editedAt ? null : row.editedAt.toISOString(),
    image:
      row.deletedAt || !row.upload
        ? null
        : {
            id: row.upload.id,
            url: `/api/files/${row.upload.id}`,
            width: row.upload.width,
            height: row.upload.height,
          },
    sender: {
      id: row.sender.id,
      name: row.sender.name,
      username: row.sender.username,
      image: row.sender.image,
    },
    reactions: row.deletedAt ? [] : groupReactions(row.reactions),
    createdAt: row.createdAt.toISOString(),
  };
}

function groupReactions(rows: readonly { userId: string; type: string }[]): MessageReactionDto[] {
  const byType = new Map<ReactionType, string[]>();
  for (const row of rows) {
    if (!(REACTION_TYPES as readonly string[]).includes(row.type)) continue;
    const type = row.type as ReactionType;
    byType.set(type, [...(byType.get(type) ?? []), row.userId]);
  }
  return [...byType].map(([type, userIds]) => ({ type, userIds }));
}

export function toMessageDtos(rows: readonly MessageWithSender[]): MessageDto[] {
  return rows.map(toMessageDto);
}

export function toRoomDto(
  row: RoomRow,
  options?: {
    name?: string;
    unreadCount?: number;
    lastMessage?: RoomLastMessageDto | null;
    members?: RoomMemberDto[];
    targetUser?: RoomDto["targetUser"];
  },
): RoomDto {
  return {
    id: row.id,
    name: options?.name ?? row.name,
    type: row.type,
    entityType: row.entityType,
    entityId: row.entityId,
    unreadCount: options?.unreadCount ?? 0,
    lastMessage: options?.lastMessage ?? null,
    members: options?.members,
    targetUser: options?.targetUser,
  };
}
