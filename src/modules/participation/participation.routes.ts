import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";

import {
  decisionInputSchema,
  ideaAnswerSchema,
  ideaInputSchema,
  ideaRefParamSchema,
  listIdeasQuerySchema,
  opinionInputSchema,
  projectInputSchema,
  slugParamSchema,
  voteInputSchema,
} from "./participation.schema";
import { answerIdea, castVote, createDecision, createIdea, getDecision, getProject, giveOpinion, listDecisions, listIdeas, listProjects, saveProject, setIdeaSupport } from "./participation.service";

// Reading is public; taking part needs an account; publishing needs the right role.
export const listProjectsRoute = publicRoute({ handler: async ({ auth }) => jsonOk({ data: await listProjects(auth?.user ?? null) }) });
export const getProjectRoute = publicRoute({ params: slugParamSchema, handler: async ({ params, auth }) => jsonOk({ data: await getProject(params.slug, auth?.user ?? null) }) });
export const createProjectRoute = apiRoute({ roles: ["ADMIN"], body: projectInputSchema, handler: async ({ body, auth, ip }) => jsonOk({ data: await saveProject(body, auth.user, ip) }, 201) });
export const updateProjectRoute = apiRoute({ roles: ["ADMIN"], params: slugParamSchema, body: projectInputSchema, handler: async ({ params, body, auth, ip }) => jsonOk({ data: await saveProject(body, auth.user, ip, params.slug) }) });
export const opinionRoute = apiRoute({ params: slugParamSchema, body: opinionInputSchema, handler: async ({ params, body, auth, ip }) => jsonOk({ data: await giveOpinion(params.slug, body, auth.user, ip) }) });

export const listDecisionsRoute = publicRoute({ handler: async ({ auth }) => jsonOk({ data: await listDecisions(auth?.user ?? null) }) });
export const getDecisionRoute = publicRoute({ params: slugParamSchema, handler: async ({ params, auth }) => jsonOk({ data: await getDecision(params.slug, auth?.user ?? null) }) });
export const createDecisionRoute = apiRoute({ roles: ["ADMIN"], body: decisionInputSchema, handler: async ({ body, auth, ip }) => jsonOk({ data: await createDecision(body, auth.user, ip) }, 201) });
export const voteRoute = apiRoute({ params: slugParamSchema, body: voteInputSchema, rateLimit: { limit: 30, windowMs: 60 * 60_000 }, handler: async ({ params, body, auth, ip }) => jsonOk({ data: await castVote(params.slug, body.optionId, auth.user, ip) }, 201) });

export const listIdeasRoute = publicRoute({ query: listIdeasQuerySchema, handler: async ({ query, auth }) => jsonOk({ data: await listIdeas(query, auth?.user ?? null) }) });
export const createIdeaRoute = apiRoute({ body: ideaInputSchema, handler: async ({ body, auth, ip }) => jsonOk({ data: await createIdea(body, auth.user, ip) }, 201) });
export const answerIdeaRoute = apiRoute({ roles: ["AGENT", "ADMIN"], params: ideaRefParamSchema, body: ideaAnswerSchema, handler: async ({ params, body, auth, ip }) => jsonOk({ data: await answerIdea(params.reference, body, auth.user, ip) }) });
export const supportIdeaRoute = apiRoute({ params: ideaRefParamSchema, handler: async ({ params, auth }) => jsonOk({ data: await setIdeaSupport(params.reference, true, auth.user) }) });
export const unsupportIdeaRoute = apiRoute({ params: ideaRefParamSchema, handler: async ({ params, auth }) => jsonOk({ data: await setIdeaSupport(params.reference, false, auth.user) }) });
