import { Button, Section, Text } from "@react-email/components";

import {
  EmailLayout,
  button,
  emailStyles,
  helperText,
  paragraph,
} from "./layout";

export interface ResetPasswordProps {
  readonly name: string;
  readonly url: string;
  readonly appUrl: string;
  readonly expiresInMinutes?: number;
}

export default function ResetPassword({
  name,
  url,
  appUrl,
  expiresInMinutes = 60,
}: ResetPasswordProps) {
  return (
    <EmailLayout
      preview="Réinitialisation de votre mot de passe"
      heading={`Réinitialisez votre mot de passe, ${name}`}
      appUrl={appUrl}
    >
      <Text style={paragraph}>
        Une réinitialisation de mot de passe a été demandée pour votre compte. Le
        lien ci-dessous est valable {expiresInMinutes} minutes, fonctionne une seule
        fois et déconnecte vos autres appareils lors de son utilisation.
      </Text>

      <Section style={{ margin: "28px 0" }}>
        <Button href={url} style={button}>
          Choisir un nouveau mot de passe
        </Button>
      </Section>

      <Text style={helperText}>
        Si vous n&apos;êtes pas à l&apos;origine de cette demande, aucune action n&apos;est
        nécessaire — votre mot de passe reste inchangé et ce lien expirera de lui-même.
      </Text>
      <Text style={emailStyles.fallbackLink}>{url}</Text>
    </EmailLayout>
  );
}
