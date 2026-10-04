import { publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { issueFormToken } from "@/lib/security/form-guard";

/** F81 — a form asks for its token when it opens; the server checks it on sending. */
export const GET = publicRoute({
  handler: () => jsonOk({ data: { token: issueFormToken() } }),
});
