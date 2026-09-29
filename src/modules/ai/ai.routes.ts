import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { RATE_LIMITS } from "@/lib/rate-limit";

import { aiChatSchema, aiPostActionSchema } from "./ai.schema";
import { chat, generateTags, summarizePost } from "./ai.service";

/**
 * All three endpoints declare the same per-user AI budget. The limit is enforced
 * by the durable limiter (not the process-local burst one) because the quota
 * belongs to the API key, which is shared across every worker.
 */
export const aiChatRoute = apiRoute({
  body: aiChatSchema,
  rateLimit: RATE_LIMITS.ai,
  rateLimitScope: "ai:chat",
  handler: async ({ body, auth }) => jsonOk(await chat(body, auth.user)),
});

export const aiSummarizeRoute = apiRoute({
  body: aiPostActionSchema,
  rateLimit: RATE_LIMITS.ai,
  rateLimitScope: "ai:summarize",
  handler: async ({ body, auth }) => jsonOk(await summarizePost(body, auth.user)),
});

export const aiTagsRoute = apiRoute({
  body: aiPostActionSchema,
  rateLimit: RATE_LIMITS.ai,
  rateLimitScope: "ai:tags",
  handler: async ({ body, auth }) => jsonOk(await generateTags(body, auth.user)),
});
