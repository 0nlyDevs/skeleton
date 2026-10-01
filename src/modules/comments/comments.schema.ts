import { z } from "zod";

import { idSchema } from "@/lib/validate";

export const MAX_COMMENT_LENGTH = 2_000;

const bodyField = z
  .string()
  .max(MAX_COMMENT_LENGTH * 2)
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, "Write something first.")
  .refine((value) => value.length <= MAX_COMMENT_LENGTH, `Keep comments under ${MAX_COMMENT_LENGTH} characters.`);

export const postCommentsParamsSchema = z.object({ id: idSchema });
export const commentParamsSchema = z.object({ id: idSchema });

export const listCommentsQuerySchema = z.object({
  cursor: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;

export const createCommentSchema = z.object({
  body: bodyField,
  /** Reply target; a reply to a reply attaches to the same top-level thread. */
  parentId: idSchema.optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({ body: bodyField });

export type UpdateCommentInput = z.infer<typeof updateCommentSchema>;
