"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { twoFactorClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Browser-side auth client.
 *
 * `baseURL` is intentionally omitted: the client then talks to the origin it was
 * served from. That keeps the whole app same-origin, which means no CORS
 * preflight, no cross-origin credential mode, and no origin allowlist to get
 * wrong on the hosting panel.
 *
 * The two-factor plugin redirects to the challenge page as soon as the password
 * step succeeds with 2FA enabled, instead of leaving the form in a loading
 * state.
 */
export const authClient = createAuthClient({
  plugins: [
    usernameClient(),
    passkeyClient(),
    twoFactorClient({
      onTwoFactorRedirect: () => {
        // A hard navigation, not `router.push`: the session was just replaced
        // server-side, and only a full document load guarantees the /2fa page
        // is rendered from that new session rather than from cached RSC data.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/2fa";
      },
    }),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  requestPasswordReset,
  resetPassword,
  sendVerificationEmail,
  changePassword,
  updateUser,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  twoFactor,
  passkey,
} = authClient;

export type AuthClientError = {
  message?: string;
  code?: string;
  status?: number;
};
