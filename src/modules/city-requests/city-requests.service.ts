/**
 * Citizen requests to the city ("démarches").
 *
 *   - a citizen creates a request and only ever sees their own (others: 404);
 *   - city agents (MODERATOR) and administrators see and process them all:
 *     status, priority, assignment, replies and internal notes;
 *   - internal notes never reach the citizen; message bodies are encrypted
 *     at rest; every change is recorded in the request history.
 */

import { randomInt } from "node:crypto";

import { isStaff } from "@/lib/auth/guards";
import { decryptField, encryptField } from "@/lib/crypto/field-encryption";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { publishCityRequestUpdated } from "@/lib/socket/emit";
import { RATE_LIMITS, enforceThenRecord, rateLimitKey } from "@/lib/rate-limit";
import { roundCoordinate } from "@/modules/places/places.service";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { createNotification, notifyInBackground } from "../notifications/notifications.service";
import { decryptBody, toSummaryDto, type CityRequestDto, type CityRequestSummaryDto } from "./city-requests.dto";
import { ISSUE_SERVICE, type CreateCityRequestInput, type ListCityRequestsQuery, type UpdateCityRequestInput } from "./city-requests.schema";

const STATUS_LABEL: Record<string, string> = {
  NEW: "nouvelle",
  IN_PROGRESS: "en cours de traitement",
  WAITING_CITIZEN: "en attente de votre réponse",
  RESOLVED: "résolue",
  CLOSED: "fermée",
};

const summaryInclude = {
  service: { select: { slug: true, name: true } },
  citizen: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
  messages: { orderBy: { createdAt: "desc" as const }, take: 1, where: { internal: false }, select: { authorId: true } },
} as const;

async function newReference(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const reference = `TN-${String(randomInt(0, 1_000_000)).padStart(6, "0")}`;
    if (!(await prisma.cityRequest.findUnique({ where: { reference }, select: { id: true } }))) return reference;
  }
  throw new Error("Could not allocate a request reference.");
}

/** Push a "reload this request" signal to its citizen and to the agents (all of them for an internal note). */
async function pushRequestUpdate(row: { citizenId: string; assigneeId: string | null; reference: string }, actorId: string, staffOnly = false): Promise<void> {
  const staff = await staffIds();
  const audience = new Set<string>(staff);
  if (!staffOnly) audience.add(row.citizenId);
  audience.delete(actorId);
  publishCityRequestUpdated([...audience], { reference: row.reference });
}

async function staffIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({ where: { role: { in: ["MODERATOR", "ADMIN"] }, banned: false }, select: { id: true }, take: 200 });
  return rows.map((row) => row.id);
}

export async function createCityRequest(input: CreateCityRequestInput, actor: AuthUser, ip: string | null): Promise<CityRequestSummaryDto> {
  await enforceThenRecord([{ key: rateLimitKey("city-request:create", actor.id), rule: RATE_LIMITS.cityRequestCreate }]);
  let serviceId: string | null = null;
  if (input.serviceId) {
    const service = await prisma.municipalService.findFirst({ where: { id: input.serviceId, active: true }, select: { id: true } });
    if (!service) throw new NotFoundError("This service does not exist.");
    serviceId = service.id;
  } else if (input.issueType && ISSUE_SERVICE[input.issueType]) {
    // F25 — "I don't know which service to contact": a reported problem goes
    // to the service in charge of that kind of issue.
    const service = await prisma.municipalService.findFirst({ where: { slug: ISSUE_SERVICE[input.issueType] ?? "", active: true }, select: { id: true } });
    serviceId = service?.id ?? null;
  }
  const report = input.issueType
    ? {
        issueType: input.issueType,
        location: input.location ? encryptField(input.location) : null,
        // Round citizen-supplied coordinates the same way posts.service.ts does:
        // ~100 m is precise enough for a lamp post, too coarse for a front door,
        // and below the precision at which a GPS reading is personally identifying.
        latitude: input.latitude ? roundCoordinate(input.latitude) : null,
        longitude: input.longitude ? roundCoordinate(input.longitude) : null,
      }
    : {};
  const row = await prisma.cityRequest.create({
    data: {
      reference: await newReference(),
      citizenId: actor.id,
      serviceId,
      subject: input.subject,
      message: encryptField(input.message),
      ...report,
      events: { create: { actorId: actor.id, kind: "created", toValue: "NEW" } },
    },
    include: summaryInclude,
  });
  await recordAudit({ actorId: actor.id, action: auditActions.cityRequestChanged, targetType: "city_request", targetId: row.id, metadata: { op: "create", reference: row.reference, issueType: row.issueType ?? null, service: row.service?.name ?? null }, ip });

  notifyInBackground(
    (async () => {
      await createNotification({
        userId: actor.id,
        type: "CITY_REQUEST",
        title: `Demande ${row.reference} bien reçue`,
        body: `Votre demande « ${row.subject} » a été transmise aux services de Terra Nova. Vous serez prévenu·e à chaque étape.`,
        link: `/space/requests/${row.reference}`,
        email: true,
      });
      for (const id of await staffIds()) {
        if (id === actor.id) continue;
        await createNotification({
          userId: id,
          type: "CITY_REQUEST",
          title: `Nouvelle demande ${row.reference} : ${row.subject.slice(0, 80)}`,
          link: `/agent/requests/${row.reference}`,
        });
      }
    })(),
    { cityRequestId: row.id },
  );
  return toSummaryDto(row, false);
}

export interface CityRequestPage {
  readonly data: CityRequestSummaryDto[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
  readonly counts?: Record<string, number>;
}

export async function listCityRequests(query: ListCityRequestsQuery, actor: AuthUser): Promise<CityRequestPage> {
  const agent = isStaff(actor);
  if (query.scope !== "mine" && !agent) throw new ForbiddenError("Only city agents can see every request.");
  const scope =
    query.scope === "mine"
      ? { citizenId: actor.id }
      : query.scope === "assigned"
        ? { assigneeId: actor.id }
        : query.scope === "unassigned"
          ? { assigneeId: null }
          : {};
  const status =
    query.status === "OPEN"
      ? { status: { in: ["NEW", "IN_PROGRESS", "WAITING_CITIZEN"] as ("NEW" | "IN_PROGRESS" | "WAITING_CITIZEN")[] } }
      : query.status === "DONE"
        ? { status: { in: ["RESOLVED", "CLOSED"] as ("RESOLVED" | "CLOSED")[] } }
        : query.status
          ? { status: query.status }
        : {};
  const where = {
    ...scope,
    ...status,
    ...(query.service ? { service: { slug: query.service } } : {}),
    ...(query.q ? { OR: [{ subject: { contains: query.q } }, { reference: { contains: query.q.toUpperCase() } }] } : {}),
  };
  const [rows, total, grouped] = await Promise.all([
    prisma.cityRequest.findMany({
      where,
      include: summaryInclude,
      orderBy: query.scope === "mine" ? [{ updatedAt: "desc" }] : [{ status: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.cityRequest.count({ where }),
    query.scope === "mine" ? Promise.resolve([]) : prisma.cityRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  return {
    data: rows.map((row) => toSummaryDto({ ...row, lastFromCitizen: row.messages[0]?.authorId === row.citizen.id }, agent && query.scope !== "mine")),
    total,
    page: query.page,
    pageCount: Math.ceil(total / query.limit),
    ...(query.scope === "mine" ? {} : { counts: Object.fromEntries(grouped.map((entry) => [entry.status, entry._count._all])) }),
  };
}

async function loadAccessible(reference: string, actor: AuthUser) {
  const row = await prisma.cityRequest.findUnique({
    where: { reference },
    include: {
      ...summaryInclude,
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, name: true, role: true } } } },
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  // Not yours reads as "does not exist", never as "forbidden".
  if (!row || (row.citizenId !== actor.id && !isStaff(actor))) throw new NotFoundError("This request does not exist.");
  return row;
}

export async function getCityRequest(reference: string, actor: AuthUser): Promise<CityRequestDto> {
  const row = await loadAccessible(reference, actor);
  const agent = isStaff(actor);
  const visible = row.messages.filter((message) => agent || !message.internal);
  const last = [...visible].reverse().find((message) => !message.internal);
  return {
    ...toSummaryDto({ ...row, lastFromCitizen: last?.authorId === row.citizenId }, agent),
    message: decryptBody(row.message),
    location: row.location ? decryptField(row.location) : null,
    latitude: row.latitude,
    longitude: row.longitude,
    closedAt: row.closedAt?.toISOString() ?? null,
    messages: visible.map((message) => ({
      id: message.id,
      body: decryptBody(message.body),
      internal: message.internal,
      fromAgent: message.authorId !== row.citizenId,
      // Citizens see "Services de Terra Nova", never which agent answered.
      author: agent || message.authorId === row.citizenId ? { id: message.author.id, name: message.author.name } : { id: "city", name: "Services de Terra Nova" },
      createdAt: message.createdAt.toISOString(),
    })),
    events: row.events.map((event) => ({
      kind: event.kind,
      from: event.fromValue,
      to: event.toValue,
      actor: agent ? (event.actor?.name ?? null) : null,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export async function addCityRequestMessage(reference: string, input: { body: string; internal: boolean }, actor: AuthUser, ip: string | null = null): Promise<CityRequestDto> {
  const row = await loadAccessible(reference, actor);
  const agent = isStaff(actor);
  if (input.internal && !agent) throw new ForbiddenError("Only city agents can write internal notes.");
  if (row.status === "CLOSED") throw new ForbiddenError("This request is closed.");
  await enforceThenRecord([{ key: rateLimitKey("city-request:message", actor.id), rule: RATE_LIMITS.comment }]);

  const fromCitizen = row.citizenId === actor.id;
  await prisma.$transaction(async (tx) => {
    await tx.cityRequestMessage.create({ data: { requestId: row.id, authorId: actor.id, body: encryptField(input.body), internal: input.internal } });
    // A citizen's answer puts a waiting request back in the agents' queue.
    if (fromCitizen && (row.status === "WAITING_CITIZEN" || row.status === "RESOLVED")) {
      await tx.cityRequest.update({ where: { id: row.id }, data: { status: "IN_PROGRESS" } });
      await tx.cityRequestEvent.create({ data: { requestId: row.id, actorId: actor.id, kind: "status", fromValue: row.status, toValue: "IN_PROGRESS" } });
    } else {
      await tx.cityRequest.update({ where: { id: row.id }, data: { updatedAt: new Date() } });
    }
  });

  await pushRequestUpdate(row, actor.id, input.internal);
  // The trail keeps that an agent answered or noted something, never the text itself.
  if (agent && !fromCitizen) {
    await recordAudit({
      actorId: actor.id,
      action: auditActions.cityRequestChanged,
      targetType: "city_request",
      targetId: row.id,
      metadata: { op: input.internal ? "internal_note" : "reply", reference: row.reference },
      ip,
    });
  }

  if (!input.internal) {
    if (fromCitizen) {
      const target = row.assigneeId ? [row.assigneeId] : await staffIds();
      for (const id of target) {
        notifyInBackground(createNotification({ userId: id, type: "CITY_REQUEST", title: `Réponse du citoyen sur ${row.reference}`, link: `/agent/requests/${row.reference}` }), { cityRequestId: row.id });
      }
    } else {
      notifyInBackground(
        createNotification({
          userId: row.citizenId,
          type: "CITY_REQUEST",
          title: `Nouvelle réponse des services sur votre demande ${row.reference}`,
          link: `/space/requests/${row.reference}`,
          email: true,
        }),
        { cityRequestId: row.id },
      );
    }
  }
  return getCityRequest(reference, actor);
}

export async function updateCityRequest(reference: string, input: UpdateCityRequestInput, actor: AuthUser, ip: string | null): Promise<CityRequestDto> {
  if (!isStaff(actor)) throw new NotFoundError("This request does not exist.");
  const row = await loadAccessible(reference, actor);
  const events: { kind: string; fromValue: string | null; toValue: string | null }[] = [];
  const data: { status?: (typeof row)["status"]; priority?: (typeof row)["priority"]; assigneeId?: string | null; closedAt?: Date | null } = {};

  if (input.status && input.status !== row.status) {
    data.status = input.status;
    data.closedAt = input.status === "CLOSED" || input.status === "RESOLVED" ? new Date() : null;
    events.push({ kind: "status", fromValue: row.status, toValue: input.status });
  }
  if (input.priority && input.priority !== row.priority) {
    data.priority = input.priority;
    events.push({ kind: "priority", fromValue: row.priority, toValue: input.priority });
  }
  if (input.assignee !== undefined) {
    const next = input.assignee === "me" ? actor.id : null;
    if (next !== row.assigneeId) {
      data.assigneeId = next;
      events.push({ kind: "assignee", fromValue: row.assignee?.name ?? null, toValue: next ? actor.name : null });
      // Taking a new request starts processing it.
      if (next && row.status === "NEW" && !data.status) {
        data.status = "IN_PROGRESS";
        events.push({ kind: "status", fromValue: "NEW", toValue: "IN_PROGRESS" });
      }
    }
  }
  if (events.length > 0) {
    await prisma.$transaction([
      prisma.cityRequest.update({ where: { id: row.id }, data }),
      ...events.map((event) => prisma.cityRequestEvent.create({ data: { requestId: row.id, actorId: actor.id, ...event } })),
    ]);
    await pushRequestUpdate(row, actor.id);
    await recordAudit({ actorId: actor.id, action: auditActions.cityRequestChanged, targetType: "city_request", targetId: row.id, metadata: { op: "update", reference: row.reference, changes: events.map((event) => ({ kind: event.kind, from: event.fromValue, to: event.toValue })) }, ip });
    const statusChange = events.filter((event) => event.kind === "status").at(-1);
    if (statusChange?.toValue) {
      notifyInBackground(
        createNotification({
          userId: row.citizenId,
          type: "CITY_REQUEST",
          title: `Votre demande ${row.reference} est ${STATUS_LABEL[statusChange.toValue] ?? statusChange.toValue}`,
          link: `/space/requests/${row.reference}`,
          email: true,
        }),
        { cityRequestId: row.id },
      );
    }
  }
  return getCityRequest(reference, actor);
}

/**
 * D17 — the agents' backlog at a glance: open requests nobody has taken on
 * yet, and since when the oldest one has been waiting.
 */
export async function awaitingPickup(actor: AuthUser): Promise<{ count: number; oldestAt: string | null }> {
  if (!isStaff(actor)) throw new ForbiddenError("Only city agents can see every request.");
  const where = { assigneeId: null, status: { in: ["NEW", "IN_PROGRESS", "WAITING_CITIZEN"] as ("NEW" | "IN_PROGRESS" | "WAITING_CITIZEN")[] } };
  const [count, oldest] = await Promise.all([
    prisma.cityRequest.count({ where }),
    prisma.cityRequest.findFirst({ where, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
  ]);
  return { count, oldestAt: oldest?.createdAt.toISOString() ?? null };
}

/** Small counters for the citizen space and the agent dashboard. */
export async function cityRequestStats(actor: AuthUser, scope: "mine" | "all"): Promise<Record<string, number>> {
  if (scope === "all" && !isStaff(actor)) throw new ForbiddenError("Only city agents can see every request.");
  const where = scope === "all" ? {} : { citizenId: actor.id };
  const grouped = await prisma.cityRequest.groupBy({ by: ["status"], where, _count: { _all: true } });
  return Object.fromEntries(grouped.map((entry) => [entry.status, entry._count._all]));
}

/** One public figure for the landing page: how many requests the city has handled. Totals only. */
export async function countHandledCityRequests(): Promise<number> {
  return prisma.cityRequest.count({ where: { status: { in: ["RESOLVED", "CLOSED"] } } });
}
