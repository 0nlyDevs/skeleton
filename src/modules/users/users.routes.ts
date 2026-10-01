import { headers as nextHeaders } from "next/headers";

import { apiRoute, publicRoute } from "@/lib/api/route";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";
import { jsonOk, noContent } from "@/lib/api/response";
import { ADMIN_ROLES } from "@/lib/auth/roles";

import {
  adminListUsersQuerySchema,
  changePasswordSchema,
  setInitialPasswordSchema,
  sessionIdParamSchema,
  updateProfileSchema,
  updateUserBanSchema,
  updateUserRoleSchema,
  userIdParamSchema,
} from "./users.schema";
import {
  checkUsernameAvailability,
  changeOwnPassword,
  setInitialPassword,
  changeUserRole,
  getOwnProfile,
  getUserForAdmin,
  listUsersForAdmin,
  revokeOtherOwnSessions,
  revokeOwnSession,
  setUserBan,
  updateOwnProfile,
} from "./users.service";

// --- Self -------------------------------------------------------------------

export const getMeRoute = apiRoute({
  handler: async ({ auth }) => jsonOk(await getOwnProfile({ user: auth.user })),
});

export const updateMeRoute = apiRoute({
  body: updateProfileSchema,
  handler: async ({ body, auth }) =>
    jsonOk(await updateOwnProfile(body, { user: auth.user })),
});

export const changePasswordRoute = apiRoute({
  body: changePasswordSchema,
  handler: async ({ body, auth, ip }) => {
    await changeOwnPassword(body, {
      userId: auth.user.id,
      headers: await nextHeaders(),
      ip,
    });
    return jsonOk({ changed: true });
  },
});

export const revokeSessionRoute = apiRoute({
  params: sessionIdParamSchema,
  handler: async ({ params, auth, ip }) => {
    await revokeOwnSession(params.id, {
      userId: auth.user.id,
      currentSessionId: auth.session.id,
      ip,
    });
    return noContent();
  },
});

export const revokeOtherSessionsRoute = apiRoute({
  handler: async ({ auth, ip }) =>
    jsonOk({
      revoked: await revokeOtherOwnSessions({
        userId: auth.user.id,
        currentSessionId: auth.session.id,
        ip,
      }),
    }),
});

// --- Admin ------------------------------------------------------------------

export const listUsersRoute = apiRoute({
  roles: ADMIN_ROLES,
  query: adminListUsersQuerySchema,
  handler: async ({ query }) => jsonOk(await listUsersForAdmin(query)),
});

export const getUserRoute = apiRoute({
  roles: ADMIN_ROLES,
  params: userIdParamSchema,
  handler: async ({ params }) => jsonOk(await getUserForAdmin(params.id)),
});

export const updateUserRoleRoute = apiRoute({
  roles: ADMIN_ROLES,
  params: userIdParamSchema,
  body: updateUserRoleSchema,
  handler: async ({ params, body, auth, ip }) =>
    jsonOk(await changeUserRole(params.id, body, { user: auth.user, ip })),
});

export const updateUserBanRoute = apiRoute({
  roles: ADMIN_ROLES,
  params: userIdParamSchema,
  body: updateUserBanSchema,
  handler: async ({ params, body, auth, ip }) =>
    jsonOk(await setUserBan(params.id, body, { user: auth.user, ip })),
});

const usernameQuerySchema = z.object({ username: z.string().max(60) });

/** Public (sign-up needs it); limited per IP via the burst limiter scope. */
export const usernameAvailabilityRoute = publicRoute({
  query: usernameQuerySchema,
  rateLimit: RATE_LIMITS.usernameCheck,
  rateLimitScope: "username-check",
  handler: async ({ query, auth }) =>
    jsonOk({ data: await checkUsernameAvailability(query.username, auth?.user ?? null) }),
});

export const setInitialPasswordRoute = apiRoute({
  body: setInitialPasswordSchema,
  rateLimit: RATE_LIMITS.passwordChange,
  rateLimitScope: "password-initial",
  handler: async ({ body, auth, ip }) => {
    await setInitialPassword(body, { userId: auth.user.id, headers: await nextHeaders(), ip });
    return jsonOk({ created: true });
  },
});
