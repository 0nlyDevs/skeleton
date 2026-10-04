"use client";

import { UPLOAD_LIMIT_BYTES } from "@/lib/upload-limit";
import type { ApiErrorBody } from "@/types";

/**
 * Browser API client.
 *
 * Every client-side request goes through this function, which is what makes the
 * error contract usable in the UI: a failure arrives as an `ApiRequestError`
 * carrying the `code` the user-facing message is translated from, plus per-field
 * messages ready to drop next to the offending input.
 *
 * `credentials: "same-origin"` is the default for `fetch`, but stating it makes
 * the intent explicit — the session travels in a cookie and nowhere else.
 */

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string>;

  constructor(input: { code: string; message: string; status: number; fields?: Record<string, string> }) {
    super(input.message);
    this.name = "ApiRequestError";
    this.code = input.code;
    this.status = input.status;
    this.fields = input.fields;
  }

  /** True when the caller should prompt the user to sign in. */
  get isAuthError(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }
}

const NETWORK_ERROR_CODE = "NETWORK_ERROR";

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  /** Plain object or `FormData`; plain objects are JSON-encoded. */
  readonly body?: unknown;
  /** Skip JSON parsing for binary responses. */
  readonly raw?: boolean;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, raw, headers, ...rest } = options;

  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  // A file over the limit is refused here, with its real reason: sent anyway, the
  // server would close the connection half-way and the page would say "offline".
  if (isFormData) {
    for (const value of (body as FormData).values()) {
      if (typeof File !== "undefined" && value instanceof File && value.size > UPLOAD_LIMIT_BYTES) {
        throw new ApiRequestError({ code: "PAYLOAD_TOO_LARGE", message: "The file is too large.", status: 413 });
      }
    }
  }

  let response: Response;
  try {
    response = await fetch(path, {
      ...rest,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(body !== undefined && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...(headers as Record<string, string> | undefined),
      },
      body:
        body === undefined
          ? undefined
          : isFormData
            ? (body as FormData)
            : JSON.stringify(body),
    });
  } catch {
    // An upload cut off while the browser still reports being online was refused on the way
    // (a size limit of a proxy, a type): say that, not "no connection".
    if (isFormData && typeof navigator !== "undefined" && navigator.onLine) {
      throw new ApiRequestError({ code: "UPLOAD_FAILED", message: "The upload was refused.", status: 0 });
    }
    // A dead network is not a server error; label it so the UI can say
    // "check your connection" instead of "something went wrong".
    throw new ApiRequestError({
      code: NETWORK_ERROR_CODE,
      message: "The request could not reach the server.",
      status: 0,
    });
  }

  if (response.status === 204 || raw) {
    return undefined as T;
  }

  const text = await response.text();

  if (!response.ok) {
    let payload: ApiErrorBody | undefined;
    try {
      payload = text.length > 0 ? (JSON.parse(text) as ApiErrorBody) : undefined;
    } catch {
      payload = undefined;
    }

    throw new ApiRequestError({
      code: payload?.error.code ?? "INTERNAL_ERROR",
      message: payload?.error.message ?? "Something went wrong on our side.",
      status: response.status,
      ...(payload?.error.fields ? { fields: payload.error.fields } : {}),
    });
  }

  if (text.length === 0) return undefined as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiRequestError({
      code: "INTERNAL_ERROR",
      message: "The server returned an unexpected response.",
      status: response.status,
    });
  }
}

/** Build a query string, dropping empty values. */
export function toQueryString(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query.length > 0 ? `?${query}` : "";
}
