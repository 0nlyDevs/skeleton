/**
 * Named transactional emails.
 *
 * Auth code calls these instead of assembling messages inline, so the subject
 * line, template and preview URL for a given event are defined in exactly one
 * place and stay consistent between flows.
 *
 * `locale` is required rather than defaulted. It is resolved by the caller from
 * the request cookie, because the templates are rendered outside Next and cannot
 * read `next/headers` themselves. Making it explicit means a new call site has to
 * decide which language the message is in rather than silently inheriting French.
 */

import { createMailTranslator } from "@emails/copy";
import NotificationEmail from "@emails/notification";
import ResetPassword from "@emails/reset-password";
import VerifyEmail from "@emails/verify-email";
import Welcome from "@emails/welcome";

import { env } from "@/lib/env";
import type { Locale } from "@/lib/i18n/config";

import { sendMail, type MailResult } from "./mailer";

const TOKEN_TTL_MINUTES = 60;

export async function sendVerificationEmail(input: {
  to: string;
  name: string;
  url: string;
  locale: Locale;
}): Promise<MailResult> {
  const t = createMailTranslator(input.locale);

  return sendMail({
    to: input.to,
    subject: `[Bubble] ${t("mail.subject.verify")}`,
    previewUrl: input.url,
    react: (
      <VerifyEmail
        name={input.name}
        url={input.url}
        appUrl={env.appUrl}
        expiresInMinutes={TOKEN_TTL_MINUTES}
        locale={input.locale}
      />
    ),
  });
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  url: string;
  locale: Locale;
}): Promise<MailResult> {
  const t = createMailTranslator(input.locale);

  return sendMail({
    to: input.to,
    subject: `[Bubble] ${t("mail.subject.reset")}`,
    previewUrl: input.url,
    react: (
      <ResetPassword
        name={input.name}
        url={input.url}
        appUrl={env.appUrl}
        expiresInMinutes={TOKEN_TTL_MINUTES}
        locale={input.locale}
      />
    ),
  });
}

export async function sendWelcomeEmail(input: {
  to: string;
  name: string;
  locale: Locale;
}): Promise<MailResult> {
  const t = createMailTranslator(input.locale);

  return sendMail({
    to: input.to,
    subject: `[Bubble] ${t("mail.subject.welcome")}`,
    react: <Welcome name={input.name} appUrl={env.appUrl} locale={input.locale} />,
  });
}

/**
 * Notification digest for a single event.
 *
 * Called only when the recipient has opted in for that notification type, which
 * is what makes the email switches on the preferences page real rather than
 * decorative.
 *
 * The subject is the event title as the caller wrote it. Those titles are still
 * French at every call site (`city-requests.service.ts`, `users.service.ts`, …),
 * so the template chrome is localised but the content is not: the day the titles
 * move into the dictionary, only this signature changes.
 */
export async function sendNotificationEmail(input: {
  to: string;
  name: string;
  title: string;
  body?: string | null;
  path: string;
  locale?: Locale;
}): Promise<MailResult> {
  const url = `${env.appUrl}${input.path.startsWith("/") ? input.path : `/${input.path}`}`;

  return sendMail({
    to: input.to,
    subject: `[Bubble] ${input.title}`,
    previewUrl: url,
    react: (
      <NotificationEmail
        name={input.name}
        title={input.title}
        body={input.body ?? null}
        url={url}
        appUrl={env.appUrl}
        locale={input.locale}
      />
    ),
  });
}