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
 *   session at all, rather than being filtered out later in the UI.
 *
 * * **No cookie cache.** BetterAuth can serve the session from a signed cookie
 *   to avoid a database read per request, but a cached session keeps the old
 *   `role` and `banned` values until it expires. Role changes must take effect
 *   immediately, so the cache is off.
 */

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
} from "@/lib/mail/transactional";
import { clearLimits, rateLimitKey } from "@/lib/rate-limit";

import { authRateLimitHook } from "./auth-hooks";
import { resolveBanState } from "./ban";
import { hashPassword, verifyPassword } from "./password";

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_REFRESH_SECONDS = 60 * 60 * 24; // refresh at most once a day
const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour, for reset and verification tokens

const socialProviders: BetterAuthOptions["socialProviders"] = {};
if (env.googleOAuthEnabled) {
  socialProviders.google = {
    clientId: env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
  };
}

if (!env.emailEnabled && env.isProduction) {
  logger.warn(
    "RESEND_API_KEY is not configured: verification emails are logged instead of sent, " +
      "and email verification is not required to sign in",
  );
}

export const auth = betterAuth({
  appName: "Webcup Base",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [...env.corsAllowedOrigins],

  database: prismaAdapter(prisma, { provider: "mysql" }),

  emailAndPassword: {
    enabled: true,
    // Do not auto sign-in after registration: the user must confirm the address
    // first, which also keeps the registration response free of session data.
    autoSignIn: false,
    minPasswordLength: 8,
    maxPasswordLength: 128,
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
    sendResetPassword: async ({ user, token }) => {
      const resetUrl = `${env.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
      await sendPasswordResetEmail({ to: user.email, name: user.name, url: resetUrl });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: TOKEN_TTL_SECONDS,
    // Same reasoning as the reset link: our page, our copy, our error handling.
    sendVerificationEmail: async ({ user, token }) => {
      const verifyUrl = `${env.appUrl}/verify-email?token=${encodeURIComponent(token)}`;
      await sendVerificationEmail({ to: user.email, name: user.name, url: verifyUrl });
    },
  },

  session: {
    expiresIn: SESSION_DURATION_SECONDS,
    updateAge: SESSION_REFRESH_SECONDS,
    // Rotate the session token on refresh so a stolen token has a short life.
    cookieCache: { enabled: false },
  },

  account: {
    accountLinking: {
      enabled: true,
      // Google verifies email ownership, so linking on it is safe. Any other
      // provider would let an attacker claim an existing account.
      trustedProviders: ["google"],
    },
  },

  socialProviders,

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
    // One limiter for the whole pipeline — see `auth-hooks.ts` for why this
    // lives inside BetterAuth rather than in front of it.
    before: authRateLimitHook,
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
            return false;
          }

          return true;
        },
        after: async (session) => {
          // A session exists, so the credentials were correct: release the
          // brute-force counters for both the account and the source IP.
          const keys = [rateLimitKey("auth:/sign-in/email:ip", session.ipAddress ?? "unknown")];

          const user = await prisma.user.findUnique({
            where: { id: String(session.userId) },
            select: { email: true },
          });

          if (user) {
            keys.push(rateLimitKey("auth:/sign-in/email:account", user.email.toLowerCase()));
          }

          await clearLimits(keys);
        },
      },
    },
    user: {
      create: {
        after: async (user) => {
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

          await sendWelcomeEmail({ to: email, name });
        },
      },
    },
  },

  // Must stay last: it teaches BetterAuth to write cookies through Next's
  // cookie store when auth is called from a Server Action or Route Handler.
  plugins: [twoFactor({ issuer: "Webcup Base" }), nextCookies()],
});
