import { apiRoute, publicRoute } from "@/lib/api/route";
import { jsonCreated, jsonOk, noContent } from "@/lib/api/response";

import {
  addGroupMemberSchema,
  createGroupSchema,
  groupMemberParamsSchema,
  groupSlugParamsSchema,
  listGroupsQuerySchema,
  listMembersQuerySchema,
  memberActionSchema,
  updateGroupSchema,
} from "./groups.schema";
import {
  actOnMember,
  addMember,
  createGroup,
  deleteGroup,
  getGroup,
  joinGroup,
  leaveGroup,
  listGroups,
  listMembers,
  updateGroupSettings,
} from "./groups.service";

export const listGroupsRoute = publicRoute({
  query: listGroupsQuerySchema,
  handler: async ({ query, auth }) => jsonOk({ data: await listGroups(query, auth?.user ?? null) }),
});

export const createGroupRoute = apiRoute({
  body: createGroupSchema,
  handler: async ({ body, auth, ip }) => jsonCreated({ data: await createGroup(body, { user: auth.user, ip }) }),
});

export const getGroupRoute = publicRoute({
  params: groupSlugParamsSchema,
  handler: async ({ params, auth }) => jsonOk({ data: await getGroup(params.slug, auth?.user ?? null) }),
});

export const updateGroupRoute = apiRoute({
  params: groupSlugParamsSchema,
  body: updateGroupSchema,
  handler: async ({ params, body, auth, ip }) =>
    jsonOk({ data: await updateGroupSettings(params.slug, body, { user: auth.user, ip }) }),
});

export const deleteGroupRoute = apiRoute({
  params: groupSlugParamsSchema,
  handler: async ({ params, auth, ip }) => {
    await deleteGroup(params.slug, { user: auth.user, ip });
    return noContent();
  },
});

export const joinGroupRoute = apiRoute({
  params: groupSlugParamsSchema,
  handler: async ({ params, auth, ip }) => jsonOk({ data: await joinGroup(params.slug, { user: auth.user, ip }) }),
});

export const leaveGroupRoute = apiRoute({
  params: groupSlugParamsSchema,
  handler: async ({ params, auth, ip }) => {
    await leaveGroup(params.slug, { user: auth.user, ip });
    return noContent();
  },
});

export const listMembersRoute = publicRoute({
  params: groupSlugParamsSchema,
  query: listMembersQuerySchema,
  handler: async ({ params, query, auth }) =>
    jsonOk({ data: await listMembers(params.slug, query, auth?.user ?? null) }),
});

export const addMemberRoute = apiRoute({
  params: groupSlugParamsSchema,
  body: addGroupMemberSchema,
  handler: async ({ params, body, auth, ip }) => {
    await addMember(params.slug, body.userId, { user: auth.user, ip });
    return noContent();
  },
});

export const memberActionRoute = apiRoute({
  params: groupMemberParamsSchema,
  body: memberActionSchema,
  handler: async ({ params, body, auth, ip }) => {
    await actOnMember(params.slug, params.userId, body, { user: auth.user, ip });
    return noContent();
  },
});
