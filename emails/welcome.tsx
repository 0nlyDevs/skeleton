import { Button, Section, Text } from "@react-email/components";

import { EmailLayout, button, paragraph } from "./layout";

export interface WelcomeProps {
  readonly name: string;
  readonly appUrl: string;
}

export default function Welcome({ name, appUrl }: WelcomeProps) {
  return (
    <EmailLayout
      preview="Votre compte est prêt"
      heading={`Votre compte est prêt, ${name}`}
      appUrl={appUrl}
    >
      <Text style={paragraph}>
        Merci pour votre inscription. Votre compte est créé — si nous vous avons
        aussi envoyé un lien de confirmation, ouvrez-le avant de vous connecter.
      </Text>

      <Text style={paragraph}>Quelques pistes pour commencer :</Text>
      <Text style={{ ...paragraph, paddingLeft: "16px" }}>
        • Créez une publication depuis le tableau de bord — c&apos;est le modèle que
        tous les modules suivent.
        <br />• Activez l&apos;authentification à deux facteurs dans Réglages →
        Sécurité.
        <br />• Dites bonjour dans le salon de chat.
      </Text>

      <Section style={{ margin: "28px 0" }}>
        <Button href={`${appUrl}/dashboard`} style={button}>
          Ouvrir mon tableau de bord
        </Button>
      </Section>
    </EmailLayout>
  );
}
