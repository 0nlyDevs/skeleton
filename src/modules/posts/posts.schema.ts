/**
 * Post input schemas — the template for every future entity.
 *
 * Note what is **absent**: there is no `userId`, no `role`, no `deletedAt` and no
 * `createdAt`. Zod strips unknown keys by default, so even if a client sends
 * `{ "userId": "someone-else", "role": "ADMIN" }` the values are discarded before
 * a service ever sees them. Ownership is always taken from the session, never
 * from the payload.
 */

import { z } from "zod";

import { paginationQuerySchema, sortOrderSchema } from "@/lib/pagination";
import {
  booleanQuerySchema,
  hasAtLeastOneDefined,
  idSchema,
  longTextSchema,
  shortTextSchema,
} from "@/lib/validate";

const titleField = shortTextSchema(140, "Title");
const bodyField = longTextSchema(20_000, "Body");
const tagsField = z.array(shortTextSchema(30, "Tag")).max(10);

export const createPostSchema = z.object({
  title: titleField,
  body: bodyField,
  published: z.boolean().default(false),
  tags: tagsField.default([]),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = z
  .object({
    title: titleField.optional(),
    body: bodyField.optional(),
    published: z.boolean().optional(),
    tags: tagsField.optional(),
  })
  .refine(hasAtLeastOneDefined, {
    message: "Provide at least one field to update.",
  });

export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const postIdParamSchema = z.object({ id: idSchema });

export type PostIdParams = z.infer<typeof postIdParamSchema>;

export const listPostsQuerySchema = paginationQuerySchema.extend({
  /** Case-insensitive match on title or body. */
  q: z.string().trim().max(120).optional(),
  published: booleanQuerySchema.optional(),
  authorId: z.string().trim().max(64).optional(),
  /** Restrict to the caller's own posts when true. */
  mine: booleanQuerySchema.optional(),
  /** Staff only; ignored for everyone else. */
  includeDeleted: booleanQuerySchema.optional(),
  sort: z.enum(["createdAt", "updatedAt", "title"]).default("createdAt"),
  order: sortOrderSchema.default("desc"),
});

export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;

export const feedQuerySchema = z.object({
  cursor: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  authorId: z.string().trim().max(64).optional(),
  q: z.string().trim().max(120).optional(),
  scope: z.enum(["all", "following"]).default("all"),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;
