import { Section, Text } from "@react-email/components";

import { createMailTranslator, type EmailLocale } from "./copy";
import { BulletList, EmailButton, EmailLayout, lead } from "./layout";

export interface WelcomeProps {
  readonly name: string;
  readonly appUrl: string;
  readonly locale?: EmailLocale;
}

/** Fixture for `npm run email:preview`, so review shows a real message. */
export const PreviewProps: WelcomeProps = {
  name: "Colombe",
  appUrl: "https://terra-nova.webcup.fr",
  locale: "fr",
};

/**
 * First contact after sign-up, and the message with the highest open rate the
 * product sends.
 *
 * It used to advertise a scaffold that no longer exists — "create a post from the
 * dashboard", "say hi in the chat room" — and its button pointed at `/dashboard`
 * while every auth flow in the app lands on `/space`. It now lists the three
 * things a Terra Nova resident can actually do, in the order they are useful.
 */
export default function Welcome({ name, appUrl, locale }: WelcomeProps) {
  const t = createMailTranslator(locale ?? "fr");

  return (
    <EmailLayout
      preview={t("mail.welcome.preview")}
      heading={t("mail.welcome.heading", { name })}
      appUrl={appUrl}
      locale={locale}
      reason={t("mail.welcome.reason")}
    >
      <Text style={lead}>{t("mail.welcome.lead")}</Text>

      <BulletList
        items={[
          t("mail.welcome.step1"),
          t("mail.welcome.step2"),
          t("mail.welcome.step3"),
        ]}
      />

      <Section style={{ height: "20px", lineHeight: "20px", fontSize: "0" }} />

      <EmailButton href={`${appUrl}/space`}>{t("mail.welcome.cta")}</EmailButton>
    </EmailLayout>
  );
}