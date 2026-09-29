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
      preview="Confirm your email address to activate your account"
      heading={`Welcome, ${name}`}
      appUrl={appUrl}
    >
      <Text style={paragraph}>
        Confirm this email address to activate your account. The link below is valid for{" "}
        {expiresInMinutes} minutes and can only be used once.
      </Text>

      <Section style={{ margin: "28px 0" }}>
        <Button href={url} style={button}>
          Verify my email
        </Button>
      </Section>

      <Text style={helperText}>
        Button not working? Copy this address into your browser:
      </Text>
      <Text style={emailStyles.fallbackLink}>{url}</Text>
    </EmailLayout>
  );
}
