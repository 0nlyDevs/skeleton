import { Link, Text } from "@react-email/components";

import { createMailTranslator, type EmailLocale } from "./copy";
import { EmailButton, EmailLayout, emailColors, paragraph } from "./layout";

export interface NotificationEmailProps {
  readonly name: string;
  readonly title: string;
  readonly body: string | null;
  /** Absolute link to the relevant page in the app. */
  readonly url: string;
  readonly appUrl: string;
  readonly locale?: EmailLocale;
}

/** Fixture for `npm run email:preview`. */
export const PreviewProps: NotificationEmailProps = {
  name: "Colombe",
  title: "Réponse du citoyen sur TN-4F82A1",
  body: "Bonjour, je vous confirme que le dossier est complet. Vous pouvez passer retirer votre pièce au guichet 3 demain entre 9h et 12h.",
  url: "https://terra-nova.webcup.fr/agent/requests/TN-4F82A1",
  appUrl: "https://terra-nova.webcup.fr",
  locale: "fr",
};

/**
 * A single notification event.
 *
 * The title used to be the subject line, the inbox preview *and* the heading, so
 * a resident read the same words three times before reaching the body. The
 * greeting takes the heading now and the title sits once, as the emphasised line
 * it actually is.
 */
export default function NotificationEmail({
  name,
  title,
  body,
  url,
  appUrl,
  locale,
}: NotificationEmailProps) {
  const t = createMailTranslator(locale ?? "fr");

  return (
    <EmailLayout
      preview={title}
      heading={t("mail.notification.greeting", { name })}
      appUrl={appUrl}
      locale={locale}
      reason={
        <>
          {t("mail.notification.reason")}{" "}
          {/* The old copy promised this could be turned off "at any time" and
              offered nothing to click. */}
          <Link
            href={`${appUrl}/settings/notifications`}
            style={{ color: emailColors.accent, fontWeight: 600 }}
          >
            {t("mail.notification.manage")}
          </Link>
        </>
      }
    >
      <Text style={{ ...paragraph, color: emailColors.text, fontSize: "17px", fontWeight: 600 }}>
        {title}
      </Text>

      {body ? <Text style={paragraph}>{body}</Text> : null}

      <EmailButton href={url}>{t("mail.notification.cta")}</EmailButton>
    </EmailLayout>
  );
}