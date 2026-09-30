/**
 * Named transactional emails.
 *
 * Auth code calls these instead of assembling messages inline, so the subject
 * line, template and preview URL for a given event are defined in exactly one
 * place and stay consistent between flows.
 */

import NotificationEmail from "@emails/notification";
import ResetPassword from "@emails/reset-password";
import VerifyEmail from "@emails/verify-email";
import Welcome from "@emails/welcome";

import { env } from "@/lib/env";

import { sendMail, type MailResult } from "./resend";

const TOKEN_TTL_MINUTES = 60;

export async function sendVerificationEmail(input: {
  to: string;
  name: string;
  url: string;
}): Promise<MailResult> {
  return sendMail({
    to: input.to,
    subject: "Confirmez votre adresse e-mail",
    previewUrl: input.url,
    react: (
      <VerifyEmail
        name={input.name}
        url={input.url}
        appUrl={env.appUrl}
        expiresInMinutes={TOKEN_TTL_MINUTES}
      />
    ),
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  url: string;
}): Promise<MailResult> {
  return sendMail({
    to: input.to,
    subject: "Réinitialisez votre mot de passe",
    previewUrl: input.url,
    react: (
      <ResetPassword
        name={input.name}
        url={input.url}
        appUrl={env.appUrl}
        expiresInMinutes={TOKEN_TTL_MINUTES}
      />
    ),
  });
}

export async function sendWelcomeEmail(input: {
  to: string;
  name: string;
}): Promise<MailResult> {
  return sendMail({
    to: input.to,
    subject: "Votre compte Webcup Base est prêt",
    react: <Welcome name={input.name} appUrl={env.appUrl} />,
  });
}

/**
 * Notification digest for a single event.
 *
 * Called only when the recipient has opted in for that notification type, which
 * is what makes the email switches on the preferences page real rather than
 * decorative.
 */
export async function sendNotificationEmail(input: {
  to: string;
  name: string;
  title: string;
  body?: string | null;
  path: string;
}): Promise<MailResult> {
  const url = `${env.appUrl}${input.path.startsWith("/") ? input.path : `/${input.path}`}`;

  return sendMail({
    to: input.to,
    subject: input.title,
    previewUrl: url,
    react: (
      <NotificationEmail
        name={input.name}
        title={input.title}
        body={input.body ?? null}
        url={url}
        appUrl={env.appUrl}
      />
    ),
  });
}
