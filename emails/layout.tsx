import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/**
 * Shared shell for every transactional email.
 *
 * Styles are inline on purpose: email clients strip `<style>` blocks, and table
 * layouts still render more predictably than flexbox in Outlook. The palette
 * mirrors the app's tokens so a jury comparing the product and its inbox sees
 * one identity.
 */

const colors = {
  background: "#f4f5f7",
  surface: "#ffffff",
  border: "#e4e6eb",
  text: "#18181b",
  muted: "#71717a",
  accent: "#4f46e5",
};

const styles = {
  body: {
    backgroundColor: colors.background,
    margin: 0,
    padding: "32px 12px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  },
  container: {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: "12px",
    margin: "0 auto",
    maxWidth: "560px",
    padding: "32px",
  },
  brand: {
    color: colors.accent,
    fontSize: "15px",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    margin: "0 0 4px",
  },
  footer: {
    color: colors.muted,
    fontSize: "12px",
    lineHeight: "20px",
    margin: "16px 0 0",
  },
  hr: {
    borderColor: colors.border,
    margin: "28px 0 16px",
  },
  fallbackLink: {
    color: colors.muted,
    fontSize: "12px",
    lineHeight: "18px",
    wordBreak: "break-all" as const,
  },
} as const;

export interface EmailLayoutProps {
  /** Inbox preview line. */
  readonly preview: string;
  readonly heading: string;
  readonly children: ReactNode;
  readonly appUrl: string;
}

export function EmailLayout({ preview, heading, children, appUrl }: EmailLayoutProps) {
  return (
    <Html lang="fr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.brand}>Webcup Base</Text>
          <Text
            style={{
              color: colors.text,
              fontSize: "20px",
              fontWeight: 600,
              margin: "0 0 16px",
            }}
          >
            {heading}
          </Text>

          {children}

          <Hr style={styles.hr} />
          <Section>
            <Text style={styles.footer}>
              Ceci est un message automatique de{" "}
              <Link href={appUrl} style={{ color: colors.accent }}>
                Webcup Base
              </Link>
              . Si vous ne l&apos;avez pas demandé, ignorez-le.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Shared paragraph style so each template stays a few lines long. */
export const paragraph: React.CSSProperties = {
  color: "#3f3f46",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

/** Shared button style. */
export const button: React.CSSProperties = {
  backgroundColor: colors.accent,
  borderRadius: "8px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 22px",
  textDecoration: "none",
};

export const helperText: React.CSSProperties = {
  color: colors.muted,
  fontSize: "13px",
  lineHeight: "20px",
  margin: "20px 0 0",
};

export { styles as emailStyles, colors as emailColors };
