/**
 * Environment access.
 *
 * Validation is **lazy** on purpose: `next build` imports modules to collect
 * route metadata, and a build machine legitimately has no runtime secrets.
 * Parsing on first property access keeps the build green while still failing
 * fast, with a readable report, the moment the app actually needs a value.
 *
 * Import this module from server code only. `NEXT_PUBLIC_*` values that the
 * browser needs are read in `lib/env.public.ts`.
 */

import { z } from "zod";

/** Accepts `""` from a shell/`.env` and treats it as "not configured". */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" || value === undefined ? undefined : value));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),

  // --- Database -------------------------------------------------------------
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_LOG: z.enum(["0", "1"]).default("0"),

  // --- Application ----------------------------------------------------------
  NEXT_PUBLIC_APP_URL: z.string().min(1).default("http://localhost:3000"),

  // --- BetterAuth -----------------------------------------------------------
  BETTER_AUTH_SECRET: z
    .string()
    .min(16, "BETTER_AUTH_SECRET must be at least 16 characters"),
  BETTER_AUTH_URL: z.string().min(1).optional(),
  /**
   * Key material for encryption at rest (private messages, notification
   * bodies, birth dates). Generate with `openssl rand -base64 32`. Changing
   * it makes existing encrypted values unreadable — rotate, never replace.
   */
  DATA_ENCRYPTION_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(32, "DATA_ENCRYPTION_KEY must be at least 32 characters").optional(),
  ),
  CORS_ALLOWED_ORIGINS: z.string().default(""),

  // --- OAuth ----------------------------------------------------------------
  GOOGLE_CLIENT_ID: optionalText,
  GOOGLE_CLIENT_SECRET: optionalText,
  GITHUB_CLIENT_ID: optionalText,
  GITHUB_CLIENT_SECRET: optionalText,

  // --- Email ----------------------------------------------------------------
  RESEND_API_KEY: optionalText,
  MAIL_FROM: z.string().min(1).default("noreply@localhost"),
  /**
   * `resend` needs a verified sending domain to reach anyone but the account
   * owner; `smtp` works with any relay and no domain setup; `log` only writes
   * the outbox.
   */
  MAIL_TRANSPORT: z.enum(["resend", "smtp", "log"]).default("resend"),
  SMTP_HOST: optionalText,
  SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
  SMTP_USER: optionalText,
  SMTP_PASS: optionalText,
  /** Refuse to send credentials without STARTTLS. Only a local relay may disable it. */
  SMTP_REQUIRE_TLS: z.enum(["0", "1"]).default("1"),
  /**
   * Where undelivered messages are written. Every auth link lands here, which
   * is what keeps verification and reset usable without a mailbox.
   */
  MAIL_OUTBOX_DIR: z.string().min(1).default("./.mail-outbox"),

  // --- Networking -----------------------------------------------------------
  /**
   * Node resolves hostnames in "verbatim" order, which breaks every outbound
   * request on a host with no working IPv6 route. See `lib/net/dns.ts`.
   */
  DNS_RESULT_ORDER: z.enum(["ipv4first", "verbatim"]).default("ipv4first"),

  // --- AI -------------------------------------------------------------------
  // Generic: works with OpenRouter, xAI, Gemini, or any OpenAI-compatible API.
  // Backward-compatible: OPENROUTER_API_KEY is still accepted as a fallback.
  AI_API_KEY: optionalText,
  AI_BASE_URL: z.string().min(1).default("https://openrouter.ai/api/v1"),
  AI_MODEL: z.string().min(1).default("google/gemini-2.0-flash-exp:free"),
  AI_FALLBACK_MODEL: optionalText,
  /** Provider embedding model (e.g. `text-embedding-3-small`); unset = local embedding. */
  AI_EMBEDDING_MODEL: optionalText,

  // --- Calls (WebRTC) -------------------------------------------------------
  /** Comma-separated STUN URLs. */
  WEBRTC_STUN_URLS: z.string().default("stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302"),
  /** Optional TURN relay (coturn `use-auth-secret`), e.g. `turn:turn.example.com:3478`. */
  TURN_URL: optionalText,
  TURN_SECRET: optionalText,

  // --- Terra Nova official API (24H by Webcup) -----------------------------
  /** Server-only key; sent as `X-Webcup-Api-Key`, never exposed to browsers. */
  WEBCUP_API_KEY: optionalText,
  WEBCUP_API_URL: z.string().url().default("https://24h.webcup.fr/wp-json/webcup/v1/requests"),
  /** Seconds between polls of the feed (the organisers suggest 15 to 30). */
  WEBCUP_POLL_SECONDS: z.coerce.number().int().min(10).max(600).default(30),

  // --- Uploads --------------------------------------------------------------
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .max(50 * 1024 * 1024)
    .default(5 * 1024 * 1024),

  // --- Real-time ------------------------------------------------------------
  NEXT_PUBLIC_REALTIME_MODE: z.enum(["auto", "socket", "polling"]).default("auto"),

  // --- Operations -----------------------------------------------------------
  CRON_SECRET: optionalText,
  TRUST_PROXY: z.enum(["0", "1"]).default("0"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  /** Reject passwords found in known breaches (HIBP k-anonymity range API). */
  PASSWORD_BREACH_CHECK: z.enum(["0", "1"]).default("1"),
  RATE_LIMIT_STORE: z.enum(["memory", "database"]).default("memory"),
});

export type RawEnv = z.infer<typeof envSchema>;

export interface Env extends RawEnv {
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
  /** Canonical origin without a trailing slash. */
  readonly appUrl: string;
  /** Explicit browser-origin allowlist; never `*`. */
  readonly corsAllowedOrigins: readonly string[];
  readonly trustProxy: boolean;
  readonly databaseLogging: boolean;
  readonly googleOAuthEnabled: boolean;
  readonly githubOAuthEnabled: boolean;
  readonly emailEnabled: boolean;
  readonly aiEnabled: boolean;
}

let cached: Env | undefined;

function parseEnv(): Env {
  if (cached) return cached;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const report = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration:\n${report}\n\n` +
        "Copy .env.example to .env and fill in the missing values.",
    );
  }

  const raw = result.data;
  const appUrl = raw.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const authUrl = (raw.BETTER_AUTH_URL ?? appUrl).replace(/\/+$/, "");

  const corsAllowedOrigins = raw.CORS_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin) => origin.length > 0);

  // The app's own origin is always allowed, but nothing else is implicit.
  if (!corsAllowedOrigins.includes(appUrl)) {
    corsAllowedOrigins.push(appUrl);
  }

  cached = Object.freeze({
    ...raw,
    BETTER_AUTH_URL: authUrl,
    NEXT_PUBLIC_APP_URL: appUrl,
    isProduction: raw.NODE_ENV === "production",
    isDevelopment: raw.NODE_ENV === "development",
    isTest: raw.NODE_ENV === "test",
    appUrl,
    corsAllowedOrigins,
    trustProxy: raw.TRUST_PROXY === "1",
    databaseLogging: raw.DATABASE_LOG === "1",
    googleOAuthEnabled: Boolean(raw.GOOGLE_CLIENT_ID && raw.GOOGLE_CLIENT_SECRET),
    githubOAuthEnabled: Boolean(raw.GITHUB_CLIENT_ID && raw.GITHUB_CLIENT_SECRET),
    emailEnabled:
      (raw.MAIL_TRANSPORT === "resend" && Boolean(raw.RESEND_API_KEY)) ||
      (raw.MAIL_TRANSPORT === "smtp" && Boolean(raw.SMTP_HOST)),
    aiEnabled: Boolean(raw.AI_API_KEY ?? process.env.OPENROUTER_API_KEY),
  });

  return cached;
}

/**
 * Lazily-validated environment. Accessing any property parses and validates the
 * whole schema once, then serves the frozen result.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, property: string | symbol) {
    if (typeof property === "symbol") return undefined;
    return parseEnv()[property as keyof Env];
  },
  has(_target, property: string | symbol) {
    return typeof property === "string" && property in parseEnv();
  },
});

/** Exposed for tests and for the `/api/health` endpoint. */
export function validateEnvironment(): { ok: true } | { ok: false; report: string } {
  try {
    parseEnv();
    return { ok: true };
  } catch (error) {
    return { ok: false, report: error instanceof Error ? error.message : "unknown error" };
  }
}
