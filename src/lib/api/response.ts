/**
 * Response construction.
 *
 * Every API response — success or failure — is built here, which is what makes
 * the error contract a contract rather than a convention. `toErrorPayload`
 * decides the status code; this module decides the headers and the logging.
 */

import { NextResponse } from "next/server";

import { RateLimitedError, toErrorPayload } from "@/lib/errors";
import type { Logger } from "@/lib/logger";

/** Mark a response as per-session and uncacheable. */
const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export function jsonCreated<T>(data: T): NextResponse {
  return jsonOk(data, 201);
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: NO_STORE });
}

/**
 * Serialize a thrown value onto the wire.
 *
 * Unexpected errors are logged with their cause and reported as a generic 500 —
 * stack traces and driver messages never reach the client. Authentication and
 * authorization failures are logged at `warn`, because a spike in either is the
 * signal an intrusion attempt is in progress.
 */
export function errorResponse(error: unknown, log: Logger, requestId: string): NextResponse {
  const { status, payload, isInternal } = toErrorPayload(error);

  const meta = {
    requestId,
    status,
    code: payload.error.code,
    ...(isInternal && error instanceof Error
      ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
      : {}),
  };

  if (isInternal) {
    log.error("unhandled request failure", meta);
  } else if (status === 401 || status === 403) {
    log.warn("request denied", meta);
  } else if (status >= 500) {
    log.error("request failed", meta);
  } else {
    log.info("request rejected", meta);
  }

  const headers: Record<string, string> = { ...NO_STORE };

  if (error instanceof RateLimitedError) {
    headers["Retry-After"] = String(error.retryAfterSeconds);
  }

  return NextResponse.json(payload, { status, headers });
}
