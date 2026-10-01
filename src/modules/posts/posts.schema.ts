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

export const MAX_POST_IMAGES = 6;
export const MAX_POST_BODY = 20_000;

const titleField = shortTextSchema(140, "Title");
const bodyField = longTextSchema(MAX_POST_BODY, "Body");
const tagsField = z.array(shortTextSchema(30, "Tag")).max(10);
/** Uploaded image ids, in display order. Ownership is re-checked server-side. */
const mediaField = z
  .array(idSchema)
  .max(MAX_POST_IMAGES, `Attach at most ${MAX_POST_IMAGES} images.`)
  .refine((ids) => new Set(ids).size === ids.length, "An image is attached twice.");

/**
 * A social post: text and/or images. The title is optional (the feed shows the
 * text); when omitted it is derived from the first line for lists and search.
 */
export const createPostSchema = z
  .object({
    title: titleField.optional(),
    body: bodyField,
    published: z.boolean().default(true),
    tags: tagsField.default([]),
    mediaIds: mediaField.default([]),
    groupId: idSchema.optional(),
  })
  .refine((value) => value.body.length > 0 || value.mediaIds.length > 0, {
    message: "Write something or add an image.",
    path: ["body"],
  });

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = z
  .object({
    title: titleField.optional(),
    body: bodyField.optional(),
    published: z.boolean().optional(),
    tags: tagsField.optional(),
    mediaIds: mediaField.optional(),
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
  /** Restrict to one group's posts (access-checked). */
  groupSlug: z.string().trim().max(60).regex(/^[a-z0-9-]+$/).optional(),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;
