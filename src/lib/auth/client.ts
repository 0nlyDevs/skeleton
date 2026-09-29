"use client";

import { twoFactorClient } from "better-auth/client/plugins";
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
    twoFactorClient({
      onTwoFactorRedirect: () => {
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
} = authClient;

export type AuthClientError = {
  message?: string;
  code?: string;
  status?: number;
};
