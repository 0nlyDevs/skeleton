/**
 * Data rights (RGPD): export everything about me, delete my account.
 *
 * The export is assembled server-side from the same rows the app uses, with
 * encrypted fields decrypted, and never includes secrets (password hashes,
 * session tokens, 2FA secrets) or other people's private data. Deleting an
 * account requires the current password (or, for accounts without one,
 * typing the username), revokes every session, and cascades the user's rows.
 */

import { verifyPassword } from "@/lib/auth/password";
import { decryptField } from "@/lib/crypto/field-encryption";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import { disconnectUserSockets } from "@/lib/socket/emit";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";

export async function exportMyData(actor: AuthUser): Promise<Record<string, unknown>> {
  await enforceThenRecord([{ key: rateLimitKey("account:export", actor.id), rule: RATE_LIMITS.dataExport }]);
  const id = actor.id;
  const [user, posts, comments, reactions, messages, follows, followers, groups, pages, bookmarks, votes, notifications, sessions] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, username: true, firstName: true, lastName: true, email: true, emailVerified: true, image: true, banner: true,
        bio: true, role: true, birthDateEncrypted: true, showPresence: true, autoLocation: true, twoFactorEnabled: true, createdAt: true,
      },
    }),
    prisma.post.findMany({
      where: { userId: id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, body: true, audience: true, published: true, placeName: true, latitude: true, longitude: true, createdAt: true, editedAt: true, groupId: true, repostOfId: true },
    }),
    prisma.comment.findMany({ where: { userId: id, deletedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, postId: true, body: true, createdAt: true } }),
    prisma.postReaction.findMany({ where: { userId: id }, select: { postId: true, type: true, createdAt: true } }),
    prisma.message.findMany({ where: { senderId: id, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 10_000, select: { id: true, roomId: true, content: true, createdAt: true, editedAt: true } }),
    prisma.follow.findMany({ where: { followerId: id }, select: { following: { select: { username: true } }, createdAt: true } }),
    prisma.follow.findMany({ where: { followingId: id }, select: { follower: { select: { username: true } }, createdAt: true } }),
    prisma.groupMember.findMany({ where: { userId: id }, select: { role: true, status: true, createdAt: true, group: { select: { slug: true, name: true } } } }),
    prisma.page.findMany({ where: { userId: id, deletedAt: null }, select: { slug: true, title: true, tagline: true, blocks: true, published: true, visibility: true, createdAt: true } }),
    prisma.postBookmark.findMany({ where: { userId: id }, select: { postId: true, createdAt: true } }),
    prisma.pollVote.findMany({ where: { userId: id }, select: { pollId: true, optionId: true, createdAt: true } }),
    prisma.notification.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 1_000, select: { type: true, title: true, body: true, link: true, read: true, createdAt: true } }),
    prisma.session.findMany({ where: { userId: id }, select: { createdAt: true, expiresAt: true, ipAddress: true, userAgent: true } }),
  ]);
  // F55 — what the city holds about the resident goes in too: requests and the
  // public exchanges on them (never agents' internal notes), devices, passkeys.
  const [cityRequests, devices, passkeys, zone] = await Promise.all([
    prisma.cityRequest.findMany({
      where: { citizenId: id },
      orderBy: { createdAt: "desc" },
      include: {
        service: { select: { name: true } },
        messages: { where: { internal: false }, orderBy: { createdAt: "asc" }, select: { body: true, authorId: true, createdAt: true } },
      },
    }),
    prisma.knownDevice.findMany({ where: { userId: id }, select: { label: true, firstSeenAt: true, lastSeenAt: true } }),
    prisma.passkey.findMany({ where: { userId: id }, select: { name: true, createdAt: true, backedUp: true } }),
    prisma.user.findUnique({ where: { id }, select: { cityZone: true } }),
  ]);
  if (!user) throw new ForbiddenError();

  const { birthDateEncrypted, ...profile } = user;
  return {
    exportedAt: new Date().toISOString(),
    profile: { ...profile, birthDate: birthDateEncrypted ? decryptField(birthDateEncrypted) : null },
    posts,
    comments,
    reactions,
    messagesSent: messages.map((message) => ({ ...message, content: message.content ? decryptField(message.content) : "" })),
    following: follows.map((row) => ({ username: row.following.username, since: row.createdAt })),
    followers: followers.map((row) => ({ username: row.follower.username, since: row.createdAt })),
    groups: groups.map((row) => ({ ...row.group, role: row.role, status: row.status, since: row.createdAt })),
    pages,
    savedPosts: bookmarks,
    pollVotes: votes,
    notifications: notifications.map((row) => ({ ...row, body: row.body ? decryptField(row.body) : null })),
    sessions,
    district: zone?.cityZone ?? null,
    cityRequests: cityRequests.map((row) => ({
      reference: row.reference,
      subject: row.subject,
      service: row.service?.name ?? null,
      status: row.status,
      message: decryptField(row.message),
      location: row.location ? decryptField(row.location) : null,
      createdAt: row.createdAt,
      closedAt: row.closedAt,
      exchanges: row.messages.map((message) => ({
        from: message.authorId === id ? "you" : "city",
        body: decryptField(message.body),
        at: message.createdAt,
      })),
    })),
    devices,
    passkeys,
  };
}

export async function deleteMyAccount(input: { password?: string; confirmUsername?: string }, actor: AuthUser, ip: string | null): Promise<void> {
  await enforceThenRecord([{ key: rateLimitKey("account:delete", actor.id), rule: RATE_LIMITS.passwordChange }]);
  const account = await prisma.account.findFirst({ where: { userId: actor.id, providerId: "credential" }, select: { password: true } });
  if (account?.password) {
    if (!input.password || !(await verifyPassword(account.password, input.password))) {
      throw new ValidationError({ password: "The password is incorrect." }, "The password is incorrect.");
    }
  } else if (!actor.username || input.confirmUsername?.trim().toLowerCase() !== actor.username.toLowerCase()) {
    throw new ValidationError({ confirmUsername: "Type your username to confirm." }, "Type your username to confirm.");
  }

  const admins = actor.role === "ADMIN" ? await prisma.user.count({ where: { role: "ADMIN", banned: false } }) : 2;
  if (admins <= 1) throw new ForbiddenError("The last administrator cannot delete their account.");

  await recordAudit({ actorId: null, action: auditActions.userDeleted, targetType: "user", targetId: actor.id, metadata: {}, ip });
  disconnectUserSockets(actor.id);
  // Owned groups would be orphaned: they go with their owner.
  await prisma.$transaction([prisma.session.deleteMany({ where: { userId: actor.id } }), prisma.user.delete({ where: { id: actor.id } })]);
}
