import { z } from "zod";

export const FEEDBACK_STATUSES = ["RECEIVED", "READ", "ANSWERED"] as const;

export const createServiceFeedbackSchema = z
  .object({
    serviceSlug: z.string().trim().toLowerCase().min(1).max(80),
    /** The resident's own request this comment follows, when there is one. */
    requestReference: z.string().trim().toUpperCase().regex(/^TN-\d{6}$/, "Invalid reference.").nullable().optional(),
    rating: z.number().int().min(1, "Choose how it went.").max(5),
    comment: z.string().trim().min(5, "Write a few words about how it went.").max(1500),
  })
  .strict();
export type CreateServiceFeedbackInput = z.infer<typeof createServiceFeedbackSchema>;

export const feedbackRefParamSchema = z.object({
  reference: z.string().trim().toUpperCase().regex(/^AV-\d{6}$/, "Invalid reference."),
});

export const listServiceFeedbackQuerySchema = z.object({
  scope: z.enum(["mine", "all"]).default("mine"),
  status: z.enum(FEEDBACK_STATUSES).optional(),
  service: z.string().trim().toLowerCase().max(80).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListServiceFeedbackQuery = z.infer<typeof listServiceFeedbackQuerySchema>;

/** Staff either mark a comment as read, or answer it (which also marks it read). */
export const updateServiceFeedbackSchema = z
  .object({
    read: z.literal(true).optional(),
    reply: z.string().trim().min(5, "Write an answer of a few words.").max(1500).optional(),
  })
  .strict()
  .refine((value) => value.read !== undefined || value.reply !== undefined, "Nothing to update.");
export type UpdateServiceFeedbackInput = z.infer<typeof updateServiceFeedbackSchema>;
