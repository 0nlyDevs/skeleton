import { z } from "zod";

import type { NextResponse } from "next/server";

import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/auth";

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

/**
 * Expires the auth cookies in the browser once the account is gone. The names
 * and attributes come from BetterAuth itself: in production they carry the
 * `__Secure-` prefix and the `Secure` flag, and a cookie is only replaced by
 * one with the same name, path and flags. A stale cookie would otherwise make
 * the proxy believe a session exists and bounce /login back to /space.
 */
async function clearAuthCookies(response: NextResponse): Promise<NextResponse> {
  const { authCookies } = await auth.$context;
  for (const cookie of [authCookies.sessionToken, authCookies.sessionData, authCookies.accountData, authCookies.dontRememberToken]) {
    const { path, domain, secure, httpOnly, sameSite } = cookie.attributes;
    response.cookies.set(cookie.name, "", {
      path: path ?? "/",
      ...(domain ? { domain } : {}),
      secure: Boolean(secure),
      httpOnly: httpOnly ?? true,
      sameSite: typeof sameSite === "string" ? (sameSite.toLowerCase() as "lax" | "strict" | "none") : "lax",
      maxAge: 0,
    });
  }
  return response;
}

/** `POST /api/users/me/delete` — permanent, re-authenticated. */
export const deleteMyAccountRoute = apiRoute({
  body: z.object({ password: z.string().max(200).optional(), confirmUsername: z.string().max(60).optional() }).strict(),
  handler: async ({ body, auth, ip }) => {
    await deleteMyAccount(body, auth.user, ip);
    return clearAuthCookies(jsonOk({ deleted: true }));
  },
});
