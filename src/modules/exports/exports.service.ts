/**
 * F88 — staff pick a dataset, the columns they need and a period, and get a
 * CSV (opens in any spreadsheet) or JSON file. Only follow-up columns exist
 * here: nothing that names a resident or quotes what they wrote.
 */

import { isStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { BadRequestError, ForbiddenError } from "@/lib/errors";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { EXPORT_DATASETS, type ExportDataset, type ExportQuery } from "./exports.schema";

type Row = Record<string, string | number | boolean | null>;
const MAX_ROWS = 5_000;

function period(query: ExportQuery): { gte?: Date; lt?: Date } | undefined {
  const range: { gte?: Date; lt?: Date } = {};
  if (query.from) range.gte = new Date(`${query.from}T00:00:00Z`);
  if (query.to) range.lt = new Date(new Date(`${query.to}T00:00:00Z`).getTime() + 24 * 60 * 60_000);
  return range.gte || range.lt ? range : undefined;
}

async function load(dataset: ExportDataset, query: ExportQuery): Promise<Row[]> {
  const range = period(query);
  if (dataset === "requests") {
    const rows = await prisma.cityRequest.findMany({
      where: range ? { createdAt: range } : {},
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      select: { reference: true, createdAt: true, status: true, priority: true, issueType: true, zone: true, assigneeId: true, closedAt: true, service: { select: { name: true } }, _count: { select: { supports: true } } },
    });
    return rows.map((row) => ({
      reference: row.reference,
      createdAt: row.createdAt.toISOString(),
      status: row.status,
      priority: row.priority,
      service: row.service?.name ?? null,
      issueType: row.issueType,
      zone: row.zone,
      assigned: row.assigneeId !== null,
      closedAt: row.closedAt?.toISOString() ?? null,
      hoursToClose: row.closedAt ? Math.round(((row.closedAt.getTime() - row.createdAt.getTime()) / 3_600_000) * 10) / 10 : null,
      supports: row._count.supports,
    }));
  }
  if (dataset === "appointments") {
    const rows = await prisma.appointment.findMany({
      where: range ? { startsAt: range } : {},
      orderBy: { startsAt: "desc" },
      take: MAX_ROWS,
      select: { reference: true, status: true, mode: true, startsAt: true, service: { select: { name: true } } },
    });
    return rows.map((row) => ({ reference: row.reference, startsAt: row.startsAt.toISOString(), status: row.status, service: row.service?.name ?? null, mode: row.mode }));
  }
  const rows = await prisma.serviceFeedback.findMany({
    where: range ? { createdAt: range } : {},
    orderBy: { createdAt: "desc" },
    take: MAX_ROWS,
    select: { reference: true, createdAt: true, rating: true, status: true, repliedAt: true, service: { select: { name: true } } },
  });
  return rows.map((row) => ({ reference: row.reference, createdAt: row.createdAt.toISOString(), service: row.service.name, rating: row.rating, status: row.status, answered: row.repliedAt !== null }));
}

function csvCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = String(value);
  // A leading =, +, - or @ would run as a formula in a spreadsheet.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export interface ExportFile {
  readonly filename: string;
  readonly contentType: string;
  readonly body: string;
  readonly rows: number;
}

export async function buildExport(query: ExportQuery, actor: AuthUser, ip: string | null): Promise<ExportFile> {
  if (!isStaff(actor)) throw new ForbiddenError("Only city staff can export follow-up data.");
  const allowed: readonly string[] = EXPORT_DATASETS[query.dataset];
  const fields = [...new Set(query.fields.split(",").map((field) => field.trim()).filter(Boolean))];
  if (fields.length === 0 || fields.some((field) => !allowed.includes(field))) throw new BadRequestError("Choose columns from the list.");

  const rows = (await load(query.dataset, query)).map((row) => Object.fromEntries(fields.map((field) => [field, row[field] ?? null])));
  const day = new Date().toISOString().slice(0, 10);
  await recordAudit({
    actorId: actor.id,
    action: auditActions.trackingExported,
    targetType: "export",
    targetId: query.dataset,
    metadata: { op: "create", name: query.dataset, fields, rows: rows.length, format: query.format, from: query.from ?? null, to: query.to ?? null },
    ip,
  });

  if (query.format === "json") {
    return {
      filename: `bubble-${query.dataset}-${day}.json`,
      contentType: "application/json; charset=utf-8",
      body: JSON.stringify({ dataset: query.dataset, exportedAt: new Date().toISOString(), fields, rows }, null, 2),
      rows: rows.length,
    };
  }
  const lines = [fields.join(";"), ...rows.map((row) => fields.map((field) => csvCell(row[field] ?? null)).join(";"))];
  // BOM so spreadsheets read accents correctly.
  return { filename: `bubble-${query.dataset}-${day}.csv`, contentType: "text/csv; charset=utf-8", body: `﻿${lines.join("\r\n")}\r\n`, rows: rows.length };
}
