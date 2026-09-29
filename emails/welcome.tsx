import { Button, Section, Text } from "@react-email/components";

import { EmailLayout, button, paragraph } from "./layout";

export interface WelcomeProps {
  readonly name: string;
  readonly appUrl: string;
}

export default function Welcome({ name, appUrl }: WelcomeProps) {
  return (
    <EmailLayout
      preview="Your account is ready"
      heading={`Your account is ready, ${name}`}
      appUrl={appUrl}
    >
      <Text style={paragraph}>
        Thanks for joining. Your account is created — if we also sent you a
        confirmation link, please open it before signing in.
      </Text>

      <Text style={paragraph}>A few things worth trying first:</Text>
      <Text style={{ ...paragraph, paddingLeft: "16px" }}>
        • Create a post from the dashboard — it is the template every module follows.
        <br />• Turn on two-factor authentication under Settings → Security.
        <br />• Say hello in the chat room.
      </Text>

      <Section style={{ margin: "28px 0" }}>
        <Button href={`${appUrl}/dashboard`} style={button}>
          Open my dashboard
        </Button>
      </Section>
    </EmailLayout>
  );
}
