import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { STAFF_ROLES } from "@/lib/auth/roles";

import { createAssistedAccountsSchema } from "./assisted-accounts.schema";
import { createAssistedAccounts } from "./assisted-accounts.service";

/** `POST /api/agent/citizens/assisted` — F71: accounts for residents without email. */
export const createAssistedAccountsRoute = apiRoute({
  roles: STAFF_ROLES,
  body: createAssistedAccountsSchema,
  handler: async ({ body, auth, ip }) => jsonOk({ data: await createAssistedAccounts(body, auth.user, ip) }, 201),
});
