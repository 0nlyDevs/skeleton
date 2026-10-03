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
  /** `--primary`: the Bubble logo orange (#E56100). 5.2:1 on white, so it
   * carries button labels and the logo itself. */
  accent: "#E56100",
  /** Darker orange for text on the accent wash. 5.7:1 on `--accentWash`. */
  accentText: "#ad3c00",
  /** Same orange for rules and borders. */
  accentRule: "#E56100",
  /** Light tint of the logo orange, for the notice background. */
  accentWash: "#fff4e6",
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
   * A 3px brand rule across the top of the card. The one place the Bubble
   * orange appears before the reader reaches the button, and it survives every
   * client because it is a background colour on a table cell, not an image.
   */
  accentBar: {
    backgroundColor: colors.accent,
    fontSize: "0",
    height: "3px",
    lineHeight: "3px",
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
 * The masthead: the Bubble logo SVG.
 *
 * The logo already reads "Bubble", so — as the product requested — the text
 * wordmark is dropped and the mark carries the name itself.
 *
 * Inline SVG is the only way to show the logo without a publicly-hosted asset,
 * because the Resend transport has no CDN to reach. It renders in Apple Mail,
 * iOS Mail and Outlook.com; Gmail and Outlook desktop strip `<svg>`, where the
 * top accent bar (a solid `td` background) is what still carries the orange.
 */
function masthead(appUrl: string) {
  return (
    <Section style={{ padding: "16px 0 0", textAlign: "center" }}>
      <Link href={appUrl || "/"} style={{ textDecoration: "none" }}>
        <svg
          aria-labelledby="bubble-logo-title"
          height="36"
          role="img"
          viewBox="0 0 1254 1254"
          width="36"
          style={{ display: "block", margin: "0 auto" }}
        >
          <title id="bubble-logo-title">Bubble</title>
          <g fill="#E56100" fillRule="evenodd">
            {
              // Faithful vector trace of the Bubble logo. The fill is forced to
              // the brand orange above, not the source file's #E65100.
            }
            <path d="M 403 863 L 398 870 L 398 921 L 404 937 L 413 948 L 420 953 L 433 959 L 444 960 L 445 961 L 454 961 L 455 960 L 461 960 L 469 958 L 481 952 L 491 943 L 498 932 L 502 917 L 502 872 L 500 867 L 495 862 L 493 861 L 485 861 L 478 866 L 476 870 L 476 913 L 472 924 L 465 931 L 456 935 L 443 935 L 440 934 L 432 929 L 427 923 L 424 915 L 424 871 L 423 868 L 419 863 L 415 861 L 407 861 Z" />
            <path d="M 916 862 L 905 868 L 893 879 L 885 893 L 882 906 L 883 920 L 886 929 L 893 940 L 900 947 L 917 957 L 934 961 L 946 961 L 966 956 L 978 949 L 985 942 L 987 934 L 983 927 L 979 925 L 973 925 L 954 936 L 945 938 L 937 938 L 928 936 L 918 930 L 914 926 L 910 918 L 911 917 L 920 917 L 921 916 L 924 917 L 989 917 L 993 916 L 997 912 L 998 909 L 998 903 L 995 891 L 990 882 L 980 871 L 965 862 L 952 858 L 930 858 Z M 910 900 L 913 894 L 919 888 L 920 888 L 923 885 L 927 883 L 929 883 L 930 882 L 933 882 L 934 881 L 948 881 L 949 882 L 954 883 L 960 886 L 963 889 L 964 889 L 969 895 L 971 899 L 970 901 L 911 901 Z" />
            <path d="M 536 827 L 532 835 L 532 917 L 533 918 L 533 923 L 535 929 L 542 941 L 550 949 L 559 955 L 568 959 L 580 961 L 581 962 L 598 962 L 599 961 L 608 960 L 624 953 L 631 948 L 636 943 L 643 933 L 648 918 L 648 903 L 647 902 L 647 899 L 645 893 L 638 881 L 629 872 L 623 868 L 613 863 L 603 860 L 598 860 L 597 859 L 583 859 L 582 860 L 577 860 L 576 861 L 570 862 L 560 867 L 559 866 L 559 836 L 557 830 L 550 824 L 541 824 Z M 578 884 L 581 884 L 582 883 L 588 883 L 589 882 L 592 882 L 593 883 L 598 883 L 599 884 L 604 885 L 608 888 L 609 888 L 612 891 L 613 891 L 618 897 L 621 903 L 621 906 L 622 907 L 622 914 L 621 915 L 621 918 L 618 924 L 610 932 L 609 932 L 607 934 L 601 937 L 598 937 L 597 938 L 583 938 L 582 937 L 579 937 L 576 935 L 574 935 L 568 930 L 567 930 L 562 924 L 559 918 L 559 914 L 558 913 L 558 908 L 559 907 L 559 904 L 560 903 L 560 901 L 562 897 L 567 891 L 568 891 L 572 887 Z" />
            <path d="M 257 828 L 254 835 L 254 918 L 255 919 L 256 927 L 261 937 L 273 950 L 287 958 L 297 961 L 302 961 L 303 962 L 321 962 L 322 961 L 327 961 L 343 955 L 353 948 L 360 941 L 368 927 L 368 924 L 370 920 L 370 902 L 365 888 L 361 882 L 350 871 L 344 867 L 333 862 L 321 860 L 320 859 L 305 859 L 304 860 L 299 860 L 298 861 L 292 862 L 282 867 L 281 866 L 281 836 L 280 835 L 280 832 L 275 826 L 271 824 L 263 824 Z M 284 897 L 293 888 L 301 884 L 303 884 L 304 883 L 320 883 L 321 884 L 324 884 L 330 887 L 332 889 L 333 889 L 341 898 L 343 902 L 343 904 L 344 905 L 344 916 L 343 917 L 343 919 L 341 923 L 339 925 L 339 926 L 333 932 L 332 932 L 328 935 L 326 935 L 323 937 L 320 937 L 319 938 L 305 938 L 304 937 L 301 937 L 293 933 L 290 930 L 289 930 L 284 924 L 281 918 L 281 915 L 280 914 L 280 907 L 281 906 L 281 904 L 282 903 L 282 901 Z" />
            <path d="M 827 822 L 823 824 L 821 826 L 818 832 L 818 939 L 819 940 L 819 943 L 820 944 L 821 948 L 828 956 L 834 959 L 836 959 L 837 960 L 841 960 L 842 961 L 858 961 L 864 958 L 867 953 L 867 946 L 866 945 L 866 943 L 863 940 L 859 938 L 849 938 L 847 937 L 844 933 L 844 832 L 843 831 L 842 827 L 839 824 L 835 822 Z" />
            <path d="M 682 823 L 677 828 L 675 833 L 675 916 L 676 917 L 676 921 L 677 922 L 678 928 L 684 938 L 691 946 L 703 954 L 721 960 L 728 960 L 729 961 L 746 960 L 761 955 L 771 949 L 784 935 L 786 930 L 788 928 L 790 922 L 790 918 L 791 917 L 791 901 L 788 891 L 783 882 L 773 871 L 766 866 L 758 862 L 745 858 L 722 858 L 712 861 L 703 866 L 702 865 L 702 834 L 699 827 L 695 823 L 692 822 L 685 822 Z M 713 887 L 714 887 L 716 885 L 720 883 L 722 883 L 723 882 L 726 882 L 727 881 L 740 881 L 741 882 L 744 882 L 747 884 L 749 884 L 751 886 L 752 886 L 761 895 L 764 901 L 764 903 L 765 904 L 765 914 L 764 915 L 764 918 L 761 922 L 761 923 L 753 931 L 752 931 L 750 933 L 748 934 L 746 934 L 745 935 L 743 935 L 742 936 L 738 936 L 737 937 L 729 937 L 728 936 L 723 936 L 713 931 L 706 924 L 706 923 L 704 921 L 702 917 L 702 914 L 701 913 L 701 905 L 702 904 L 703 899 L 706 895 L 706 894 Z" />
            <path d="M 663 496 L 659 500 L 658 502 L 658 505 L 657 506 L 658 513 L 660 515 L 660 516 L 663 519 L 667 521 L 669 521 L 672 523 L 674 523 L 678 525 L 680 527 L 683 528 L 686 531 L 687 531 L 699 543 L 699 544 L 702 547 L 708 559 L 708 561 L 710 564 L 710 566 L 711 567 L 711 570 L 712 571 L 712 576 L 716 584 L 717 584 L 721 587 L 724 587 L 725 588 L 726 587 L 730 587 L 732 585 L 733 585 L 736 582 L 737 580 L 737 578 L 738 577 L 738 570 L 737 569 L 737 565 L 736 564 L 735 557 L 732 551 L 732 549 L 730 546 L 730 544 L 728 540 L 726 538 L 725 535 L 723 533 L 722 530 L 719 527 L 719 526 L 709 515 L 708 515 L 703 510 L 702 510 L 699 507 L 698 507 L 693 503 L 679 496 L 677 496 L 673 494 L 669 494 L 668 495 L 665 495 Z" />
            <path d="M 449 287 L 435 299 L 426 320 L 426 600 L 438 650 L 456 686 L 475 711 L 510 742 L 538 758 L 572 770 L 616 776 L 662 774 L 695 766 L 731 749 L 756 731 L 788 696 L 807 662 L 818 629 L 822 598 L 820 561 L 809 521 L 793 490 L 768 458 L 738 433 L 698 413 L 667 405 L 622 405 L 582 413 L 549 428 L 518 450 L 517 319 L 513 306 L 501 291 L 486 283 L 469 281 Z M 623 466 L 647 466 L 670 470 L 701 483 L 719 496 L 736 514 L 751 540 L 757 557 L 761 582 L 760 606 L 756 624 L 744 652 L 732 669 L 715 686 L 696 699 L 667 711 L 647 715 L 617 715 L 593 710 L 566 698 L 553 689 L 532 668 L 522 653 L 514 636 L 507 608 L 507 577 L 512 555 L 522 532 L 536 512 L 553 495 L 572 482 L 598 471 Z" />
          </g>
        </svg>
      </Link>
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

          {masthead(appUrl)}

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