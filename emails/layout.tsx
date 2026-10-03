import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

import {
  createMailTranslator,
  DEFAULT_EMAIL_LOCALE,
  type EmailLocale,
  type MailTranslator,
} from "./copy";

/**
 * Shared shell for every transactional email.
 *
 * Styles are inline on purpose: email clients strip `<style>` blocks, and table
 * layouts still render more predictably than flexbox in Outlook. The palette is
 * transcribed from the app's tokens in `src/app/globals.css` — Martian orange on
 * a warm sand canvas, so a resident moving from the product to their inbox sees
 * one identity rather than a generic template.
 *
 * Each colour below names the token it came from. `oklch()` cannot be used here:
 * Outlook desktop and several webmail clients ignore it and fall back to
 * transparent, so the values are pre-converted to hex.
 */

const colors = {
  /** `--background`: warm sand, so the white card reads as a surface. */
  background: "#f8f2ee",
  /** `--surface`. */
  surface: "#ffffff",
  /** `--border`. */
  border: "#e3e5e8",
  /** `--foreground`. */
  text: "#111418",
  /** `--neutral-700`: body copy. */
  body: "#373b3f",
  /** `--muted-foreground`: secondary text. */
  muted: "#606467",
  /** `--primary` / `--brand-600`. 5.5:1 against white, so it carries button labels. */
  accent: "#bf3a00",
  /** `--brand-700`: accent text on the `--brand-50` wash. 7:1 on that wash. */
  accentText: "#9d2800",
  /** `--brand-500`. */
  accentRule: "#db5612",
  /** `--accent` / `--brand-50`. */
  accentWash: "#fff2e9",
} as const;

const styles = {
  body: {
    backgroundColor: colors.background,
    margin: 0,
    padding: "32px 12px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    // Stops iOS Mail and Outlook.app from substituting their own serif into the
    // monospaced fallback URL block.
    WebkitFontSmoothing: "antialiased",
  },
  container: {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: "12px",
    margin: "0 auto",
    maxWidth: "560px",
    padding: "0",
  },
  /**
   * A 3px brand rule across the top of the card. The one place the Martian
   * orange appears before the reader reaches the button, and it survives every
   * client because it is a background colour on a table cell, not an image.
   */
  accentBar: {
    backgroundColor: colors.accent,
    fontSize: "0",
    height: "3px",
    lineHeight: "3px",
  },
  brandTile: {
    backgroundColor: colors.accent,
    borderRadius: "10px",
    color: "#ffffff",
    display: "block",
    fontSize: "12px",
    fontWeight: 700,
    height: "32px",
    letterSpacing: "0.02em",
    lineHeight: "32px",
    margin: 0,
    textAlign: "center",
    width: "32px",
  },
  /**
   * Boska is the app's display face, but webfonts are unreliable in email and a
   * blocked font is worse than a substitute. Georgia carries the same
   * editorial, high-contrast-with-brackets character on every client.
   */
  brandName: {
    color: colors.text,
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: "17px",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    lineHeight: "32px",
    margin: 0,
  },
  heading: {
    color: colors.text,
    fontSize: "22px",
    fontWeight: 700,
    letterSpacing: "-0.02em",
    lineHeight: "30px",
    margin: "0 0 16px",
  },
  /**
   * `Hr` defaults to `borderTop: 1px solid #eaeaea` — a cool grey that exists
   * nowhere in the app. Overriding `borderColor` alone leaves that default in
   * place, because the default is expressed as `borderTop`, not `border`.
   */
  hr: {
    borderColor: colors.border,
    borderTop: `1px solid ${colors.border}`,
    margin: "28px 0 20px",
    width: "100%",
  },
  footer: {
    color: colors.muted,
    fontSize: "12px",
    lineHeight: "20px",
    margin: "0 0 8px",
  },
  /**
   * The tinted block for a constraint the reader needs before acting
   * ("expires in 60 minutes") and for the reason a message reached them.
   *
   * The left rule does the work of a warning without the alarm of a red border:
   * this is information, not an error.
   */
  notice: {
    backgroundColor: colors.accentWash,
    borderLeft: `3px solid ${colors.accentRule}`,
    borderRadius: "0 8px 8px 0",
    margin: "0 0 20px",
    padding: "12px 16px",
  },
  noticeText: {
    color: colors.accentText,
    fontSize: "13px",
    lineHeight: "20px",
    margin: 0,
  },
} as const;

/**
 * Opts the message out of client-side dark mode.
 *
 * Apple Mail, Outlook.com and the new Outlook for Windows force-invert a light
 * HTML message: the sand canvas goes near-black and the orange button goes muddy
 * brown. Declaring `light` explicitly is the supported way to say "no, this is
 * already the design".
 */
function head() {
  return (
    <Head>
      <meta name="x-apple-disable-message-reformatting" />
      <meta name="color-scheme" content="light" />
      <meta name="supported-color-schemes" content="light" />
    </Head>
  );
}

/**
 * The masthead: accent tile plus wordmark, mirroring `components/layout/brand.tsx`.
 *
 * A tile rather than the app's SVG mark, because Gmail and Outlook strip inline
 * SVG. The silhouette matches; the ornament cannot.
 */
function masthead(t: MailTranslator) {
  return (
    <Section style={{ padding: "28px 32px 0" }}>
      <Row>
        <Column style={{ verticalAlign: "middle", width: "32px" }}>
          <Text style={styles.brandTile}>TN</Text>
        </Column>
        <Column style={{ verticalAlign: "middle" }}>
          <Text style={styles.brandName}>{t("mail.brand")}</Text>
        </Column>
      </Row>
    </Section>
  );
}

export interface EmailLayoutProps {
  /** Inbox preview line. */
  readonly preview: string;
  readonly heading: string;
  readonly children: ReactNode;
  readonly appUrl: string;
  /** Drives `lang` on `<html>` so screen readers read it in the right language. */
  readonly locale?: EmailLocale;
  /**
   * Why this message reached the reader, rendered above the legal footer.
   *
   * `sendNotificationEmail` used to promise "you can turn these off at any time"
   * with nothing to click. A stated reason that links somewhere is the difference
   * between a preference and a dead end.
   */
  readonly reason?: ReactNode;
}

export function EmailLayout({
  preview,
  heading,
  children,
  appUrl = "",
  locale = DEFAULT_EMAIL_LOCALE,
  reason,
}: EmailLayoutProps) {
  const t = createMailTranslator(locale);

  return (
    <Html lang={locale}>
      {head()}
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section style={styles.accentBar}>
            <Text style={{ margin: 0 }}>&nbsp;</Text>
          </Section>

          {masthead(t)}

          <Section style={{ padding: "24px 32px 0" }}>
            <Text style={styles.heading}>{heading}</Text>
            {children}
          </Section>

          <Section style={{ padding: "0 32px 32px" }}>
            <Hr style={styles.hr} />

            {reason ? (
              <Section style={styles.notice}>
                <Text style={styles.noticeText}>{reason}</Text>
              </Section>
            ) : null}

            <Text style={styles.footer}>
              {t("mail.footer_reason")}{" "}
              <Link href={appUrl || "/"} style={{ color: colors.accent }}>
                {t("mail.brand")}
              </Link>
              . {t("mail.footer_ignore")}
            </Text>
            <Text style={{ ...styles.footer, margin: 0 }}>
              {/* The bare domain, so the reader can tell this is not a phishing
                  lookalike before they click anything above. Guarded because the
                  React Email dev server initially renders with an empty form. */}
              {appUrl.replace(/^https?:\/\//, "")}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Shared paragraph style so each template stays a few lines long. */
export const paragraph: React.CSSProperties = {
  color: colors.body,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

/** Lead paragraph under a heading: the one sentence that says what happened. */
export const lead: React.CSSProperties = {
  ...paragraph,
  color: colors.muted,
  fontSize: "16px",
  lineHeight: "26px",
  margin: "0 0 20px",
};

/** Shared button style. */
export const button: React.CSSProperties = {
  backgroundColor: colors.accent,
  borderRadius: "10px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600,
  lineHeight: "20px",
  // 13px + 13px + 20px = 46px: clears the 44px minimum touch target, which the
  // old 12px padding missed on the verify and reset buttons.
  padding: "13px 22px",
  textDecoration: "none",
};

export const buttonSection: React.CSSProperties = {
  margin: "28px 0",
};

export const helperText: React.CSSProperties = {
  color: colors.muted,
  fontSize: "13px",
  lineHeight: "20px",
  margin: "0 0 12px",
};

/** Section holding the button. One place, so every template's spacing agrees. */
export function EmailButton({
  href,
  children,
}: {
  readonly href: string;
  readonly children: ReactNode;
}) {
  return (
    <Section style={buttonSection}>
      <Button href={href} style={button}>
        {children}
      </Button>
    </Section>
  );
}

/**
 * The plain-URL fallback under a primary button.
 *
 * Two templates needed this and they had drifted apart — verify-email explained
 * why, reset-password dumped a bare string. One component, one wording.
 *
 * `overflowWrap: "anywhere"` breaks the URL only where it must, at the token
 * boundary. The old `wordBreak: "break-all"` cut mid-token and produced
 * `https://terra-no` / `va.app/reset-pa` / `ssword?token=…`.
 */
export function ActionLink({
  url,
  t,
  short = false,
}: {
  readonly url: string;
  readonly t: MailTranslator;
  readonly short?: boolean;
}) {
  return (
    <>
      <Text style={helperText}>
        {short ? t("mail.action.fallback_short") : t("mail.action.fallback")}
      </Text>
      <Link
        href={url}
        style={{
          backgroundColor: colors.background,
          border: `1px solid ${colors.border}`,
          borderRadius: "8px",
          color: colors.body,
          display: "block",
          fontSize: "12px",
          lineHeight: "18px",
          overflowWrap: "anywhere",
          padding: "12px 14px",
          textDecoration: "none",
          wordBreak: "break-word",
        }}
      >
        {url}
      </Link>
    </>
  );
}

/**
 * A titled list.
 *
 * Built as a table rather than `<br/>`-separated bullets: a `<br/>` list cannot be
 * spaced, and every screen reader announces "bullet" once per item. The accent
 * dot sits in its own cell so it never reflows into the text.
 */
export function BulletList({ items }: { readonly items: readonly string[] }) {
  return (
    <Section style={{ margin: "0 0 8px" }}>
      {items.map((item) => (
        <Row key={item}>
          <Column style={{ verticalAlign: "top", width: "18px" }}>
            <Text
              style={{
                color: colors.accent,
                fontSize: "15px",
                lineHeight: "24px",
                margin: 0,
              }}
            >
              •
            </Text>
          </Column>
          <Column style={{ verticalAlign: "top" }}>
            <Text style={{ ...paragraph, margin: "0 0 8px" }}>{item}</Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

export { styles as emailStyles, colors as emailColors };