import { DEFAULT_LOCALE, LOCALE_COOKIE, type Locale } from "@/lib/i18n/config";
import { localizeServerMessage } from "@/lib/i18n/server-messages";

import type { AppSocket } from "./handlers";

/** The interface language of a socket, from the locale cookie sent at handshake. */
export function socketLocale(socket: AppSocket): Locale {
  const cookie = socket.handshake.headers.cookie ?? "";
  const match = new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE}=([^;]+)`).exec(cookie);
  return match?.[1] === "en" ? "en" : match?.[1] === "fr" ? "fr" : DEFAULT_LOCALE;
}

/** Same translation step as HTTP errors: a French interface never shows English. */
export function localizeForSocket(socket: AppSocket, message: string): string {
  return localizeServerMessage(message, socketLocale(socket));
}
