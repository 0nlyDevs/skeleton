import { Button, Section, Text } from "@react-email/components";

import {
  EmailLayout,
  button,
  helperText,
  paragraph,
  emailStyles,
} from "./layout";

export interface VerifyEmailProps {
  readonly name: string;
  /** Absolute link containing the one-time token. */
  readonly url: string;
  readonly appUrl: string;
  readonly expiresInMinutes?: number;
}

export default function VerifyEmail({
  name,
  url,
  appUrl,
  expiresInMinutes = 60,
}: VerifyEmailProps) {
  return (
    <EmailLayout
      preview="Confirmez votre adresse e-mail pour activer votre compte"
      heading={`Bienvenue, ${name}`}
      appUrl={appUrl}
    >
      <Text style={paragraph}>
        Confirmez cette adresse e-mail pour activer votre compte. Le lien ci-dessous
        est valable {expiresInMinutes} minutes et ne peut être utilisé qu&apos;une seule
        fois.
      </Text>

      <Section style={{ margin: "28px 0" }}>
        <Button href={url} style={button}>
          Vérifier mon adresse
        </Button>
      </Section>

      <Text style={helperText}>
        Le bouton ne fonctionne pas ? Copiez cette adresse dans votre navigateur :
      </Text>
      <Text style={emailStyles.fallbackLink}>{url}</Text>
    </EmailLayout>
  );
}
