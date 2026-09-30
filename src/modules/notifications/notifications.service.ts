/**
 * Notification service.
 *
 * `createNotification` is the single entry point for every notification in the
 * application. It does three things, always in this order:
 *
 *   1. persist the row (the durable record — this is what the bell reads),
 *   2. publish a realtime frame to the user's personal room (the toast), and
 *   3. send an email **only** if the recipient opted in for that type.
 *
 * Steps 2 and 3 are best-effort and never fail the caller. A notification that
 * reached the database but did not reach a socket is a delayed toast; a
 * notification that fails the whole operation is a lost message.
 */

import type { NotificationType } from "@/generated/prisma/client";

import { logger } from "@/lib/logger";
import { sendNotificationEmail } from "@/lib/mail/transactional";
import { paginate, toPagination, type Paginated } from "@/lib/pagination";
import { publishNotification } from "@/lib/socket/emit";
import { truncate } from "@/lib/utils";

import {
  countNotifications,
  countUnreadNotifications,
  createNotification as insertNotification,
  findNotifications,
  findPreferences,
  findRecipient,
  markAllNotificationsRead,
  markNotificationsRead,
  upsertPreferences,
} from "./notifications.repository";
import {
  toNotificationDto,
  toNotificationPayload,
  toPreferencesDto,
  type NotificationDto,
  type NotificationPreferencesDto,
} from "./notifications.dto";
import type {
  ListNotificationsQuery,
  NotificationPreferencesInput,
} from "./notifications.schema";

export interface CreateNotificationInput {
  readonly userId: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body?: string | null;
  readonly link?: string | null;
  /** Send an email as well, when the recipient's preferences allow it. */
  readonly email?: boolean;
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<NotificationDto> {
  const row = await insertNotification({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  });

  const dto = toNotificationDto(row);

  publishNotification(input.userId, toNotificationPayload(dto));

  if (input.email) {
    void deliverEmail(input).catch((error: unknown) => {
      logger.warn("notification email failed", { userId: input.userId, error });
    });
  }

  return dto;
}

async function deliverEmail(input: CreateNotificationInput): Promise<void> {
  const recipient = await findRecipient(input.userId);
  if (!recipient) return;

  const preferences = recipient.preferences ?? (await findPreferences(input.userId));

  const wantsEmail =
    input.type === "MENTION"
      ? (preferences?.emailOnMention ?? true)
      : input.type === "NEW_MESSAGE"
        ? (preferences?.emailOnMessage ?? false)
        : (preferences?.emailOnSystem ?? true);

  if (!wantsEmail) return;

  const path = input.link ?? "/notifications";

  await sendNotificationEmail({
    to: recipient.email,
    name: recipient.name,
    title: input.title,
    body: input.body ?? null,
    path,
  });
}

// --- Typed helpers ----------------------------------------------------------

export async function notifySystemMessage(input: {
  userId: string;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  await createNotification({ ...input, type: "SYSTEM", email: true });
}

export async function notifyRoleChanged(userId: string, role: string): Promise<void> {
  await createNotification({
    userId,
    type: "ROLE_CHANGED",
    title: "Votre rôle a changé",
    body: `Votre compte est maintenant ${role.toLowerCase()}. Déconnectez-vous puis reconnectez-vous si le changement n'est pas encore visible.`,
    link: "/dashboard",
    email: true,
  });
}

export async function notifyNewMessage(input: {
  userId: string;
  senderName: string;
  roomId: string;
  preview: string;
}): Promise<void> {
  await createNotification({
    userId: input.userId,
    type: "NEW_MESSAGE",
    title: `Nouveau message de ${input.senderName}`,
    body: truncate(input.preview, 140),
    link: `/chat?room=${encodeURIComponent(input.roomId)}`,
    email: true,
  });
}

export async function notifyMention(input: {
  userId: string;
  senderName: string;
  roomId: string;
  preview: string;
}): Promise<void> {
  await createNotification({
    userId: input.userId,
    type: "MENTION",
    title: `${input.senderName} vous a mentionné`,
    body: truncate(input.preview, 140),
    link: `/chat?room=${encodeURIComponent(input.roomId)}`,
    email: true,
  });
}

// --- Reads and mutations ----------------------------------------------------

export async function listNotifications(
  userId: string,
  query: ListNotificationsQuery,
): Promise<Paginated<NotificationDto>> {
  const pagination = toPagination(query);
  const where = { userId, ...(query.unreadOnly ? { read: false } : {}) };

  const [rows, total] = await Promise.all([
    findNotifications({ where, skip: pagination.skip, take: pagination.take }),
    countNotifications(where),
  ]);

  return paginate(rows.map(toNotificationDto), {
    page: pagination.page,
    limit: pagination.limit,
    total,
  });
}

export async function getUnreadCount(userId: string): Promise<number> {
  return countUnreadNotifications(userId);
}

/** Mark one as read. Returns whether a row actually changed. */
export async function markNotificationRead(userId: string, id: string): Promise<boolean> {
  const changed = await markNotificationsRead(userId, [id]);
  return changed > 0;
}

/** Mark an explicit set, or everything when `ids` is omitted. */
export async function markRead(
  userId: string,
  ids?: readonly string[],
): Promise<number> {
  return ids && ids.length > 0
    ? markNotificationsRead(userId, ids)
    : markAllNotificationsRead(userId);
}

export async function getPreferences(
  userId: string,
): Promise<NotificationPreferencesDto> {
  const row = await findPreferences(userId);
  if (row) return toPreferencesDto(row);

  // Accounts created outside the sign-up hook (seed data, imports) may not have
  // a row yet; materialize the defaults instead of returning a 404.
  const created = await upsertPreferences(userId, {});
  return toPreferencesDto(created);
}

export async function updatePreferences(
  userId: string,
  input: NotificationPreferencesInput,
): Promise<NotificationPreferencesDto> {
  const row = await upsertPreferences(userId, input);
  return toPreferencesDto(row);
}
