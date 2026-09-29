import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth/auth";

/**
 * BetterAuth's catch-all endpoint (`/api/auth/*`).
 *
 * BetterAuth owns this surface: sign-in, sign-up, OAuth callbacks, session
 * refresh, two-factor, password reset. The application's own rules still apply
 * inside it — authentication attempts are throttled by the pipeline hook in
 * `lib/auth/auth-hooks.ts`, which runs for every request that reaches this
 * handler, so calling these endpoints directly cannot bypass a limit.
 */
export const { GET, POST } = toNextJsHandler(auth);
