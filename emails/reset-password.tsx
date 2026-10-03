import { Section, Text } from "@react-email/components";

import { createMailTranslator, type EmailLocale } from "./copy";
import { ActionLink, EmailButton, EmailLayout, emailStyles, lead } from "./layout";

export interface ResetPasswordProps {
  readonly name: string;
  readonly url: string;
  readonly appUrl: string;
  readonly expiresInMinutes?: number;
  readonly locale?: EmailLocale;
}

/** Fixture for `npm run email:preview`. */
export const PreviewProps: ResetPasswordProps = {
  name: "Colombe",
  url: "https://terra-nova.webcup.fr/reset-password?token=3nB7yR4wK9dT2hLm",
  appUrl: "https://terra-nova.webcup.fr",
  expiresInMinutes: 60,
  locale: "fr",
};

export default function ResetPassword({
  name,
  url,
  appUrl,
  expiresInMinutes = 60,
  locale,
}: ResetPasswordProps) {
  const t = createMailTranslator(locale ?? "fr");

  return (
    <EmailLayout
      preview={t("mail.reset.preview")}
      heading={t("mail.reset.heading", { name })}
      appUrl={appUrl}
      locale={locale}
      reason={t("mail.reset.reason")}
    >
      <Text style={lead}>{t("mail.reset.lead")}</Text>

      <EmailButton href={url}>{t("mail.reset.cta")}</EmailButton>

      {/* Single use and sign-out are consequences, not details: state them up front. */}
      <Section style={emailStyles.notice}>
        <Text style={emailStyles.noticeText}>
          {t("mail.reset.constraint", { minutes: expiresInMinutes })}
        </Text>
      </Section>

      <ActionLink url={url} t={t} short />
    </EmailLayout>
  );
}