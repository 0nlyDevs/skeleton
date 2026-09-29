/**
 * Moderation queue.
 *
 * A report is a *claim*, not a verdict. Resolving one is an explicit staff
 * decision that either removes the content or dismisses the claim, and both
 * outcomes are audited — including the dismissal, because "we looked and it was
 * fine" is exactly the kind of decision an audit trail exists to prove.
 */

import { ConflictError, NotFoundError } from "@/lib/errors";
import { paginate, toPagination, type Paginated } from "@/lib/pagination";
import type { AuthUser } from "@/types";
import { logger } from "@/lib/logger";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { findPostById, softDeletePost } from "../posts/posts.repository";
import { toReportDto, type ReportDto } from "./reports.dto";
import {
  countReports,
  createReport,
  findReportById,
  findReportedPostTitles,
  findReports,
  updateReport,
} from "./reports.repository";
import type {
  CreateReportInput,
  ListReportsQuery,
  ResolveReportInput,
} from "./reports.schema";

export interface ActorContext {
  readonly user: AuthUser;
  readonly ip?: string;
}

/**
 * File a report.
 *
 * Duplicate reports of the same target by the same user are rejected by a
 * database unique constraint rather than a read-then-write check, so two
 * simultaneous taps cannot both succeed.
 */
export async function createReportForActor(
  input: CreateReportInput,
  actor: ActorContext,
): Promise<ReportDto> {
  if (input.targetType === "post") {
    const post = await findPostById(input.targetId);
    if (!post || post.deletedAt) throw new NotFoundError();

    // Reporting your own content is nonsense and would only pollute the queue.
    if (post.userId === actor.user.id) {
      throw new ConflictError("You cannot report your own content.");
    }
  }

  let row;
  try {
    row = await createReport({
      reporterId: actor.user.id,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new ConflictError("You have already reported this content.");
    }
    throw error;
  }

  await recordAudit({
    actorId: actor.user.id,
    action: auditActions.reportCreated,
    targetType: input.targetType,
    targetId: input.targetId,
    ip: actor.ip ?? null,
  });

  return toReportDto(row);
}

async function attachLabels(rows: Awaited<ReturnType<typeof findReports>>): Promise<ReportDto[]> {
  const postIds = rows
    .filter((row) => row.targetType === "post")
    .map((row) => row.targetId);

  const titles = await findReportedPostTitles(postIds);

  return rows.map((row) => toReportDto(row, titles.get(row.targetId) ?? null));
}

/** Staff-only view of the queue. */
export async function listReports(query: ListReportsQuery): Promise<Paginated<ReportDto>> {
  const pagination = toPagination(query);
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
  };

  const [rows, total] = await Promise.all([
    findReports({ where, skip: pagination.skip, take: pagination.take }),
    countReports(where),
  ]);

  return paginate(await attachLabels(rows), {
    page: pagination.page,
    limit: pagination.limit,
    total,
  });
}

/**
 * Close a report.
 *
 * `remove` applies a soft delete to the reported post; `dismiss` leaves the
 * content alone. Either way the report becomes terminal, and a second attempt to
 * resolve it is a conflict rather than a silent no-op.
 */
export async function resolveReport(
  id: string,
  input: ResolveReportInput,
  actor: ActorContext,
): Promise<ReportDto> {
  const report = await findReportById(id);
  if (!report) throw new NotFoundError();
  if (report.status !== "OPEN") {
    throw new ConflictError("This report has already been handled.");
  }

  if (input.resolution === "remove" && report.targetType === "post") {
    const post = await findPostById(report.targetId);

    if (post && !post.deletedAt) {
      await softDeletePost(post.id, new Date());
      logger.info("moderation removed content", {
        reportId: report.id,
        targetId: post.id,
        moderatorId: actor.user.id,
      });
    }
  }

  const updated = await updateReport(id, {
    status: input.resolution === "remove" ? "RESOLVED" : "DISMISSED",
    resolvedById: actor.user.id,
    resolutionNote: input.note ?? null,
  });

  await recordAudit({
    actorId: actor.user.id,
    action:
      input.resolution === "remove" ? auditActions.reportResolved : auditActions.reportDismissed,
    targetType: report.targetType,
    targetId: report.targetId,
    metadata: { reportId: report.id, resolution: input.resolution },
    ip: actor.ip ?? null,
  });

  return toReportDto(updated);
}
