import type { Notification, NotificationPreference } from "@/generated/prisma/client";

import type { NotificationPayload } from "@/lib/socket/events";

export interface NotificationDto {
  readonly id: string;
  readonly type: string;
  readonly title: string;
  readonly body: string | null;
  readonly link: string | null;
  readonly read: boolean;
  readonly createdAt: string;
}

export interface NotificationPreferencesDto {
  readonly emailOnMessage: boolean;
  readonly emailOnMention: boolean;
  readonly emailOnSystem: boolean;
}

export function toNotificationDto(row: Notification): NotificationDto {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    read: row.read,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toNotificationDtos(rows: readonly Notification[]): NotificationDto[] {
  return rows.map(toNotificationDto);
}

/** The realtime frame sent alongside a new notification. */
export function toNotificationPayload(dto: NotificationDto): NotificationPayload {
  return {
    id: dto.id,
    type: dto.type,
    title: dto.title,
    body: dto.body,
    link: dto.link,
    read: dto.read,
    createdAt: dto.createdAt,
  };
}

export function toPreferencesDto(row: NotificationPreference): NotificationPreferencesDto {
  return {
    emailOnMessage: row.emailOnMessage,
    emailOnMention: row.emailOnMention,
    emailOnSystem: row.emailOnSystem,
  };
}
