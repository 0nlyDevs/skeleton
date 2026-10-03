/**
 * F38 — recording a service interruption. Agents may do it (they are the
 * ones who learn about an incident first), not only administrators; every
 * change is audited, and residents with an open request on the service are
 * told when it stops and when it is back.
 */

import { isStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { changedFields } from "../audit/audit.diff";
import { recordAudit } from "../audit/audit.service";
import { createNotification } from "../notifications/notifications.service";
import type { ServiceAvailabilityInput } from "./city-services.schema";
import { serviceInclude, toDto, type ServiceDto } from "./city-services.service";
import { availabilityOf, isStopped, type ServiceAvailabilityDto } from "./service-availability";

const OPEN_REQUEST_STATUSES = ["NEW", "IN_PROGRESS", "WAITING_CITIZEN"] as const;
const RECIPIENT_LIMIT = 500;

const TIME = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

function untilText(availability: ServiceAvailabilityDto): string {
  return availability.until ? ` Retour prévu le ${TIME.format(new Date(availability.until))} (UTC).` : " Date de retour pas encore connue.";
}

/** One notification per resident who is waiting on this service. */
async function notifyOpenRequests(service: ServiceDto, before: ServiceAvailabilityDto): Promise<void> {
  const after = service.availability;
  const stoppedNow = isStopped(after) && !isStopped(before);
  const announced = after.state === "PLANNED" && before.state !== "PLANNED";
  const backNow = !isStopped(after) && after.state !== "PLANNED" && (isStopped(before) || before.state === "PLANNED");
  if (!stoppedNow && !announced && !backNow) return;

  const requests = await prisma.cityRequest.findMany({
    where: { service: { slug: service.slug }, status: { in: [...OPEN_REQUEST_STATUSES] } },
    select: { citizenId: true, reference: true },
    orderBy: { createdAt: "desc" },
    take: RECIPIENT_LIMIT,
  });
  const byCitizen = new Map<string, string>();
  for (const request of requests) if (!byCitizen.has(request.citizenId)) byCitizen.set(request.citizenId, request.reference);

  const title = backNow
    ? `${service.name} fonctionne de nouveau`
    : announced
      ? `${service.name} sera interrompu pour maintenance`
      : after.kind === "INCIDENT"
        ? `${service.name} est interrompu par un incident`
        : `${service.name} est en maintenance`;
  const alternative = after.alternative ? ` En attendant : ${after.alternative.name}.` : "";
  const body = backNow
    ? "Le service a repris. Votre demande suit son cours normalement."
    : `${after.note ?? ""}${announced && after.from ? ` À partir du ${TIME.format(new Date(after.from))} (UTC).` : ""}${untilText(after)}${alternative} Votre demande reste enregistrée.`;

  const results = await Promise.allSettled(
    [...byCitizen.entries()].map(([userId, reference]) =>
      createNotification({ userId, type: "CITY_REQUEST", title: title.slice(0, 160), body: body.trim(), link: `/services/${encodeURIComponent(service.slug)}`, email: !backNow })
        .then(() => reference),
    ),
  );
  logger.info("service availability notifications", { slug: service.slug, sent: results.filter((result) => result.status === "fulfilled").length });
}

export async function setServiceAvailability(slug: string, input: ServiceAvailabilityInput, actor: AuthUser, ip: string | null): Promise<ServiceDto> {
  if (!isStaff(actor)) throw new ForbiddenError("Only city staff can change a service's availability.");
  const existing = await prisma.municipalService.findUnique({ where: { slug }, include: serviceInclude });
  if (!existing) throw new NotFoundError("This service does not exist.");

  let alternativeServiceId: string | null = null;
  if (input.availability !== "AVAILABLE" && input.alternativeSlug) {
    if (input.alternativeSlug === existing.slug) throw new BadRequestError("A service cannot be its own alternative.");
    const alternative = await prisma.municipalService.findUnique({ where: { slug: input.alternativeSlug }, select: { id: true, active: true } });
    if (!alternative?.active) throw new BadRequestError("Choose an alternative among the open services.");
    alternativeServiceId = alternative.id;
  }

  const available = input.availability === "AVAILABLE";
  const row = await prisma.municipalService.update({
    where: { id: existing.id },
    data: {
      availability: input.availability,
      // Back to normal clears the interruption, so an old message never resurfaces.
      availabilityNote: available ? null : input.note,
      unavailableFrom: available ? null : input.unavailableFrom,
      availableAgainAt: available ? null : input.availableAgainAt,
      alternativeServiceId: available ? null : alternativeServiceId,
    },
    include: serviceInclude,
  });

  const changed = changedFields(existing as Record<string, unknown>, row as Record<string, unknown>, [
    "availability", "availabilityNote", "unavailableFrom", "availableAgainAt", "alternativeServiceId",
  ]);
  await recordAudit({
    actorId: actor.id,
    action: auditActions.serviceChanged,
    targetType: "service",
    targetId: row.id,
    metadata: { op: available ? "availability_restored" : "availability_interrupted", name: row.name, slug: row.slug, availability: row.availability, changed },
    ip,
  });

  const service = toDto(row);
  const before = availabilityOf(existing, null);
  void notifyOpenRequests(service, before).catch((error: unknown) => logger.warn("service availability notification failed", { slug, error }));
  return service;
}
