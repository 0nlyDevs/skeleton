import { z } from "zod";

/**
 * F88 — what can leave the platform for another service: follow-up data only.
 * No name, no message, no address: each dataset lists its allowed columns.
 */
export const EXPORT_DATASETS = {
  requests: ["reference", "createdAt", "status", "priority", "service", "issueType", "zone", "assigned", "closedAt", "hoursToClose", "supports"],
  appointments: ["reference", "startsAt", "status", "service", "mode"],
  feedback: ["reference", "createdAt", "service", "rating", "status", "answered"],
} as const;
export type ExportDataset = keyof typeof EXPORT_DATASETS;

export const exportQuerySchema = z.object({
  dataset: z.enum(["requests", "appointments", "feedback"]),
  /** Comma-separated column names; unknown ones are refused. */
  fields: z.string().trim().min(1, "Choose at least one column.").max(300),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  format: z.enum(["csv", "json"]).default("csv"),
});
export type ExportQuery = z.infer<typeof exportQuerySchema>;
