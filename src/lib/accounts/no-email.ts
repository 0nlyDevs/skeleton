/**
 * F71 — residents without an email address. Their account still needs a unique
 * `email` (BetterAuth keys accounts on it), so it gets a placeholder on the
 * reserved `.invalid` domain (RFC 2606): it can never be delivered to, and the
 * mailer refuses it outright.
 */
export const NO_EMAIL_DOMAIN = "no-email.invalid";

export function placeholderEmail(username: string): string {
  return `${username}@${NO_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(address: string | null | undefined): boolean {
  return typeof address === "string" && address.toLowerCase().endsWith(`@${NO_EMAIL_DOMAIN}`);
}
