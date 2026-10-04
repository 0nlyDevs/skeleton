import { z } from "zod";

import { publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { requestLocale } from "@/lib/api/response";
import { orient } from "@/modules/orientation/orientation.service";

/** D10/F91/F92 — find the right service from a need written in one's own words. Public, rate limited. */
export const POST = publicRoute({
  body: z.object({ text: z.string().trim().min(2, "Describe what you need in a few words.").max(400) }).strict(),
  rateLimit: { limit: 30, windowMs: 60_000 },
  rateLimitScope: "orient",
  handler: async ({ body, request, auth }) => jsonOk({ data: await orient(body.text, requestLocale(request), auth !== null) }),
});
