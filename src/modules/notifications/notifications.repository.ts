/**
 * Notification persistence.
 *
 * Every read and update is scoped by `userId` inside the `where` clause, not
 * checked afterwards. `updateMany({ where: { id, userId } })` makes it
 * impossible to mark someone else's notification as read even if a future caller
 * forgets a guard — the ownership predicate is part of the query.
 */

import { type Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";

export interface FindNotificationsArgs {
  readonly where: Prisma.NotificationWhereInput;
  readonly skip: number;
  readonly take: number;
}

export async function createNotification(
  data: Prisma.NotificationUncheckedCreateInput,
): Promise<Prisma.NotificationGetPayload<Record<string, never>>> {
  return prisma.notification.create({ data });
}

export async function findNotifications(args: FindNotificationsArgs) {
  return prisma.notification.findMany({
    where: args.where,
    // Newest first, and `id` breaks ties so two notifications written in the
    // same millisecond still paginate deterministically.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: args.skip,
    take: args.take,
  });
}

export async function countNotifications(where: Prisma.NotificationWhereInput): Promise<number> {
  return prisma.notification.count({ where });
}

export async function countUnreadNotifications(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

/** Mark a specific set as read. Returns how many rows changed. */
export async function markNotificationsRead(
  userId: string,
  ids: readonly string[],
): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, id: { in: [...ids] }, read: false },
    data: { read: true },
  });
  return count;
}

export async function markAllNotificationsRead(userId: string): Promise<number> {
  const { count } = await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return count;
}

/**
 * Recipient projection for the email step: just enough to address a message and
 * decide whether the user wants it. Selecting these columns keeps an email
 * address from travelling further than it has to.
 */
export async function findRecipient(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      preferences: {
        select: { emailOnMessage: true, emailOnMention: true, emailOnSystem: true },
      },
    },
  });
}

export async function findPreferences(userId: string) {
  return prisma.notificationPreference.findUnique({ where: { userId } });
}

export async function upsertPreferences(
  userId: string,
  data: Omit<Prisma.NotificationPreferenceUncheckedCreateInput, "userId">,
) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}

/** Retention: drop read notifications older than the cutoff. */
export async function deleteReadNotificationsOlderThan(cutoff: Date): Promise<number> {
  const { count } = await prisma.notification.deleteMany({
    where: { read: true, createdAt: { lt: cutoff } },
  });
  return count;
}
