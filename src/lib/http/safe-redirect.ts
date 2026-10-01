/**
 * Post-login destinations come from the URL (`?next=`), i.e. from anyone who
 * can send a link. Only same-site absolute paths are accepted; anything that a
 * browser could resolve to another origin (`//evil`, `/\\evil`, schemes,
 * control characters) falls back to the feed. Prevents open redirects.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/feed"): string {
  if (!value || value.length > 300) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(value)) return fallback;
  if (/^\/(login|register|2fa|forgot-password|reset-password)(\/|\?|$)/.test(value)) return fallback;
  return value;
}
