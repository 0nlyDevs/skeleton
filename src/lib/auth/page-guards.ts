/**
 * Page-level guards for server components. They only decide *where the human
 * goes*; every API call behind the page re-checks authorisation itself.
 */

import { redirect } from "next/navigation";

import type { AuthContext, Role } from "@/types";

import { roleIn } from "./roles";

import { getAuthContext } from "./session";

/** The signed-in context, or a redirect to sign-in that returns here after. */
export async function requirePageAuth(returnTo: string): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return context;
}

/**
 * The signed-in context plus whether its role is allowed here. Pages render
 * an "access denied" panel when it is not (a visible 403, not a silent
 * redirect), and every API call behind them re-checks the role anyway.
 */
export async function requirePageRole(
  returnTo: string,
  roles: readonly Role[],
): Promise<{ context: AuthContext; allowed: boolean }> {
  const context = await requirePageAuth(returnTo);
  return { context, allowed: roleIn(context.user.role, roles) };
}
