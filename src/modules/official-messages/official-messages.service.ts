/**
 * F73 — official messages from the High Council.
 *
 * An administrator publishes one short message: what residents must know and
 * what they must do. It reaches every screen at once (signed in or not) and
 * every resident's notifications, and leaves by itself when it expires or is
 * withdrawn. Only administrators write; everyone reads the current one.
 */

import { isAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { publishOfficialMessageUpdated } from "@/lib/socket/emit";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { createNotification, notifyInBackground } from "../notifications/notifications.service";
import type { OfficialMessageInput } from "./official-messages.schema";

export type OfficialMessageState = "ACTIVE" | "EXPIRED" | "WITHDRAWN";

export interface OfficialMessageDto {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly action: string | null;
  readonly linkHref: string | null;
  readonly publishedAt: string;
  readonly expiresAt: string | null;
  readonly withdrawnAt: string | null;
  readonly state: OfficialMessageState;
  /** Who published it; only sent to administrators. */
  readonly author: string | null;
}

interface Row {
  id: string;
  title: string;
  body: string;
  action: string | null;
  linkHref: string | null;
  publishedAt: Date;
  expiresAt: Date | null;
  withdrawnAt: Date | null;
  author?: { name: string } | null;
}

function stateOf(row: Row, now: Date): OfficialMessageState {
  if (row.withdrawnAt) return "WITHDRAWN";
  if (row.expiresAt && row.expiresAt <= now) return "EXPIRED";
  return "ACTIVE";
}

function toDto(row: Row, withAuthor: boolean, now = new Date()): OfficialMessageDto {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    action: row.action,
    linkHref: row.linkHref,
    publishedAt: row.publishedAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
    state: stateOf(row, now),
    author: withAuthor ? (row.author?.name ?? null) : null,
  };
}

/**
 * Every page asks for the current message, so the answer is kept a few
 * seconds; publishing or withdrawing clears it at once.
 */
const CACHE_MS = 10_000;
let cached: { at: number; value: OfficialMessageDto | null } | null = null;

export async function getCurrentOfficialMessage(): Promise<OfficialMessageDto | null> {
  const nowMs = Date.now();
  if (cached && nowMs - cached.at < CACHE_MS) {
    // An expiry can fall inside the cache window.
    if (cached.value?.expiresAt && new Date(cached.value.expiresAt).getTime() <= nowMs) return null;
    return cached.value;
  }
  const now = new Date(nowMs);
  const row = await prisma.officialMessage.findFirst({
    where: { withdrawnAt: null, publishedAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    orderBy: { publishedAt: "desc" },
  });
  const value = row ? toDto(row, false, now) : null;
  cached = { at: nowMs, value };
  return value;
}

function assertCouncil(actor: AuthUser): void {
  if (!isAdmin(actor)) throw new ForbiddenError("Only the High Council can publish an official message.");
}

export async function listOfficialMessages(actor: AuthUser): Promise<OfficialMessageDto[]> {
  assertCouncil(actor);
  const rows = await prisma.officialMessage.findMany({ orderBy: { publishedAt: "desc" }, take: 30, include: { author: { select: { name: true } } } });
  const now = new Date();
  return rows.map((row) => toDto(row, true, now));
}

/** In-app notice for everyone, capped so a huge user base cannot stall the call. */
async function notifyEveryone(message: { title: string; body: string; linkHref: string | null }): Promise<void> {
  const users = await prisma.user.findMany({ where: { banned: false }, select: { id: true }, take: 2_000 });
  for (const user of users) {
    await createNotification({
      userId: user.id,
      type: "ANNOUNCEMENT",
      title: `Message officiel du Haut Conseil : ${message.title.slice(0, 110)}`,
      body: message.body,
      link: message.linkHref ?? "/announcements",
    });
  }
}

export async function publishOfficialMessage(input: OfficialMessageInput, actor: AuthUser, ip: string | null): Promise<OfficialMessageDto> {
  assertCouncil(actor);
  const now = new Date();
  // One official message at a time: a new one replaces the one on screen.
  const row = await prisma.$transaction(async (tx) => {
    await tx.officialMessage.updateMany({ where: { withdrawnAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, data: { withdrawnAt: now } });
    return tx.officialMessage.create({
      data: {
        title: input.title,
        body: input.body,
        action: input.action,
        linkHref: input.linkHref,
        authorId: actor.id,
        publishedAt: now,
        expiresAt: input.durationHours ? new Date(now.getTime() + input.durationHours * 3_600_000) : null,
      },
      include: { author: { select: { name: true } } },
    });
  });
  cached = null;
  await recordAudit({
    actorId: actor.id,
    action: auditActions.officialMessageChanged,
    targetType: "official_message",
    targetId: row.id,
    metadata: { op: "publish", title: row.title, durationHours: input.durationHours },
    ip,
  });
  publishOfficialMessageUpdated({ id: row.id, action: "published" });
  notifyInBackground(notifyEveryone(row), { officialMessageId: row.id });
  return toDto(row, true, now);
}

export async function withdrawOfficialMessage(id: string, actor: AuthUser, ip: string | null): Promise<OfficialMessageDto> {
  assertCouncil(actor);
  const existing = await prisma.officialMessage.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("This official message does not exist.");
  const row = existing.withdrawnAt
    ? await prisma.officialMessage.findUniqueOrThrow({ where: { id }, include: { author: { select: { name: true } } } })
    : await prisma.officialMessage.update({ where: { id }, data: { withdrawnAt: new Date() }, include: { author: { select: { name: true } } } });
  cached = null;
  if (!existing.withdrawnAt) {
    await recordAudit({ actorId: actor.id, action: auditActions.officialMessageChanged, targetType: "official_message", targetId: row.id, metadata: { op: "withdraw", title: row.title }, ip });
    publishOfficialMessageUpdated({ id: row.id, action: "withdrawn" });
  }
  return toDto(row, true);
}
