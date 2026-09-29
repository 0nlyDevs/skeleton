/**
 * Moderation queue response shape.
 *
 * The reporter's identity is shown to staff (it is needed to spot a serial
 * reporter) but their email address is not: name only.
 */

import type { ReportStatus } from "@prisma/client";

import type { ReportWithActors } from "./reports.repository";

export interface ReportActorDto {
  readonly id: string;
  readonly name: string;
}

export interface ReportDto {
  readonly id: string;
  readonly targetType: string;
  readonly targetId: string;
  /** Best-effort label of the reported content, resolved by the service. */
  readonly targetLabel: string | null;
  readonly reason: string;
  readonly status: ReportStatus;
  readonly reporter: ReportActorDto | null;
  readonly resolvedBy: ReportActorDto | null;
  readonly resolutionNote: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toReportDto(
  row: ReportWithActors,
  targetLabel: string | null = null,
): ReportDto {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    targetLabel,
    reason: row.reason,
    status: row.status,
    reporter: row.reporter ? { id: row.reporter.id, name: row.reporter.name } : null,
    resolvedBy: row.resolvedBy
      ? { id: row.resolvedBy.id, name: row.resolvedBy.name }
      : null,
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
