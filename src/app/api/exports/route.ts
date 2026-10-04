import { apiRoute } from "@/lib/api/route";
import { exportQuerySchema } from "@/modules/exports/exports.schema";
import { buildExport } from "@/modules/exports/exports.service";

/** F88 — the chosen columns of a follow-up dataset, as a file to download. */
export const GET = apiRoute({
  roles: ["AGENT", "ADMIN"],
  query: exportQuerySchema,
  rateLimit: { limit: 30, windowMs: 60 * 60_000 },
  handler: async ({ query, auth, ip }) => {
    const file = await buildExport(query, auth.user, ip);
    return new Response(file.body, {
      headers: { "Content-Type": file.contentType, "Content-Disposition": `attachment; filename="${file.filename}"`, "Cache-Control": "no-store", "X-Export-Rows": String(file.rows) },
    });
  },
});
