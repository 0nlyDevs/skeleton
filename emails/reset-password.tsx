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
      preview="Reset your password"
      heading={`Reset your password, ${name}`}
      appUrl={appUrl}
    >
      <Text style={paragraph}>
        Someone requested a password reset for your account. The link below is valid for{" "}
        {expiresInMinutes} minutes, works once, and signs out your other devices when
        used.
      </Text>

      <Section style={{ margin: "28px 0" }}>
        <Button href={url} style={button}>
          Choose a new password
        </Button>
      </Section>

      <Text style={helperText}>
        If you did not ask for this, no action is needed — your password stays
        unchanged and this link will expire on its own.
      </Text>
      <Text style={emailStyles.fallbackLink}>{url}</Text>
    </EmailLayout>
  );
}
