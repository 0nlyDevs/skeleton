import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { STAFF_ROLES } from "@/lib/auth/roles";

import { partnerProposalDecisionSchema, partnerProposalIdSchema, partnerProposalInputSchema } from "./partner-proposals.schema";
import { decidePartnerProposal, listPartnerProposals, submitPartnerProposal } from "./partner-proposals.service";

/** Public on purpose: a partner has no account. Robot guard + a small hourly quota. */
export const submitPartnerProposalRoute = publicRoute({
  body: partnerProposalInputSchema,
  rateLimit: { limit: 5, windowMs: 60 * 60_000 },
  handler: async ({ body }) => jsonOk({ data: await submitPartnerProposal(body) }, 201),
});

export const listPartnerProposalsRoute = apiRoute({ roles: STAFF_ROLES, handler: async ({ auth }) => jsonOk({ data: await listPartnerProposals(auth.user) }) });

export const decidePartnerProposalRoute = apiRoute({
  roles: STAFF_ROLES,
  params: partnerProposalIdSchema,
  body: partnerProposalDecisionSchema,
  handler: async ({ params, body, auth, ip }) => jsonOk({ data: await decidePartnerProposal(params.id, body, auth.user, ip) }),
});
