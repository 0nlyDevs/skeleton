/**
 * F76 — comments left after using a service.
 *
 *   - a resident rates a service and says how it went, on its own or right
 *     after one of their requests (one comment per request);
 *   - the comment gets a reference and a visible trail: received, read by the
 *     service, answered. Each step notifies the resident;
 *   - comments stay between the resident and the city (encrypted at rest);
 *     everyone only sees the service's overall satisfaction.
 */

import { randomInt } from "node:crypto";

import { isStaff } from "@/lib/auth/guards";
import { decryptField, decryptNullable, encryptField } from "@/lib/crypto/field-encryption";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { createNotification, notifyInBackground } from "../notifications/notifications.service";
import type { CreateServiceFeedbackInput, ListServiceFeedbackQuery, UpdateServiceFeedbackInput } from "./service-feedback.schema";

const include = {
  service: { select: { slug: true, name: true } },
  request: { select: { reference: true, subject: true } },
  user: { select: { id: true, name: true } },
} as const;

type Row = Awaited<ReturnType<typeof prisma.serviceFeedback.findFirstOrThrow<{ include: typeof include }>>>;

export interface ServiceFeedbackDto {
  readonly reference: string;
  readonly rating: number;
  readonly comment: string;
  readonly status: "RECEIVED" | "READ" | "ANSWERED";
  readonly service: { readonly slug: string; readonly name: string };
  readonly request: { readonly reference: string; readonly subject: string } | null;
  /** Who wrote it; only sent to staff. */
  readonly author: { readonly id: string; readonly name: string } | null;
  readonly createdAt: string;
  readonly readAt: string | null;
  readonly reply: string | null;
  readonly repliedAt: string | null;
}

function toDto(row: Row, forStaff: boolean): ServiceFeedbackDto {
  return {
    reference: row.reference,
    rating: row.rating,
    comment: decryptField(row.comment),
    status: row.status,
    service: row.service,
    request: row.request,
    author: forStaff ? row.user : null,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString() ?? null,
    reply: decryptNullable(row.reply),
    repliedAt: row.repliedAt?.toISOString() ?? null,
  };
}

async function newReference(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const reference = `AV-${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
    if (!(await prisma.serviceFeedback.findUnique({ where: { reference }, select: { id: true } }))) return reference;
  }
  throw new Error("Could not allocate a feedback reference.");
}

async function staffIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({ where: { role: { in: ["AGENT", "ADMIN"] }, banned: false }, select: { id: true }, take: 200 });
  return rows.map((row) => row.id);
}

export async function createServiceFeedback(input: CreateServiceFeedbackInput, actor: AuthUser, ip: string | null): Promise<ServiceFeedbackDto> {
  await enforceThenRecord([{ key: rateLimitKey("service-feedback:create", actor.id), rule: RATE_LIMITS.serviceFeedback }]);
  const service = await prisma.municipalService.findFirst({ where: { slug: input.serviceSlug, active: true }, select: { id: true, name: true } });
  if (!service) throw new NotFoundError("This service does not exist.");

  let requestId: string | null = null;
  if (input.requestReference) {
    // Someone else's request reads as "does not exist", never as "forbidden".
    const request = await prisma.cityRequest.findUnique({ where: { reference: input.requestReference }, select: { id: true, citizenId: true } });
    if (!request || request.citizenId !== actor.id) throw new NotFoundError("This request does not exist.");
    if (await prisma.serviceFeedback.findUnique({ where: { userId_requestId: { userId: actor.id, requestId: request.id } }, select: { id: true } })) {
      throw new ConflictError("You already left a comment on this request.");
    }
    requestId = request.id;
  }

  const row = await prisma.serviceFeedback.create({
    data: {
      reference: await newReference(),
      userId: actor.id,
      serviceId: service.id,
      requestId,
      rating: input.rating,
      comment: encryptField(input.comment),
    },
    include,
  });
  // The trail keeps that a comment was left and its rating, never its text.
  await recordAudit({ actorId: actor.id, action: auditActions.serviceFeedbackChanged, targetType: "service_feedback", targetId: row.id, metadata: { op: "create", reference: row.reference, service: service.name, rating: row.rating }, ip });

  notifyInBackground(
    (async () => {
      await createNotification({
        userId: actor.id,
        type: "CITY_REQUEST",
        title: `Avis ${row.reference} bien reçu`,
        body: `Votre avis sur « ${service.name} » est enregistré. Vous serez prévenu·e quand le service l'aura lu, et s'il vous répond.`,
        link: `/space/feedback#${row.reference}`,
      });
      for (const id of await staffIds()) {
        if (id === actor.id) continue;
        await createNotification({ userId: id, type: "CITY_REQUEST", title: `Nouvel avis ${row.reference} sur « ${service.name} »`, link: `/agent/feedback#${row.reference}` });
      }
    })(),
    { serviceFeedbackId: row.id },
  );
  return toDto(row, false);
}

export interface ServiceFeedbackPage {
  readonly data: ServiceFeedbackDto[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
  /** For staff: how many comments wait in each state. */
  readonly counts?: Record<string, number>;
}

export async function listServiceFeedback(query: ListServiceFeedbackQuery, actor: AuthUser): Promise<ServiceFeedbackPage> {
  const staff = isStaff(actor);
  if (query.scope === "all" && !staff) throw new ForbiddenError("Only city agents can read every comment.");
  const all = query.scope === "all";
  const where = {
    ...(all ? {} : { userId: actor.id }),
    ...(query.status ? { status: query.status } : {}),
    ...(query.service ? { service: { slug: query.service } } : {}),
  };
  const [rows, total, grouped] = await Promise.all([
    prisma.serviceFeedback.findMany({ where, include, orderBy: [{ createdAt: "desc" }], skip: (query.page - 1) * query.limit, take: query.limit }),
    prisma.serviceFeedback.count({ where }),
    all ? prisma.serviceFeedback.groupBy({ by: ["status"], _count: { _all: true } }) : Promise.resolve([]),
  ]);
  return {
    data: rows.map((row) => toDto(row, all)),
    total,
    page: query.page,
    pageCount: Math.ceil(total / query.limit),
    ...(all ? { counts: Object.fromEntries(grouped.map((entry) => [entry.status, entry._count._all])) } : {}),
  };
}

export async function updateServiceFeedback(reference: string, input: UpdateServiceFeedbackInput, actor: AuthUser, ip: string | null): Promise<ServiceFeedbackDto> {
  if (!isStaff(actor)) throw new NotFoundError("This comment does not exist.");
  const existing = await prisma.serviceFeedback.findUnique({ where: { reference }, include });
  if (!existing) throw new NotFoundError("This comment does not exist.");
  const now = new Date();

  if (input.reply) {
    const row = await prisma.serviceFeedback.update({
      where: { id: existing.id },
      data: { status: "ANSWERED", reply: encryptField(input.reply), repliedById: actor.id, repliedAt: now, readAt: existing.readAt ?? now },
      include,
    });
    await recordAudit({ actorId: actor.id, action: auditActions.serviceFeedbackChanged, targetType: "service_feedback", targetId: row.id, metadata: { op: "reply", reference: row.reference, service: row.service.name }, ip });
    notifyInBackground(
      createNotification({
        userId: row.userId,
        type: "CITY_REQUEST",
        title: `Le service a répondu à votre avis ${row.reference}`,
        body: `« ${row.service.name} » a répondu à votre avis. Lisez sa réponse dans « Mes avis ».`,
        link: `/space/feedback#${row.reference}`,
        email: true,
      }),
      { serviceFeedbackId: row.id },
    );
    return toDto(row, true);
  }

  if (existing.status !== "RECEIVED") return toDto(existing, true);
  const row = await prisma.serviceFeedback.update({ where: { id: existing.id }, data: { status: "READ", readAt: now }, include });
  await recordAudit({ actorId: actor.id, action: auditActions.serviceFeedbackChanged, targetType: "service_feedback", targetId: row.id, metadata: { op: "read", reference: row.reference, service: row.service.name }, ip });
  notifyInBackground(
    createNotification({
      userId: row.userId,
      type: "CITY_REQUEST",
      title: `Votre avis ${row.reference} a été lu`,
      body: `Un agent de « ${row.service.name} » a lu votre avis. Il est pris en compte.`,
      link: `/space/feedback#${row.reference}`,
    }),
    { serviceFeedbackId: row.id },
  );
  return toDto(row, true);
}

export interface ServiceSatisfactionDto {
  readonly count: number;
  /** Average rating out of 5, one decimal; null without comments. */
  readonly average: number | null;
  /** Share of ratings of 4 or 5, in percent. */
  readonly satisfied: number | null;
}

/** What everyone sees: totals only, never a comment or a name. */
export async function serviceSatisfaction(serviceId: string): Promise<ServiceSatisfactionDto> {
  const [all, happy] = await Promise.all([
    prisma.serviceFeedback.aggregate({ where: { serviceId }, _count: { _all: true }, _avg: { rating: true } }),
    prisma.serviceFeedback.count({ where: { serviceId, rating: { gte: 4 } } }),
  ]);
  const count = all._count._all;
  if (count === 0) return { count: 0, average: null, satisfied: null };
  return { count, average: Math.round((all._avg.rating ?? 0) * 10) / 10, satisfied: Math.round((happy / count) * 100) };
}

/** The resident's requests that are finished and not yet commented, for "say how it went". */
export async function requestFeedbackState(requestId: string, userId: string): Promise<{ reference: string } | null> {
  const row = await prisma.serviceFeedback.findUnique({ where: { userId_requestId: { userId, requestId } }, select: { reference: true } });
  return row;
}
