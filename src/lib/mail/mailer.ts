/**
 * Transactional email delivery, over Resend or SMTP (`MAIL_TRANSPORT`).
 *
 * Three properties matter more than throughput here:
 *
 *   1. **Sending never throws.** A provider outage must not fail a registration
 *      or a password reset — the account is already created, and the user can
 *      ask for another link. Failures are logged and reported back as
 *      `delivered: false`.
 *   2. **The action URL is never lost.** Both the log-only transport and a
 *      rejected send write the message to the outbox directory, so the
 *      verification and reset flows stay completable with no mailbox at all.
 *      That is what makes the contest demo work without a verified domain.
 *   3. **A network failure never masquerades as a bad key.** The Resend SDK
 *      collapses connectivity errors into `application_error`; the hints below
 *      say which one actually happened.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { render, toPlainText } from "@react-email/render";
import { Resend } from "resend";
import type { ReactElement } from "react";

import { env } from "@/lib/env";
import { isPlaceholderEmail } from "@/lib/accounts/no-email";
import { logger } from "@/lib/logger";
// Importing the module applies the DNS order; the call documents that this file
// is the one that depends on it.
import { preferIpv4 } from "@/lib/net/dns";

import { sendViaSmtp } from "./smtp";

preferIpv4();

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly react: ReactElement;
  readonly replyTo?: string;
  /**
   * The link inside the email. Written to the outbox whenever the message is
   * not accepted by a provider, so a developer can complete the flow.
   */
  readonly previewUrl?: string;
}

export interface MailResult {
  readonly delivered: boolean;
  readonly id?: string;
}

/**
 * Attempts per message. Three covers the transient failures seen in practice
 * without letting a genuinely unreachable provider hold a request open for long.
 */
const MAX_ATTEMPTS = 3;

let cachedClient: Resend | null | undefined;

function getClient(): Resend | null {
  if (cachedClient === undefined) {
    cachedClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
  }
  return cachedClient;
}

/**
 * Maps a provider rejection onto something actionable.
 *
 * Resend's test-mode refusal is by far the most common one during a hackathon:
 * an account without a verified domain may only send to the address that owns
 * the account, and the error reads like a delivery problem rather than a policy
 * one.
 */
/**
 * Whether a failed attempt is worth repeating.
 *
 * Outbound connections fail transiently for reasons that have nothing to do
 * with the request: a blackholed IPv6 route (the symptom is a bare `ETIMEDOUT`
 * or "could not be resolved"), a reset connection, or a provider blip. A
 * validation error, on the other hand, will fail identically every time and
 * retrying it only delays the response.
 */
function isTransientFailure(message: string, statusCode?: number | null): boolean {
  if (typeof statusCode === "number" && (statusCode === 429 || statusCode >= 500)) return true;

  const normalised = message.toLowerCase();

  return [
    "could not be resolved",
    "fetch failed",
    "etimedout",
    "econnreset",
    "econnrefused",
    "eai_again",
    "enotfound",
    "socket hang up",
    "network",
    "timeout",
  ].some((needle) => normalised.includes(needle));
}

/** Small jitter so simultaneous retries do not line up. */
function backoffDelayMs(attempt: number): number {
  const base = 200 * 3 ** (attempt - 1);
  return Math.round(base * (0.75 + Math.random() * 0.5));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function explainProviderError(message: string): string | undefined {
  const normalised = message.toLowerCase();

  if (
    normalised.includes("testing email") ||
    normalised.includes("verify a domain") ||
    normalised.includes("test mode")
  ) {
    return (
      "Resend is in test mode: an account without a verified domain only delivers to the " +
      "account owner's own address. Verify a domain at https://resend.com/domains, switch to " +
      "MAIL_TRANSPORT=smtp, or read the action link from the outbox."
    );
  }

  if (normalised.includes("could not be resolved") || normalised.includes("fetch failed")) {
    return (
      "The provider was unreachable. Check outbound network access; if this host has no working " +
      "IPv6 route, DNS_RESULT_ORDER=ipv4first (the default) is required."
    );
  }

  if (normalised.includes("api key") || normalised.includes("unauthorized")) {
    return "Resend rejected the credentials. Check RESEND_API_KEY.";
  }

  return undefined;
}

/** A filename-safe version of an email address, for the outbox. */
function slugifyEmail(email: string): string {
  return email.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

/**
 * Writes the message to the outbox directory and returns the file path.
 *
 * Deliberately best-effort: it is a development aid, and a failure to write it
 * must not become a failure to register.
 */
async function writeToOutbox(message: MailMessage): Promise<string | null> {
  try {
    const directory = path.resolve(process.cwd(), env.MAIL_OUTBOX_DIR);
    await mkdir(directory, { recursive: true });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(directory, `${stamp}-${slugifyEmail(message.to)}.txt`);

    const body = [
      `To: ${message.to}`,
      `From: ${env.MAIL_FROM}`,
      `Subject: ${message.subject}`,
      message.replyTo ? `Reply-To: ${message.replyTo}` : null,
      "",
      message.previewUrl ? `Action URL: ${message.previewUrl}` : "(no action URL)",
      "",
    ]
      .filter((line) => line !== null)
      .join("\n");

    await writeFile(file, body, "utf8");
    return file;
  } catch (error) {
    logger.debug("could not write to the mail outbox", { error });
    return null;
  }
}

/**
 * The reason a message could not be delivered, in one line, for the log.
 *
 * Kept separate from `sendMail` so registration and password reset always emit
 * the same shape and the same actionable URL.
 */
async function recordUndelivered(
  message: MailMessage,
  reason: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const outboxFile = await writeToOutbox(message);

  logger.warn("email not delivered, the action link is below", {
    to: message.to,
    subject: message.subject,
    reason,
    // The single most useful line in the log for anyone testing auth. In
    // production it is a live credential (reset/verify token), so it stays in
    // the server-side outbox file and out of log aggregation.
    ...(env.isProduction ? {} : { actionUrl: message.previewUrl }),
    outboxFile,
    ...extra,
  });
}

/** One delivery attempt; both transports report failure the same way. */
type Attempt = () => Promise<
  { ok: true; id?: string } | { ok: false; message: string; statusCode: number | null }
>;

async function smtpAttempt(message: MailMessage): Promise<Attempt> {
  // Rendered once, outside the retry loop.
  const html = await render(message.react);
  const text = toPlainText(html);

  return async () => {
    try {
      const id = await sendViaSmtp({
        from: env.MAIL_FROM,
        to: message.to,
        subject: message.subject,
        html,
        text,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
      });
      return { ok: true, ...(id ? { id } : {}) };
    } catch (error) {
      const responseCode = (error as { responseCode?: unknown }).responseCode;
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
        // 4xx SMTP replies are temporary by definition; map them onto the
        // HTTP-style "retry me" range the retry rule understands.
        statusCode: typeof responseCode === "number" && responseCode >= 400 && responseCode < 500 ? 503 : null,
      };
    }
  };
}

async function resendAttempt(message: MailMessage, client: Resend): Promise<Attempt> {
  // The SMTP path sends a plain-text alternative; this one did not, so Resend
  // delivered single-part HTML. Text-only clients saw nothing useful, and
  // Gmail scores single-part HTML down as spam.
  const html = await render(message.react);

  const payload = {
    from: env.MAIL_FROM,
    to: message.to,
    subject: message.subject,
    html,
    text: toPlainText(html),
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
  };

  return async () => {
    try {
      const { data, error } = await client.emails.send(payload);
      if (!error) return { ok: true, ...(data?.id ? { id: data.id } : {}) };
      return { ok: false, message: error.message, statusCode: error.statusCode ?? null };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error), statusCode: null };
    }
  };
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  // F71 — an account without email has a placeholder address: never send to it.
  if (isPlaceholderEmail(message.to)) return { delivered: false };
  if (!env.emailEnabled) {
    await recordUndelivered(
      message,
      "email delivery is disabled (MAIL_TRANSPORT=log, or the selected transport is not configured)",
    );
    return { delivered: false };
  }

  const client = env.MAIL_TRANSPORT === "resend" ? getClient() : null;
  const attempt =
    env.MAIL_TRANSPORT === "smtp"
      ? await smtpAttempt(message)
      : client
        ? await resendAttempt(message, client)
        : null;

  if (!attempt) {
    await recordUndelivered(message, "no mail client could be created");
    return { delivered: false };
  }

  let lastFailure = "unknown error";
  let lastStatusCode: number | null = null;

  for (let attemptNumber = 1; attemptNumber <= MAX_ATTEMPTS; attemptNumber += 1) {
    const result = await attempt();

    if (result.ok) {
      logger.info("email accepted by provider", {
        to: message.to,
        subject: message.subject,
        transport: env.MAIL_TRANSPORT,
        providerMessageId: result.id,
        attempts: attemptNumber,
      });
      return { delivered: true, ...(result.id ? { id: result.id } : {}) };
    }

    lastFailure = result.message;
    lastStatusCode = result.statusCode;

    if (attemptNumber < MAX_ATTEMPTS && isTransientFailure(result.message, result.statusCode)) {
      logger.warn("email attempt failed; retrying", {
        to: message.to,
        attempt: attemptNumber,
        providerError: result.message,
      });
      await sleep(backoffDelayMs(attemptNumber));
      continue;
    }

    break;
  }

  const hint = explainProviderError(lastFailure);

  await recordUndelivered(message, "provider did not accept the message", {
    providerError: lastFailure,
    attempts: MAX_ATTEMPTS,
    statusCode: lastStatusCode,
    ...(hint ? { hint } : {}),
  });

  return { delivered: false };
}
