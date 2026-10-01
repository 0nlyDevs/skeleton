/**
 * Moderation queue.
 *
 * A report is a *claim*, not a verdict. Resolving one is an explicit staff
 * decision that either removes the content or dismisses the claim, and both
 * outcomes are audited — including the dismissal, because "we looked and it was
 * fine" is exactly the kind of decision an audit trail exists to prove.
 */

import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { isStaff } from "@/lib/auth/guards";
import { paginate, toPagination, type Paginated } from "@/lib/pagination";
import type { AuthUser } from "@/types";
import { logger } from "@/lib/logger";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { deletePostForActor, loadReadablePost } from "../posts/posts.service";
import { findPostById } from "../posts/posts.repository";
import { removeCommentAsStaff } from "../comments/comments.service";
import { findCommentById } from "../comments/comments.repository";
import { assertRoomAccess, findMessageForModeration, removeMessageAsStaff } from "../messages/messages.service";
import { findActiveUserById } from "../users/users.repository";
import { removeUserProfileAsStaff } from "../users/users.service";
import { toReportDto, type ReportDto } from "./reports.dto";
import {
  countReports,
  claimReportResolution,
  completeReportResolution,
  createReport,
  findReportById,
  findReportedTargetSummaries,
  findReports,
  releaseReportResolution,
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
 * database unique constraint on `duplicateKey` rather than a read-then-write
 * check, so two simultaneous taps cannot both succeed. The key only exists
 * while the report is OPEN: resolving it frees the reporter to flag the same
 * target again.
 */
export async function createReportForActor(
  input: CreateReportInput,
  actor: ActorContext,
): Promise<ReportDto> {
  if (input.targetType === "post") {
    const post = await findPostById(input.targetId);
    if (!post || post.deletedAt) throw new NotFoundError();
    await loadReadablePost(input.targetId, actor.user);

    // Reporting your own content is nonsense and would only pollute the queue.
    if (post.userId === actor.user.id) {
      throw new ConflictError("You cannot report your own content.");
    }
  } else if (input.targetType === "comment") {
    const comment = await findCommentById(input.targetId);
    if (!comment || comment.deletedAt) throw new NotFoundError();
    await loadReadablePost(comment.postId, actor.user);
    if (comment.userId === actor.user.id) throw new ConflictError("You cannot report your own content.");
  } else if (input.targetType === "message") {
    const message = await findMessageForModeration(input.targetId);
    if (!message || message.deletedAt) throw new NotFoundError();
    await assertRoomAccess(message.roomId, actor.user);
    if (message.senderId === actor.user.id) throw new ConflictError("You cannot report your own content.");
  } else if (input.targetType === "user") {
    if (input.targetId === actor.user.id) throw new ConflictError("You cannot report your own profile.");
    const user = await findActiveUserById(input.targetId);
    if (!user?.username) throw new NotFoundError("That profile does not exist.");
  }

  let row;
  try {
    row = await createReport({
      reporterId: actor.user.id,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      duplicateKey: `${actor.user.id}:${input.targetType}:${input.targetId}`,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new ConflictError("You already have an open report for this content.");
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

async function attachTargetDetails(rows: Awaited<ReturnType<typeof findReports>>): Promise<ReportDto[]> {
  const summaries = await findReportedTargetSummaries(rows);
  return rows.map((row) =>
    toReportDto(row, summaries.get(`${row.targetType}:${row.targetId}`) ?? {
      label: null,
      summary: null,
      href: null,
    }),
  );
}

/** Staff-only view of the queue. */
export async function listReports(query: ListReportsQuery, actor: AuthUser): Promise<Paginated<ReportDto>> {
  if (!isStaff(actor)) throw new ForbiddenError();
  const pagination = toPagination(query);
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.targetType ? { targetType: query.targetType } : {}),
  };

  const [rows, total] = await Promise.all([
    findReports({ where, skip: pagination.skip, take: pagination.take }),
    countReports(where),
  ]);

  return paginate(await attachTargetDetails(rows), {
    page: pagination.page,
    limit: pagination.limit,
    total,
  });
}

/**
 * Close a report.
 *
 * `remove` applies the matching moderation action to the reported target;
 * `dismiss` leaves it alone. A report becomes terminal either way.
 */
export async function resolveReport(
  id: string,
  input: ResolveReportInput,
  actor: ActorContext,
): Promise<ReportDto> {
  if (!isStaff(actor.user)) throw new ForbiddenError();
  const report = await findReportById(id);
  if (!report) throw new NotFoundError();
  if (report.status !== "OPEN") {
    throw new ConflictError("This report has already been handled.");
  }

  if (!(await claimReportResolution(id, actor.user.id))) {
    throw new ConflictError("Another staff member is already handling this report.");
  }

  try {
    if (input.resolution === "remove") {
      const context = { user: actor.user, ip: actor.ip };
      if (report.targetType === "post") await deletePostForActor(report.targetId, context);
      else if (report.targetType === "comment") await removeCommentAsStaff(report.targetId, context, input.note ?? null);
      else if (report.targetType === "message") await removeMessageAsStaff(report.targetId, context, input.note ?? null);
      else if (report.targetType === "user") await removeUserProfileAsStaff(report.targetId, context, input.note ?? null);

      logger.info("moderation removed content", {
        reportId: report.id,
        targetId: report.targetId,
        targetType: report.targetType,
        moderatorId: actor.user.id,
      });
    }

    const updated = await completeReportResolution(id, actor.user.id, {
      status: input.resolution === "remove" ? "RESOLVED" : "DISMISSED",
      resolutionNote: input.note ?? null,
    });
    if (!updated) throw new ConflictError("This report is no longer assigned to you.");

    await recordAudit({
      actorId: actor.user.id,
      action:
        input.resolution === "remove" ? auditActions.reportResolved : auditActions.reportDismissed,
      targetType: report.targetType,
      targetId: report.targetId,
      metadata: { reportId: report.id, resolution: input.resolution },
      ip: actor.ip ?? null,
    });

    const [resolved] = await attachTargetDetails([updated]);
    return resolved ?? toReportDto(updated);
  } catch (error) {
    await releaseReportResolution(id, actor.user.id);
    throw error;
  }
}
