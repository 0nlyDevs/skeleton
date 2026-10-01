"use client";

import type { MessageKey } from "@/lib/i18n";
import type { Translator } from "@/lib/i18n";

import { ApiRequestError } from "./client";

/**
 * One translated, specific sentence for a failed request — never a bare
 * "invalid field". A field error from the server is shown as-is (it names the
 * exact rule), everything else maps from the status / error code.
 */
export function describeApiError(error: unknown, t: Translator): string {
  if (!(error instanceof ApiRequestError)) return t("errors.server");

  if (error.fields) {
    const first = Object.values(error.fields)[0];
    if (first) return first;
  }

  const byStatus: Record<number, MessageKey> = {
    0: "errors.network",
    401: "errors.unauthenticated",
    403: "errors.forbidden",
    404: "errors.not_found",
    413: "errors.too_large",
    415: "errors.unsupported",
    429: "errors.rate_limited",
  };
  const key = byStatus[error.status];
  if (key) return t(key);

  // 400/409 carry a precise, human message from the service layer.
  if ((error.status === 400 || error.status === 409) && error.message) return error.message;
  return t("errors.server");
}
