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

import { encryptNullable } from "@/lib/crypto/field-encryption";
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
    // Bodies quote private content (message previews, comments): encrypted at rest.
    body: encryptNullable(input.body ?? null),
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

  // Conversation-style activity (mentions, comments, replies) follows the
  // mention switch; direct messages and group invites follow the message one.
  // Security alerts are not optional: they are how an owner learns of a takeover.
  const wantsEmail =
    input.type === "SECURITY" ||
    (input.type === "MENTION" || input.type === "POST_COMMENT" || input.type === "COMMENT_REPLY"
      ? (preferences?.emailOnMention ?? true)
      : input.type === "NEW_MESSAGE" || input.type === "GROUP_INVITE"
        ? (preferences?.emailOnMessage ?? false)
        : (preferences?.emailOnSystem ?? true));

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
    link: "/feed",
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
    link: `/messages?room=${encodeURIComponent(input.roomId)}`,
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
    link: `/messages?room=${encodeURIComponent(input.roomId)}`,
    email: true,
  });
}

/** Fire-and-forget wrapper: a failed bell entry must never fail the action. */
export function notifyInBackground(task: Promise<unknown>, context: Record<string, unknown>): void {
  void task.catch((error: unknown) => {
    logger.warn("notification failed", { ...context, error });
  });
}

function actorHandle(actor: { name: string }): string {
  return actor.name;
}

export async function notifyPostComment(input: {
  userId: string;
  actor: { name: string };
  postId: string;
  postTitle: string;
  preview: string;
}): Promise<void> {
  await createNotification({
    userId: input.userId,
    type: "POST_COMMENT",
    title: `${actorHandle(input.actor)} a commenté « ${truncate(input.postTitle, 60)} »`,
    body: truncate(input.preview, 140),
    link: `/feed/${encodeURIComponent(input.postId)}`,
    email: true,
  });
}

export async function notifyCommentReply(input: {
  userId: string;
  actor: { name: string };
  postId: string;
  preview: string;
}): Promise<void> {
  await createNotification({
    userId: input.userId,
    type: "COMMENT_REPLY",
    title: `${actorHandle(input.actor)} a répondu à votre commentaire`,
    body: truncate(input.preview, 140),
    link: `/feed/${encodeURIComponent(input.postId)}`,
    email: true,
  });
}

export async function notifyContentMention(input: {
  userId: string;
  actor: { name: string };
  postId: string;
  preview: string;
}): Promise<void> {
  await createNotification({
    userId: input.userId,
    type: "MENTION",
    title: `${actorHandle(input.actor)} vous a mentionné`,
    body: truncate(input.preview, 140),
    link: `/feed/${encodeURIComponent(input.postId)}`,
    email: true,
  });
}

export async function notifyPostReaction(input: {
  userId: string;
  actor: { name: string };
  postId: string;
  postTitle: string;
}): Promise<void> {
  // In-app only: an email per like is the fastest way to get unsubscribed.
  await createNotification({
    userId: input.userId,
    type: "POST_REACTION",
    title: `${actorHandle(input.actor)} a réagi à « ${truncate(input.postTitle, 60)} »`,
    link: `/feed/${encodeURIComponent(input.postId)}`,
  });
}

export async function notifyNewFollower(input: {
  userId: string;
  actor: { name: string; username: string | null };
}): Promise<void> {
  await createNotification({
    userId: input.userId,
    type: "NEW_FOLLOWER",
    title: `${actorHandle(input.actor)} vous suit désormais`,
    link: input.actor.username ? `/u/${encodeURIComponent(input.actor.username)}` : null,
  });
}

export async function notifyGroupInvite(input: {
  userId: string;
  actor: { name: string };
  roomId: string;
  groupName: string;
}): Promise<void> {
  await createNotification({
    userId: input.userId,
    type: "GROUP_INVITE",
    title: `${actorHandle(input.actor)} vous a ajouté au groupe « ${truncate(input.groupName, 60)} »`,
    link: `/messages?room=${encodeURIComponent(input.roomId)}`,
    email: true,
  });
}

export async function notifyPostShare(input: { userId: string; actor: { name: string }; postId: string }): Promise<void> {
  await createNotification({
    userId: input.userId,
    type: "POST_SHARE",
    title: `${input.actor.name} a partagé votre publication`,
    link: `/feed/${encodeURIComponent(input.postId)}`,
  });
}

/** Membership events in a community group (request, approval, role change). */
export async function notifyGroupActivity(input: {
  userId: string;
  title: string;
  body?: string | null;
  groupSlug: string;
  path?: string;
}): Promise<void> {
  await createNotification({
    userId: input.userId,
    type: "GROUP_ACTIVITY",
    title: truncate(input.title, 180),
    body: input.body ? truncate(input.body, 200) : null,
    link: input.path ?? `/groups/${encodeURIComponent(input.groupSlug)}`,
  });
}

/** Staff removed something the user wrote; they deserve to know, and why. */
export async function notifyModeration(input: {
  userId: string;
  what: string;
  reason?: string | null;
}): Promise<void> {
  await createNotification({
    userId: input.userId,
    type: "MODERATION",
    title: `Votre ${input.what} a été retiré par la modération`,
    body: input.reason ? truncate(input.reason, 200) : "Il ne respectait pas les règles de la communauté.",
    link: "/notifications",
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
