import { z } from "zod";

import { publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { requestLocale } from "@/lib/api/response";
import { simplify } from "@/modules/plain/plain.service";

/** F89/F90 — a plain-language version of a text, only when asked. Public, rate limited. */
export const POST = publicRoute({
  body: z.object({ text: z.string().trim().min(10, "There is nothing to explain.").max(4000) }).strict(),
  rateLimit: { limit: 20, windowMs: 60_000 },
  rateLimitScope: "plain",
  // The model only reads text for signed-in residents; visitors get the local rewrite.
  handler: async ({ body, request, auth }) => jsonOk({ data: await simplify(body.text, requestLocale(request), auth !== null) }),
});
