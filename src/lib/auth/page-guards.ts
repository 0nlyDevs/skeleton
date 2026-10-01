/**
 * Page-level guards for server components. They only decide *where the human
 * goes*; every API call behind the page re-checks authorisation itself.
 */

import { redirect } from "next/navigation";

import type { AuthContext } from "@/types";

import { getAuthContext } from "./session";

/** The signed-in context, or a redirect to sign-in that returns here after. */
export async function requirePageAuth(returnTo: string): Promise<AuthContext> {
  const context = await getAuthContext();
  if (!context) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return context;
}
