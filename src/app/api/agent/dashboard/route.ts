import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { getAgentDashboard } from "@/modules/stats/agent-dashboard";

/** F50 — the agents' activity dashboard (cached for a minute). */
export const GET = apiRoute({
  roles: ["AGENT", "ADMIN"],
  handler: async ({ auth }) => jsonOk({ data: await getAgentDashboard(auth.user) }),
});
