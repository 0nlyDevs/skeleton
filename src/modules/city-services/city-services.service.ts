/**
 * Municipal services directory. Everyone may read active services; only
 * administrators create, edit or retire them.
 */

import { randomInt } from "node:crypto";

import { isAdmin, isStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import type { Locale } from "@/lib/i18n/config";
import { matchesSearch } from "@/lib/search";
import { slugify } from "@/lib/utils";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { TRANSLATABLE_SERVICE_FIELDS, type ServiceInput, type ServiceTranslations } from "./city-services.schema";

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
  readonly featured: boolean;
  /** Other-language copies, for the editor. The fields above are already in the reader's language. */
  readonly translations: ServiceTranslations;
  /** The language the text fields are in (French when no copy exists for the reader's). */
  readonly contentLocale: Locale;
}

type ServiceRow = Awaited<ReturnType<typeof prisma.municipalService.findFirstOrThrow>>;

/** Reads the stored JSON defensively: only known locales and string fields survive. */
function parseTranslations(value: unknown): ServiceTranslations {
  if (!value || typeof value !== "object") return {};
  const en = (value as Record<string, unknown>).en;
  if (!en || typeof en !== "object") return {};
  const copy: Record<string, string> = {};
  for (const field of TRANSLATABLE_SERVICE_FIELDS) {
    const text = (en as Record<string, unknown>)[field];
    if (typeof text === "string" && text.trim()) copy[field] = text;
  }
  return Object.keys(copy).length > 0 ? { en: copy } : {};
}

/**
 * F27 — French is the base text; a reader in another language gets that
 * language's copy of each field that has one, and French for the rest.
 */
function toDto(row: ServiceRow, locale: Locale = "fr"): ServiceDto {
  const translations = parseTranslations(row.translations);
  const copy = locale === "fr" ? undefined : translations[locale];
  const pick = (field: (typeof TRANSLATABLE_SERVICE_FIELDS)[number], base: string | null) => copy?.[field] ?? base;
  return {
    id: row.id,
    slug: row.slug,
    name: pick("name", row.name) ?? row.name,
    category: pick("category", row.category) ?? row.category,
    summary: pick("summary", row.summary) ?? row.summary,
    description: pick("description", row.description) ?? row.description,
    howTo: pick("howTo", row.howTo),
    email: row.email,
    phone: row.phone,
    hours: pick("hours", row.hours),
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    icon: row.icon,
    sortOrder: row.sortOrder,
    active: row.active,
    featured: row.featured,
    translations,
    contentLocale: copy ? locale : "fr",
  };
}

export async function listServices(
  query: { q?: string; category?: string; includeInactive?: boolean },
  viewer: AuthUser | null,
  locale: Locale = "fr",
): Promise<ServiceDto[]> {
  const showInactive = query.includeInactive && viewer !== null && isStaff(viewer);
  const rows = await prisma.municipalService.findMany({
    where: {
      ...(showInactive ? {} : { active: true }),
      ...(query.category ? { category: query.category } : {}),
    },
    // F28 — highlighted services first, then the editorial order.
    orderBy: [{ featured: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    take: 200,
  });
  const services = rows.map((row) => toDto(row, locale));
  const term = query.q?.trim();
  if (!term) return services;

  return services.filter((service) =>
    matchesSearch(
      [
        service.name,
        service.category,
        service.summary,
        service.description,
        service.howTo,
        service.hours,
        service.address,
        service.email,
        service.phone,
      ],
      term,
    ),
  );
}

export async function getService(slug: string, viewer: AuthUser | null, locale: Locale = "fr"): Promise<ServiceDto> {
  const row = await prisma.municipalService.findUnique({ where: { slug } });
  if (!row || (!row.active && !(viewer && isStaff(viewer)))) throw new NotFoundError("This service does not exist.");
  return toDto(row, locale);
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

function fieldsOf(input: ServiceInput): Omit<ServiceInput, "translations"> {
  const { translations: _translations, ...fields } = input;
  return fields;
}

function assertAdmin(actor: AuthUser): void {
  if (!isAdmin(actor)) throw new ForbiddenError("Only administrators can manage services.");
}

export async function createService(input: ServiceInput, actor: AuthUser, ip: string | null): Promise<ServiceDto> {
  assertAdmin(actor);
  const row = await prisma.municipalService.create({ data: { ...fieldsOf(input), translations: input.translations ?? {}, slug: await uniqueSlug(input.name) } });
  await recordAudit({ actorId: actor.id, action: auditActions.serviceChanged, targetType: "service", targetId: row.id, metadata: { op: "create" }, ip });
  return toDto(row);
}

export async function updateService(slug: string, input: ServiceInput, actor: AuthUser, ip: string | null): Promise<ServiceDto> {
  assertAdmin(actor);
  const existing = await prisma.municipalService.findUnique({ where: { slug } });
  if (!existing) throw new NotFoundError("This service does not exist.");
  const row = await prisma.municipalService.update({
    where: { id: existing.id },
    data: {
      ...fieldsOf(input),
      ...(input.translations !== undefined ? { translations: input.translations } : {}),
      slug: input.name !== existing.name ? await uniqueSlug(input.name, existing.id) : existing.slug,
    },
  });
  await recordAudit({ actorId: actor.id, action: auditActions.serviceChanged, targetType: "service", targetId: row.id, metadata: { op: "update" }, ip });
  return toDto(row);
}
