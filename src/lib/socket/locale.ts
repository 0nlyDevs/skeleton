import { localeFromCookieHeader } from "@/lib/i18n/config";
import { localizeServerMessage } from "@/lib/i18n/server-messages";

import type { AppSocket } from "./handlers";

/** The interface language of a socket, from the locale cookie sent at handshake. */
export function socketLocale(socket: AppSocket) {
  return localeFromCookieHeader(socket.handshake.headers.cookie);
}

/** Same translation step as HTTP errors: a French interface never shows English. */
export function localizeForSocket(socket: AppSocket, message: string): string {
  return localizeServerMessage(message, socketLocale(socket));
}