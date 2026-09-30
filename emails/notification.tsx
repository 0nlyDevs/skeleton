import { Button, Section, Text } from "@react-email/components";

import { EmailLayout, button, paragraph } from "./layout";

export interface NotificationEmailProps {
  readonly name: string;
  readonly title: string;
  readonly body: string | null;
  /** Absolute link to the relevant page in the app. */
  readonly url: string;
  readonly appUrl: string;
}

export default function NotificationEmail({
  name,
  title,
  body,
  url,
  appUrl,
}: NotificationEmailProps) {
  return (
    <EmailLayout preview={title} heading={title} appUrl={appUrl}>
      <Text style={paragraph}>Bonjour {name},</Text>
      {body ? <Text style={paragraph}>{body}</Text> : null}

      <Section style={{ margin: "28px 0" }}>
        <Button href={url} style={button}>
          Ouvrir dans l&apos;application
        </Button>
      </Section>

      <Text style={{ ...paragraph, fontSize: "13px", color: "#71717a" }}>
        Vous recevez cet e-mail car les notifications par e-mail sont activées dans
        les réglages de votre compte. Vous pouvez les désactiver à tout moment.
      </Text>
    </EmailLayout>
  );
}
