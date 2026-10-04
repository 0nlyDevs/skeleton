import { z } from "zod";

import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { getActivityReport } from "@/modules/stats/activity-report";

/** F103 — the activity report as data; `download=1` sends it as a file to keep or pass on. */
export const GET = apiRoute({
  roles: STAFF_ROLES,
  query: z.object({ days: z.coerce.number().int().min(7).max(365).default(30), download: z.enum(["1"]).optional() }),
  rateLimit: { limit: 60, windowMs: 60 * 60_000 },
  handler: async ({ query, auth }) => {
    const report = await getActivityReport(auth.user, query.days);
    if (!query.download) return jsonOk({ data: report });
    return new Response(JSON.stringify(report, null, 2), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="bubble-rapport-activite-${report.to.slice(0, 10)}.json"`, "Cache-Control": "no-store" },
    });
  },
});
