import { z } from "zod";

import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";

import { deleteMyAccount, exportMyData } from "./account.service";

/** `GET /api/users/me/export` — a JSON file with everything about the caller. */
export const exportMyDataRoute = apiRoute({
  handler: async ({ auth }) => {
    const data = await exportMyData(auth.user);
    const name = `skeleton-${auth.user.username ?? "compte"}-${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${name}"`,
        "cache-control": "no-store",
      },
    });
  },
});

/** `POST /api/users/me/delete` — permanent, re-authenticated. */
export const deleteMyAccountRoute = apiRoute({
  body: z.object({ password: z.string().max(200).optional(), confirmUsername: z.string().max(60).optional() }).strict(),
  handler: async ({ body, auth, ip }) => {
    await deleteMyAccount(body, auth.user, ip);
    const response = jsonOk({ deleted: true });
    response.headers.append("Set-Cookie", "better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax");
    response.headers.append("Set-Cookie", "better-auth.session_data=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax");
    return response;
  },
});
