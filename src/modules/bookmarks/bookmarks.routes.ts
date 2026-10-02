import { z } from "zod";

import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";

import { postIdParamSchema } from "../posts/posts.schema";
import { listSavedPosts, savePost, unsavePost } from "./bookmarks.service";

const savedQuerySchema = z.object({
  cursor: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(30).default(10),
});

export const listSavedRoute = apiRoute({
  query: savedQuerySchema,
  handler: async ({ query, auth }) => jsonOk(await listSavedPosts(auth.user, query)),
});

export const savePostRoute = apiRoute({
  params: postIdParamSchema,
  handler: async ({ params, auth }) => jsonOk({ data: await savePost(params.id, auth.user) }),
});

export const unsavePostRoute = apiRoute({
  params: postIdParamSchema,
  handler: async ({ params, auth }) => jsonOk({ data: await unsavePost(params.id, auth.user) }),
});
