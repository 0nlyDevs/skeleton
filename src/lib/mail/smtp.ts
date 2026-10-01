/**
 * SMTP delivery.
 *
 * The reason this transport exists: Resend without a verified domain only
 * delivers to the address that owns the Resend account, so verification and
 * reset emails silently never reach anyone else. Any SMTP relay (a Gmail app
 * password, Brevo, Mailgun, Mailtrap, the hosting panel's own mailbox) delivers
 * to every address with no domain setup.
 */

import nodemailer, { type Transporter } from "nodemailer";

import { env } from "@/lib/env";

let cached: Transporter | undefined;

function getTransport(): Transporter {
  if (!cached) {
    cached = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // Port 465 is implicit TLS; 587/25 upgrade with STARTTLS, which is then
      // required so credentials never cross the wire in clear text.
      secure: env.SMTP_PORT === 465,
      requireTLS: env.SMTP_PORT !== 465 && env.SMTP_REQUIRE_TLS === "1",
      ...(env.SMTP_USER ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS ?? "" } } : {}),
      // A hung relay must not hold a registration request open.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      // Messages are rendered by us; never let the library fetch files or URLs.
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }
  return cached;
}

export interface SmtpMessage {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  readonly text: string;
  readonly replyTo?: string;
}

/** Resolves with the relay's message id; rejects with the relay's error. */
export async function sendViaSmtp(message: SmtpMessage): Promise<string | undefined> {
  const info = await getTransport().sendMail({
    from: message.from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    ...(message.replyTo ? { replyTo: message.replyTo } : {}),
  });
  return typeof info.messageId === "string" ? info.messageId : undefined;
}
