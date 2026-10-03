/**
 * Municipal services directory. Everyone may read active services; only
 * administrators create, edit or retire them.
 */

import { randomInt } from "node:crypto";

import { isAdmin, isStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { slugify } from "@/lib/utils";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import type { ServiceInput } from "./city-services.schema";

export interface ServiceDto {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly category: string;
  readonly summary: string;
  readonly description: string;
  readonly howTo: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly hours: string | null;
  readonly address: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly icon: string;
  readonly sortOrder: number;
  readonly active: boolean;
}

type ServiceRow = Awaited<ReturnType<typeof prisma.municipalService.findFirstOrThrow>>;

function toDto(row: ServiceRow): ServiceDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    summary: row.summary,
    description: row.description,
    howTo: row.howTo,
    email: row.email,
    phone: row.phone,
    hours: row.hours,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    icon: row.icon,
    sortOrder: row.sortOrder,
    active: row.active,
  };
}

export async function listServices(query: { q?: string; category?: string; includeInactive?: boolean }, viewer: AuthUser | null): Promise<ServiceDto[]> {
  const showInactive = query.includeInactive && viewer !== null && isStaff(viewer);
  const rows = await prisma.municipalService.findMany({
    where: {
      ...(showInactive ? {} : { active: true }),
      ...(query.category ? { category: query.category } : {}),
      ...(query.q ? { OR: [{ name: { contains: query.q } }, { summary: { contains: query.q } }, { category: { contains: query.q } }] } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 200,
  });
  return rows.map(toDto);
}

export async function getService(slug: string, viewer: AuthUser | null): Promise<ServiceDto> {
  const row = await prisma.municipalService.findUnique({ where: { slug } });
  if (!row || (!row.active && !(viewer && isStaff(viewer)))) throw new NotFoundError("This service does not exist.");
  return toDto(row);
}

async function uniqueSlug(name: string, ignoreId?: string): Promise<string> {
  const base = slugify(name).slice(0, 60) || "service";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${randomInt(100, 9999)}`;
    const taken = await prisma.municipalService.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!taken || taken.id === ignoreId) return candidate;
  }
  return `service-${randomInt(10 ** 6, 10 ** 7)}`;
}

function assertAdmin(actor: AuthUser): void {
  if (!isAdmin(actor)) throw new ForbiddenError("Only administrators can manage services.");
}

export async function createService(input: ServiceInput, actor: AuthUser, ip: string | null): Promise<ServiceDto> {
  assertAdmin(actor);
  const row = await prisma.municipalService.create({ data: { ...input, slug: await uniqueSlug(input.name) } });
  await recordAudit({ actorId: actor.id, action: auditActions.serviceChanged, targetType: "service", targetId: row.id, metadata: { op: "create" }, ip });
  return toDto(row);
}

export async function updateService(slug: string, input: ServiceInput, actor: AuthUser, ip: string | null): Promise<ServiceDto> {
  assertAdmin(actor);
  const existing = await prisma.municipalService.findUnique({ where: { slug } });
  if (!existing) throw new NotFoundError("This service does not exist.");
  const row = await prisma.municipalService.update({
    where: { id: existing.id },
    data: { ...input, slug: input.name !== existing.name ? await uniqueSlug(input.name, existing.id) : existing.slug },
  });
  await recordAudit({ actorId: actor.id, action: auditActions.serviceChanged, targetType: "service", targetId: row.id, metadata: { op: "update" }, ip });
  return toDto(row);
}
