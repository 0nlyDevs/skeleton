import type { MessageWithSender, RoomRow } from "./messages.repository";

export interface MessageSenderDto {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

export interface MessageDto {
  readonly id: string;
  readonly roomId: string;
  readonly content: string;
  readonly sender: MessageSenderDto;
  readonly createdAt: string;
}

export interface RoomDto {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly entityType: string | null;
  readonly entityId: string | null;
}

export function toMessageDto(row: MessageWithSender): MessageDto {
  return {
    id: row.id,
    roomId: row.roomId,
    // Content is stored verbatim and rendered as text by the client. It is
    // never interpreted as markup, so no HTML escaping is needed at this layer
    // — and escaping here would corrupt the stored message.
    content: row.content,
    sender: {
      id: row.sender.id,
      name: row.sender.name,
      image: row.sender.image,
    },
    createdAt: row.createdAt.toISOString(),
  };
}

export function toMessageDtos(rows: readonly MessageWithSender[]): MessageDto[] {
  return rows.map(toMessageDto);
}

export function toRoomDto(row: RoomRow): RoomDto {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    entityType: row.entityType,
    entityId: row.entityId,
  };
}
