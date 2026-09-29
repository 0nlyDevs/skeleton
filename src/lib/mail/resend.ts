/**
 * Transactional email transport.
 *
 * Two properties matter more than throughput here:
 *
 *   1. **Sending never throws.** A provider outage must not fail a registration
 *      or a password reset — the account is already created, and the user can
 *      ask for another link. Failures are logged and reported back as
 *      `delivered: false`.
 *   2. **It works without credentials.** On a contest box where `RESEND_API_KEY`
 *      is unset, the transport logs the message (including the action URL) so
 *      the whole flow stays testable end to end.
 */

import { Resend } from "resend";
import type { ReactElement } from "react";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly react: ReactElement;
  readonly replyTo?: string;
  /**
   * The link inside the email. Logged when delivery is disabled so a developer
   * can complete the flow without a mailbox.
   */
  readonly previewUrl?: string;
}

export interface MailResult {
  readonly delivered: boolean;
  readonly id?: string;
}

let cachedClient: Resend | null | undefined;

function getClient(): Resend | null {
  if (cachedClient === undefined) {
    cachedClient = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;
  }
  return cachedClient;
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const client = getClient();

  if (!env.emailEnabled || !client) {
    logger.warn("email delivery is disabled; logging the message instead", {
      to: message.to,
      subject: message.subject,
      previewUrl: message.previewUrl,
    });
    return { delivered: false };
  }

  try {
    const { data, error } = await client.emails.send({
      from: env.MAIL_FROM,
      to: message.to,
      subject: message.subject,
      react: message.react,
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    });

    if (error) {
      logger.error("email provider rejected the message", {
        to: message.to,
        subject: message.subject,
        providerError: error.message,
      });
      return { delivered: false };
    }

    logger.info("email accepted by provider", {
      to: message.to,
      subject: message.subject,
      providerMessageId: data?.id,
    });

    return { delivered: true, ...(data?.id ? { id: data.id } : {}) };
  } catch (error) {
    logger.error("email delivery failed", { to: message.to, subject: message.subject, error });
    return { delivered: false };
  }
}
