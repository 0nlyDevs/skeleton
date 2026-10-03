/**
 * BetterAuth server configuration.
 *
 * Design notes worth knowing before editing this file:
 *
 * * **One limiter, not two.** Authentication attempts are throttled by this
 *   app's own rate-limit module, enforced inside `hooks.before` so that hitting
 *   `/api/auth/sign-in/email` directly cannot bypass the wrapper. Counters are
 *   cleared the moment a session is actually created (below), which makes the
 *   rule "5 *failed* attempts per 15 minutes" rather than "5 attempts".
 *
 * * **Bans are enforced at session creation.** A banned account cannot obtain a
 *   session at all, rather than being filtered out later in the UI. The refusal
 *   names the moderator's reason: credentials are already verified by the time
 *   a session is requested, so the answer costs nothing in enumeration and
 *   spares a banned resident the useless "invalid email or password".
 *
 * * **No cookie cache.** BetterAuth can serve the session from a signed cookie
 *   to avoid a database read per request, but a cached session keeps the old
 *   `role` and `banned` values until it expires. Role changes must take effect
 *   immediately, so the cache is off.
 */

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { passkey } from "@better-auth/passkey";
import { twoFactor, username } from "better-auth/plugins";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from "@/lib/mail/transactional";
import { localeFromCookieHeader } from "@/lib/i18n/config";
import { clearLimits } from "@/lib/rate-limit";
import { accountCounterKey } from "@/modules/login-protection/login-protection.service";

import { authAfterHook, authBeforeHook } from "./auth-hooks";
import { bannedAccountError, resolveBanState } from "./ban";
import { hashPassword, verifyPassword } from "./password";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password-policy";
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, usernameViolation } from "@/lib/validation/profile";
import { assignMissingProfileFields } from "./oauth-profile";

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_REFRESH_SECONDS = 60 * 60 * 24; // refresh at most once a day
const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour, for reset and verification tokens

const socialProviders: BetterAuthOptions["socialProviders"] = {};
/*
 * Each provider's redirect URI is `${BETTER_AUTH_URL}/api/auth/callback/<id>`
 * and must be registered, character for character, in the provider console —
 * a mismatch is the usual reason OAuth "works locally but not in production".
 */
if (env.googleOAuthEnabled) {
  socialProviders.google = {
    clientId: env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
    // Always show the account chooser, so a shared machine never silently
    // signs into whichever Google account happens to be active.
    prompt: "select_account",
    // Google returns the two name parts separately; keep them.
    mapProfileToUser: (profile) => ({
      firstName: profile.given_name ?? null,
      lastName: profile.family_name ?? null,
    }),
  };
}
if (env.githubOAuthEnabled) {
  socialProviders.github = {
    clientId: env.GITHUB_CLIENT_ID ?? "",
    clientSecret: env.GITHUB_CLIENT_SECRET ?? "",
  };
}

if (!env.emailEnabled && env.isProduction) {
  logger.warn(
    "No mail transport is configured (MAIL_TRANSPORT=resend needs RESEND_API_KEY, smtp needs SMTP_HOST): " +
      "verification emails are logged instead of sent, " +
      "and email verification is not required to sign in",
  );
}

export const auth = betterAuth({
  appName: "Terra Nova",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [...env.corsAllowedOrigins],

  database: prismaAdapter(prisma, { provider: "mysql" }),

  /*
   * The columns this application adds to BetterAuth's `user` table.
   *
   * This is not optional bookkeeping. BetterAuth builds its `SELECT` from these
   * declarations, so a column that is missing here is missing from
   * `session.user` — and a missing `role` reads as "no role", which quietly
   * turns every staff and admin route into a 403. `input: false` keeps all of
   * them out of request bodies: role changes, bans and profile edits go through
   * this app's own audited service layer, never through a sign-up payload.
   */
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "USER", input: false },
      bio: { type: "string", required: false, input: false },
      // Accepted at sign-up only; `authBeforeHook` validates them first.
      firstName: { type: "string", required: false, input: true },
      lastName: { type: "string", required: false, input: true },
      // Set only by `authBeforeHook` from a validated birth date (the hook
      // overwrites anything a client sends), and never echoed back.
      birthDateEncrypted: { type: "string", required: false, input: true, returned: false },
      banned: { type: "boolean", required: false, defaultValue: false, input: false },
      banReason: { type: "string", required: false, input: false },
      banExpires: { type: "date", required: false, input: false },
    },
  },

  emailAndPassword: {
    enabled: true,
    // Do not auto sign-in after registration: the user must confirm the address
    // first, which also keeps the registration response free of session data.
    autoSignIn: false,
    // The full composition policy runs in `authBeforeHook`; these bounds keep
    // BetterAuth's own check consistent with it.
    minPasswordLength: PASSWORD_MIN_LENGTH,
    maxPasswordLength: PASSWORD_MAX_LENGTH,
    // Requiring verification only makes sense when mail actually works.
    requireEmailVerification: env.emailEnabled,
    resetPasswordTokenExpiresIn: TOKEN_TTL_SECONDS,
    password: {
      hash: hashPassword,
      verify: ({ hash, password }) => verifyPassword(hash, password),
    },
    /*
     * The link is rebuilt to point at our own page instead of BetterAuth's
     * `/api/auth/reset-password/:token` redirect endpoint. Two benefits: the user
     * lands on a translated, themed page rather than a bare redirect, and the
     * token never appears in a URL that a browser history or referrer could leak
     * beyond the reset screen.
     */
    sendResetPassword: async ({ user, token }, request) => {
      const resetUrl = `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        url: resetUrl,
        // The request carries the interface cookie, so someone who registered in
        // English gets the reset message in English rather than a French one.
        locale: localeFromCookieHeader(request?.headers.get("cookie")),
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: TOKEN_TTL_SECONDS,
    // Same reasoning as the reset link: our page, our copy, our error handling.
    sendVerificationEmail: async ({ user, token }, request) => {
      const verifyUrl = `${env.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
      await sendVerificationEmail({
        to: user.email,
        name: user.name,
        url: verifyUrl,
        locale: localeFromCookieHeader(request?.headers.get("cookie")),
      });
    },
  },

  session: {
    expiresIn: SESSION_DURATION_SECONDS,
    updateAge: SESSION_REFRESH_SECONDS,
    // Rotate the session token on refresh so a stolen token has a short life.
    cookieCache: { enabled: false },
  },

  account: {
    // Provider access/refresh tokens are encrypted at rest by BetterAuth.
    encryptOAuthTokens: true,
    accountLinking: {
      enabled: true,
      // Google verifies email ownership, so linking on it is safe. GitHub is
      // deliberately not trusted: it links only when GitHub itself reports the
      // address as verified, so an unverified GitHub email cannot claim an
      // existing account.
      trustedProviders: ["google"],
    },
  },

  socialProviders,

  // OAuth failures land on the sign-in page with `?error=<code>`, where the
  // code is translated, instead of BetterAuth's untranslated error page.
  onAPIError: { errorURL: `${env.appUrl}/login` },

  advanced: {
    useSecureCookies: env.isProduction,
    defaultCookieAttributes: {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: "lax",
      path: "/",
    },
    ipAddress: {
      // Behind cPanel/Passenger the real client IP only exists in this header.
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    },
    crossSubDomainCookies: { enabled: false },
  },

  hooks: {
    // Password policy and the one limiter for the whole pipeline — see
    // `auth-hooks.ts` for why these live inside BetterAuth rather than in front.
    before: authBeforeHook,
    // New-device detection ("est-ce bien vous ?").
    after: authAfterHook,
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: String(session.userId) },
            select: { banned: true, banReason: true, banExpires: true },
          });

          if (!user) return false;

          const state = resolveBanState(user);
          if (state.banned) {
            logger.warn("blocked session creation for banned account", {
              userId: session.userId,
              until: state.until,
            });
            // Thrown rather than `return false`: the hook runs after the
            // credentials have been checked, so the resident is told the
            // account is suspended — and why — instead of being sent back to
            // a password field that was never the problem.
            throw bannedAccountError(state);
          }

          return true;
        },
        after: async (session) => {
          // A session exists, so the credentials were correct: release the
          // account's brute-force counters. The per-IP failure budget is
          // deliberately kept, so logging into one's own account between
          // guesses on other people's never resets it.
          const keys: string[] = [];

          const user = await prisma.user.findUnique({
            where: { id: String(session.userId) },
            select: { email: true, username: true },
          });

          if (user) {
            keys.push(accountCounterKey("/sign-in/email", user.email));
            if (user.username) keys.push(accountCounterKey("/sign-in/username", user.username));
          }

          await clearLimits(keys);
        },
      },
    },
    user: {
      create: {
        // OAuth sign-ups arrive without a handle or split name; derive both
        // so every account has a public, unique username from day one.
        before: async (user) => ({ data: await assignMissingProfileFields(user) }),
        after: async (user, ctx) => {
          const email = String(user.email);
          const name = String(user.name);

          // Every account gets notification preferences up front, so the
          // settings page never has to handle a missing row.
          await prisma.notificationPreference.create({
            data: { userId: String(user.id) },
          });

          await prisma.auditLog.create({
            data: {
              userId: String(user.id),
              action: "user.registered",
              targetType: "user",
              targetId: String(user.id),
            },
          });

          await sendWelcomeEmail({
            to: email,
            name,
            locale: localeFromCookieHeader(ctx?.headers?.get("cookie")),
          });
        },
      },
    },
  },

  // Must stay last: it teaches BetterAuth to write cookies through Next's
  // cookie store when auth is called from a Server Action or Route Handler.
  plugins: [
    // The issuer is what an authenticator app shows next to the entry, so it has
    // to match the product rather than the scaffold it was copied from.
    twoFactor({ issuer: "Terra Nova" }),
    // D02 — sign in without a password: the device's face, fingerprint or PIN
    // unlocks a passkey bound to this site. `userVerification: "required"`
    // means the device must check the person (not just presence), and only the
    // public key ever reaches the server.
    passkey({
      rpID: new URL(env.appUrl).hostname,
      rpName: "Terra Nova",
      origin: env.appUrl,
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
    }),
    username({
      minUsernameLength: USERNAME_MIN_LENGTH,
      maxUsernameLength: USERNAME_MAX_LENGTH,
      usernameValidator: (value) => usernameViolation(value) === null,
    }),
    nextCookies(),
  ],
});
