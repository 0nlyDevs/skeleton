import { z } from "zod";

import { paginationQuerySchema } from "@/lib/pagination";
import { idSchema } from "@/lib/validate";

/**
 * Target types the moderation queue understands.
 *
 * Kept as a closed enum rather than a free string: a report is resolved by
 * looking the target up again, and an unknown type would silently produce a row
 * nobody can act on.
 */
export const REPORT_TARGET_TYPES = ["post", "comment", "message", "user"] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const reportStatusSchema = z.enum(["OPEN", "RESOLVED", "DISMISSED"]);

export const createReportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: idSchema,
  reason: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length >= 5, "Please describe the problem in a few words.")
    .refine((value) => value.length <= 1000, "Please keep the report under 1000 characters."),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;

export const listReportsQuerySchema = paginationQuerySchema.extend({
  status: reportStatusSchema.optional(),
  targetType: z.enum(REPORT_TARGET_TYPES).optional(),
});

export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;

export const reportIdParamSchema = z.object({ id: idSchema });

export const resolveReportSchema = z.object({
  /** `remove` soft-deletes the reported content; `dismiss` closes the report. */
  resolution: z.enum(["remove", "dismiss"]),
  note: z
    .string()
    .transform((value) => value.trim())
    .refine((value) => value.length <= 500, "Keep the note under 500 characters.")
    .optional(),
});

export type ResolveReportInput = z.infer<typeof resolveReportSchema>;
