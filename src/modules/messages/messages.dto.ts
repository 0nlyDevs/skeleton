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
  readonly createdAt: string;
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
    content: row.deletedAt ? "" : row.content,
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
    createdAt: row.createdAt.toISOString(),
  };
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
