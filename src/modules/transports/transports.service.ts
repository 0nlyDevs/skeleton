import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";
import type { AuthUser } from "@/types";

import { changedFields } from "../audit/audit.diff";
import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import type { TransportLineInput } from "./transports.schema";

export type TransportLineDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  stops: string[];
  firstDeparture: string;
  lastDeparture: string;
  headwayMinutes: number;
  serviceDays: string;
  alert: string | null;
  published: boolean;
  updatedAt: string;
};

function toDto(row: Awaited<ReturnType<typeof prisma.transportLine.findMany>>[number]): TransportLineDto {
  return { ...row, stops: row.stops.split("\n").map((stop) => stop.trim()).filter(Boolean), updatedAt: row.updatedAt.toISOString() };
}

export async function listPublishedTransportLines(): Promise<TransportLineDto[]> {
  return (await prisma.transportLine.findMany({ where: { published: true }, orderBy: { code: "asc" } })).map(toDto);
}

export async function listTransportLines(): Promise<TransportLineDto[]> {
  return (await prisma.transportLine.findMany({ orderBy: { code: "asc" } })).map(toDto);
}

function toData(input: TransportLineInput) {
  return { ...input, stops: input.stops.join("\n"), description: input.description || null, alert: input.alert || null };
}

const LINE_FIELDS = ["code", "name", "description", "stops", "firstDeparture", "lastDeparture", "headwayMinutes", "serviceDays", "alert", "published"] as const;

export async function createTransportLine(input: TransportLineInput, actor: AuthUser, ip: string | null): Promise<TransportLineDto> {
  const row = await prisma.transportLine.create({ data: toData(input) });
  await recordAudit({ actorId: actor.id, action: auditActions.transportChanged, targetType: "transport_line", targetId: row.id, metadata: { op: "create", code: row.code, name: row.name, published: row.published }, ip });
  return toDto(row);
}

export async function updateTransportLine(id: string, input: TransportLineInput, actor: AuthUser, ip: string | null): Promise<TransportLineDto> {
  const existing = await prisma.transportLine.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("That transport line does not exist.");
  const row = await prisma.transportLine.update({ where: { id }, data: toData(input) });
  const changed = changedFields(existing as Record<string, unknown>, row as Record<string, unknown>, LINE_FIELDS);
  // A new or lifted traffic alert is what residents notice: say so explicitly.
  const op = changed.includes("alert") ? (row.alert ? "alert_set" : "alert_cleared") : "update";
  await recordAudit({ actorId: actor.id, action: auditActions.transportChanged, targetType: "transport_line", targetId: row.id, metadata: { op, code: row.code, name: row.name, changed }, ip });
  return toDto(row);
}

export async function deleteTransportLine(id: string, actor: AuthUser, ip: string | null): Promise<void> {
  const existing = await prisma.transportLine.findUnique({ where: { id }, select: { code: true, name: true } });
  const result = await prisma.transportLine.deleteMany({ where: { id } });
  if (!result.count || !existing) throw new NotFoundError("That transport line does not exist.");
  await recordAudit({ actorId: actor.id, action: auditActions.transportChanged, targetType: "transport_line", targetId: id, metadata: { op: "delete", code: existing.code, name: existing.name }, ip });
}
