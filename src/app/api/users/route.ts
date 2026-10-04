import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { adminCreateAccountSchema } from "@/modules/assisted-accounts/assisted-accounts.schema";
import { createAccountAsAdmin } from "@/modules/assisted-accounts/assisted-accounts.service";
import { listUsersRoute } from "@/modules/users/users.routes";

/** Admin-only: the user management table. */
export const GET = listUsersRoute;

/** Admin-only: create an account of any role; the access code is returned once. */
export const POST = apiRoute({
  roles: ["ADMIN"],
  body: adminCreateAccountSchema,
  rateLimit: { limit: 30, windowMs: 60 * 60_000 },
  handler: async ({ body, auth, ip }) => jsonOk({ data: await createAccountAsAdmin(body, auth.user, ip) }, 201),
});
