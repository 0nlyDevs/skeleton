import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { runIntegrityReport } from "@/modules/integrity/integrity.service";

/** F85 — the data coherence report, for administrators only. */
export const GET = apiRoute({
  roles: ["ADMIN"],
  handler: async ({ auth }) => jsonOk({ data: await runIntegrityReport(auth.user) }),
});
