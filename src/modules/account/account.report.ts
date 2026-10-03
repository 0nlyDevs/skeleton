/**
 * F55 — the personal data the city holds about a resident, as a readable
 * report rather than a raw dump: what there is, a few telling details, and for
 * each part what it is for, who can see it and how long it is kept. The JSON
 * export (`exportMyData`) stays available for re-use.
 */

import { prisma } from "@/lib/db/prisma";
import { decryptField } from "@/lib/crypto/field-encryption";
import type { AuthUser } from "@/types";

export interface DataReport {
  readonly generatedAt: string;
  readonly identity: {
    readonly name: string;
    readonly username: string | null;
    readonly email: string | null;
    readonly emailVerified: boolean;
    readonly birthDate: string | null;
    readonly role: string;
    readonly createdAt: string;
    readonly district: string | null;
    readonly hasPhoto: boolean;
    readonly hasBio: boolean;
  };
  readonly security: {
    readonly twoFactor: boolean;
    readonly passkeys: readonly { readonly name: string | null; readonly createdAt: string | null }[];
    readonly devices: readonly { readonly label: string; readonly lastSeenAt: string }[];
    readonly activeSessions: number;
  };
  readonly requests: {
    readonly count: number;
    readonly open: number;
    readonly latest: readonly { readonly reference: string; readonly subject: string; readonly status: string; readonly createdAt: string }[];
  };
  readonly community: { readonly posts: number; readonly comments: number; readonly messagesSent: number; readonly groups: number; readonly followers: number; readonly following: number };
  readonly notifications: number;
}

export async function buildDataReport(actor: AuthUser): Promise<DataReport> {
  const id = actor.id;
  const [user, passkeys, devices, sessions, requests, openRequests, posts, comments, messages, groups, followers, following, notifications] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      select: { name: true, username: true, email: true, emailVerified: true, birthDateEncrypted: true, role: true, createdAt: true, cityZone: true, image: true, bio: true, twoFactorEnabled: true },
    }),
    prisma.passkey.findMany({ where: { userId: id }, select: { name: true, createdAt: true } }),
    prisma.knownDevice.findMany({ where: { userId: id }, orderBy: { lastSeenAt: "desc" }, select: { label: true, lastSeenAt: true } }),
    prisma.session.count({ where: { userId: id, expiresAt: { gt: new Date() } } }),
    prisma.cityRequest.findMany({ where: { citizenId: id }, orderBy: { createdAt: "desc" }, take: 5, select: { reference: true, subject: true, status: true, createdAt: true } }),
    prisma.cityRequest.count({ where: { citizenId: id, status: { in: ["NEW", "IN_PROGRESS", "WAITING_CITIZEN"] } } }),
    prisma.post.count({ where: { userId: id, deletedAt: null } }),
    prisma.comment.count({ where: { userId: id, deletedAt: null } }),
    prisma.message.count({ where: { senderId: id, deletedAt: null } }),
    prisma.groupMember.count({ where: { userId: id } }),
    prisma.follow.count({ where: { followingId: id } }),
    prisma.follow.count({ where: { followerId: id } }),
    prisma.notification.count({ where: { userId: id } }),
  ]);
  const requestCount = await prisma.cityRequest.count({ where: { citizenId: id } });
  return {
    generatedAt: new Date().toISOString(),
    identity: {
      name: user?.name ?? actor.name,
      username: user?.username ?? null,
      email: user?.email ?? null,
      emailVerified: user?.emailVerified ?? false,
      birthDate: user?.birthDateEncrypted ? decryptField(user.birthDateEncrypted) : null,
      role: user?.role ?? actor.role,
      createdAt: (user?.createdAt ?? new Date()).toISOString(),
      district: user?.cityZone ?? null,
      hasPhoto: Boolean(user?.image),
      hasBio: Boolean(user?.bio),
    },
    security: {
      twoFactor: user?.twoFactorEnabled ?? false,
      passkeys: passkeys.map((key) => ({ name: key.name, createdAt: key.createdAt?.toISOString() ?? null })),
      devices: devices.map((device) => ({ label: device.label, lastSeenAt: device.lastSeenAt.toISOString() })),
      activeSessions: sessions,
    },
    requests: {
      count: requestCount,
      open: openRequests,
      latest: requests.map((row) => ({ reference: row.reference, subject: row.subject, status: row.status, createdAt: row.createdAt.toISOString() })),
    },
    community: { posts, comments, messagesSent: messages, groups, followers, following },
    notifications,
  };
}
