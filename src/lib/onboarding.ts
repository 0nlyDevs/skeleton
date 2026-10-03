/**
 * D12 — first-steps guide in the citizen space. Progress that the database
 * does not hold (a service was opened, the guide was hidden) lives in cookies
 * so the server renders the right state from the first byte.
 */
export const WELCOME_HIDDEN_COOKIE = "tn_welcome_hidden";
export const WELCOME_SERVICE_COOKIE = "tn_welcome_service";

const YEAR = 60 * 60 * 24 * 365;

export function setWelcomeCookie(name: string): void {
  document.cookie = `${name}=1; Path=/; Max-Age=${YEAR}; SameSite=Lax`;
}
