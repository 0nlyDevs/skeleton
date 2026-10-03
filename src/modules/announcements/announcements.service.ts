/**
 * City announcements. Published ones are public; agents and administrators
 * write, edit and withdraw them. Publishing notifies every citizen in-app.
 */

import { randomInt } from "node:crypto";

import { isStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { CityAlertScope, CityAlertSeverity, CityAlertStatus } from "@/generated/prisma/client";
import { publishCityAlertUpdated } from "@/lib/socket/emit";
import { slugify } from "@/lib/utils";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { notifyInBackground } from "../notifications/notifications.service";
import { notifyResidentsOfAlert } from "../alerts/alerts.notify";
import { assertOwnPublicImage } from "../uploads/uploads.service";
import { broadcastAnnouncement } from "./announcements.notify";
import type { AnnouncementInput, ListAnnouncementsQuery } from "./announcements.schema";

const include = {
  author: { select: { id: true, name: true } },
  service: { select: { slug: true, name: true } },
} as const;

type Row = Awaited<ReturnType<typeof prisma.announcement.findFirstOrThrow<{ include: typeof include }>>>;

export interface AnnouncementDto {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
  readonly category: string;
  readonly pinned: boolean;
  readonly coverImage: string | null;
  readonly service: { slug: string; name: string } | null;
  readonly author: { id: string; name: string };
  readonly publishedAt: string | null;
  readonly updatedAt: string;
  readonly alert: {
    readonly scope: CityAlertScope;
    readonly severity: CityAlertSeverity;
    readonly status: CityAlertStatus;
    readonly resolvedAt: string | null;
  } | null;
}

function toDto(row: Row): AnnouncementDto {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    category: row.category,
    pinned: row.pinned,
    coverImage: row.coverImage,
    service: row.service,
    author: row.author,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    alert: row.category === "ALERT"
      ? {
          scope: row.alertScope ?? "ALL",
          severity: row.alertSeverity ?? "WARNING",
          status: row.alertStatus ?? "ACTIVE",
          resolvedAt: row.alertResolvedAt?.toISOString() ?? null,
        }
      : null,
  };
}

export interface AnnouncementPage {
  readonly data: AnnouncementDto[];
  readonly total: number;
  readonly page: number;
  readonly pageCount: number;
}

export async function listAnnouncements(query: ListAnnouncementsQuery, viewer: AuthUser | null): Promise<AnnouncementPage> {
  const drafts = query.drafts === "1" && viewer !== null && isStaff(viewer);
  const where = {
    deletedAt: null,
    ...(drafts ? {} : { publishedAt: { not: null, lte: new Date() } }),
    ...(query.category ? { category: query.category } : {}),
    ...(query.service ? { service: { slug: query.service } } : {}),
    ...(query.q ? { OR: [{ title: { contains: query.q } }, { summary: { contains: query.q } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      include,
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.announcement.count({ where }),
  ]);
  return { data: rows.map(toDto), total, page: query.page, pageCount: Math.ceil(total / query.limit) };
}

export async function getAnnouncement(slug: string, viewer: AuthUser | null): Promise<AnnouncementDto> {
  const row = await prisma.announcement.findUnique({ where: { slug }, include });
  const visible = row && !row.deletedAt && ((row.publishedAt && row.publishedAt <= new Date()) || (viewer && isStaff(viewer)));
  if (!row || !visible) throw new NotFoundError("This announcement does not exist.");
  return toDto(row);
}

function assertWriter(actor: AuthUser): void {
  if (!isStaff(actor)) throw new ForbiddenError("Only city agents can publish announcements.");
}

async function uniqueSlug(title: string, ignoreId?: string): Promise<string> {
  const base = slugify(title).slice(0, 80) || "annonce";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${randomInt(100, 9999)}`;
    const taken = await prisma.announcement.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken || taken.id === ignoreId) return candidate;
  }
  return `annonce-${randomInt(10 ** 6, 10 ** 7)}`;
}

async function validServiceId(serviceId: string | null | undefined): Promise<string | null> {
  if (!serviceId) return null;
  const service = await prisma.municipalService.findUnique({ where: { id: serviceId }, select: { id: true } });
  if (!service) throw new NotFoundError("This service does not exist.");
  return service.id;
}

export async function createAnnouncement(input: AnnouncementInput, actor: AuthUser, ip: string | null): Promise<AnnouncementDto> {
  assertWriter(actor);
  await assertOwnPublicImage(input.coverImage, actor.id);
  const row = await prisma.announcement.create({
    data: {
      slug: await uniqueSlug(input.title),
      title: input.title,
      summary: input.summary,
      body: input.body,
      category: input.category,
      alertScope: input.category === "ALERT" ? input.alertScope ?? "ALL" : null,
      alertSeverity: input.category === "ALERT" ? input.alertSeverity ?? "WARNING" : null,
      alertStatus: input.category === "ALERT" ? "ACTIVE" : null,
      pinned: input.pinned,
      coverImage: input.coverImage ?? null,
      serviceId: await validServiceId(input.serviceId),
      authorId: actor.id,
      publishedAt: input.published ? new Date() : null,
    },
    include,
  });
  await recordAudit({ actorId: actor.id, action: auditActions.announcementChanged, targetType: "announcement", targetId: row.id, metadata: { op: "create", published: input.published }, ip });
  if (row.publishedAt && row.category === "ALERT") {
    notifyInBackground(
      notifyResidentsOfAlert({
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        scope: row.alertScope ?? "ALL",
      }),
      { announcementId: row.id, scope: row.alertScope ?? "ALL" },
    );
    publishCityAlertUpdated({ slug: row.slug, action: "published" });
  } else if (row.publishedAt) {
    notifyInBackground(broadcastAnnouncement(row.slug, row.title, false), { announcementId: row.id });
  }
  return toDto(row);
}

export async function updateAnnouncement(slug: string, input: AnnouncementInput, actor: AuthUser, ip: string | null): Promise<AnnouncementDto> {
  assertWriter(actor);
  const existing = await prisma.announcement.findUnique({ where: { slug } });
  if (!existing || existing.deletedAt) throw new NotFoundError("This announcement does not exist.");
  if (input.coverImage && input.coverImage !== existing.coverImage) await assertOwnPublicImage(input.coverImage, actor.id);
  const publishNow = input.published && !existing.publishedAt;
  const row = await prisma.announcement.update({
    where: { id: existing.id },
    data: {
      slug: input.title !== existing.title ? await uniqueSlug(input.title, existing.id) : existing.slug,
      title: input.title,
      summary: input.summary,
      body: input.body,
      category: input.category,
      alertScope: input.category === "ALERT" ? input.alertScope ?? existing.alertScope ?? "ALL" : null,
      alertSeverity: input.category === "ALERT" ? input.alertSeverity ?? existing.alertSeverity ?? "WARNING" : null,
      alertStatus: input.category === "ALERT" ? existing.alertStatus ?? "ACTIVE" : null,
      alertResolvedAt: input.category === "ALERT" ? existing.alertResolvedAt : null,
      pinned: input.pinned,
      coverImage: input.coverImage ?? null,
      serviceId: await validServiceId(input.serviceId),
      publishedAt: input.published ? (existing.publishedAt ?? new Date()) : null,
    },
    include,
  });
  await recordAudit({ actorId: actor.id, action: auditActions.announcementChanged, targetType: "announcement", targetId: row.id, metadata: { op: "update" }, ip });
  if (publishNow && row.category === "ALERT") {
    notifyInBackground(
      notifyResidentsOfAlert({
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        scope: row.alertScope ?? "ALL",
      }),
      { announcementId: row.id, scope: row.alertScope ?? "ALL" },
    );
  } else if (publishNow) {
    notifyInBackground(broadcastAnnouncement(row.slug, row.title, false), { announcementId: row.id });
  }
  if (row.category === "ALERT" && row.publishedAt) {
    publishCityAlertUpdated({ slug: row.slug, action: row.alertStatus === "RESOLVED" ? "resolved" : publishNow ? "published" : "changed" });
  } else if (existing.category === "ALERT") {
    publishCityAlertUpdated({ slug: existing.slug, action: "removed" });
  }
  return toDto(row);
}

export async function deleteAnnouncement(slug: string, actor: AuthUser, ip: string | null): Promise<void> {
  assertWriter(actor);
  const existing = await prisma.announcement.findUnique({ where: { slug } });
  if (!existing || existing.deletedAt) throw new NotFoundError("This announcement does not exist.");
  await prisma.announcement.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
  if (existing.category === "ALERT") publishCityAlertUpdated({ slug: existing.slug, action: "removed" });
  await recordAudit({ actorId: actor.id, action: auditActions.announcementChanged, targetType: "announcement", targetId: existing.id, metadata: { op: "delete" }, ip });
}

/** Resolve a published safety alert while keeping its history visible in the city feed. */
export async function resolveAnnouncementAlert(slug: string, actor: AuthUser, ip: string | null): Promise<AnnouncementDto> {
  assertWriter(actor);
  const existing = await prisma.announcement.findUnique({ where: { slug }, include });
  if (!existing || existing.deletedAt || existing.category !== "ALERT" || !existing.publishedAt) {
    throw new NotFoundError("This city alert does not exist.");
  }
  if (existing.alertStatus === "RESOLVED") return toDto(existing);

  const row = await prisma.announcement.update({
    where: { id: existing.id },
    data: { alertStatus: "RESOLVED", alertResolvedAt: new Date() },
    include,
  });
  await recordAudit({
    actorId: actor.id,
    action: auditActions.announcementChanged,
    targetType: "announcement",
    targetId: row.id,
    metadata: { op: "resolve_alert", scope: row.alertScope ?? "ALL" },
    ip,
  });
  publishCityAlertUpdated({ slug: row.slug, action: "resolved" });
  return toDto(row);
}
