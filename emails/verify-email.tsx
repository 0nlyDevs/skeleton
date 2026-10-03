import { Section, Text } from "@react-email/components";

import { createMailTranslator, type EmailLocale } from "./copy";
import { ActionLink, EmailButton, EmailLayout, emailStyles, lead } from "./layout";

export interface VerifyEmailProps {
  readonly name: string;
  /** Absolute link containing the one-time token. */
  readonly url: string;
  readonly appUrl: string;
  readonly expiresInMinutes?: number;
  readonly locale?: EmailLocale;
}

/** Fixture for `npm run email:preview`. */
export const PreviewProps: VerifyEmailProps = {
  name: "Colombe",
  url: "https://terra-nova.webcup.fr/verify-email?token=8fA2kQ7xZ1pLm4vR",
  appUrl: "https://terra-nova.webcup.fr",
  expiresInMinutes: 60,
  locale: "fr",
};

export default function VerifyEmail({
  name,
  url,
  appUrl,
  expiresInMinutes = 60,
  locale,
}: VerifyEmailProps) {
  const t = createMailTranslator(locale ?? "fr");

  return (
    <EmailLayout
      preview={t("mail.verify.preview")}
      heading={t("mail.verify.heading", { name })}
      appUrl={appUrl}
      locale={locale}
      reason={t("mail.verify.reason")}
    >
      <Text style={lead}>{t("mail.verify.lead")}</Text>

      <EmailButton href={url}>{t("mail.verify.cta")}</EmailButton>

      {/*
        The expiry was buried mid-sentence in the lead paragraph. It is a
        constraint the reader needs *before* they click, so it gets its own
        block, directly above the button it constrains.
      */}
      <Section style={emailStyles.notice}>
        <Text style={emailStyles.noticeText}>
          {t("mail.verify.constraint", { minutes: expiresInMinutes })}
        </Text>
      </Section>

      <ActionLink url={url} t={t} short />
    </EmailLayout>
  );
}