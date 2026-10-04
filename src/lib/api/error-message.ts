"use client";

import type { MessageKey } from "@/lib/i18n";
import type { Translator } from "@/lib/i18n";

import { ApiRequestError } from "./client";

/**
 * A failure kept as text on a message that did not leave (`api:<status>:<code>:<message>`),
 * turned back into the sentence the resident should read.
 */
export function describeFailure(failed: string, t: Translator): string {
  if (failed === "timeout" || failed === "error") return t("errors.network");
  const match = failed.match(/^api:(\d+):([A-Z_]+):([\s\S]*)$/);
  if (!match) return failed;
  return describeApiError(new ApiRequestError({ status: Number(match[1]), code: match[2] ?? "INTERNAL_ERROR", message: match[3] ?? "" }), t);
}

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

  if (error.code === "UPLOAD_FAILED") return t("errors.upload_failed");

  const byStatus: Record<number, MessageKey> = {
    0: "errors.network",
    401: "errors.unauthenticated",
    403: "errors.forbidden",
    404: "errors.not_found",
    413: "errors.too_large",
    415: "errors.unsupported",
    429: "errors.rate_limited",
    502: "errors.unavailable",
    503: "errors.unavailable",
    504: "errors.unavailable",
  };
  const key = byStatus[error.status];
  if (key) return t(key);

  // Client errors carry a precise, human message from the service layer: show it, never a vague one.
  if (error.status >= 400 && error.status < 500 && error.message && error.code !== "INTERNAL_ERROR") return error.message;
  return t("errors.server");
}
