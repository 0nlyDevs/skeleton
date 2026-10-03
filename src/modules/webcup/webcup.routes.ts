import { z } from "zod";

import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";

import { getWebcupFeed, syncWebcupFeed, triageWebcupRequest } from "./webcup.service";

export const webcupFeedQuerySchema = z.object({
  status: z.enum(["ALL", "all", "TODO", "IN_PROGRESS", "DONE", "SKIPPED", "todo", "pending"]).optional(),
});

export const getWebcupFeedRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  query: webcupFeedQuerySchema,
  handler: async ({ auth, query }) => jsonOk({ data: await getWebcupFeed(auth.user, query.status) }),
});

/** Manual refresh, on top of the server's own polling. */
export const refreshWebcupFeedRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  rateLimit: { limit: 6, windowMs: 60_000 },
  rateLimitScope: "webcup:refresh",
  handler: async ({ auth }) => {
    const result = await syncWebcupFeed();
    return jsonOk({ data: { ...result, feed: await getWebcupFeed(auth.user) } });
  },
});

export const triageWebcupRoute = apiRoute({
  roles: ["AGENT", "ADMIN"],
  params: z.object({ code: z.string().trim().min(1).max(40) }),
  body: z
    .object({
      triage: z.enum(["TODO", "IN_PROGRESS", "DONE", "SKIPPED"]).optional(),
      note: z.string().trim().max(2000).nullable().optional(),
    })
    .strict(),
  handler: async ({ params, body, auth, ip }) => {
    await triageWebcupRequest(params.code, body, auth.user, ip);
    return jsonOk({ data: { ok: true } });
  },
});
