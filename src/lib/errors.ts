/**
 * The error contract.
 *
 * Every API failure leaves the server shaped exactly like:
 *
 *   { "error": { "code": "FORBIDDEN", "message": "…", "fields": { … } } }
 *
 * `code` is the machine-readable contract clients localize against; `message`
 * is a developer-facing English sentence and is never a stack trace. Errors
 * that are not `AppError` instances are reported as `INTERNAL_ERROR` and their
 * message is discarded before it reaches the client.
 *
 * This module is intentionally dependency-free so it can be imported from
 * anywhere — routes, services, tests — without dragging in the server runtime.
 */

export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Field-level validation details, keyed by the offending input name. */
export type FieldErrors = Record<string, string>;

export interface ErrorPayload {
  error: {
    code: ErrorCode;
    message: string;
    fields?: FieldErrors;
  };
}

export interface AppErrorOptions {
  message: string;
  cause?: unknown;
  fields?: FieldErrors;
  /**
   * Whether `message` is safe to serialize to the client. Defaults to `true`
   * for operational errors; infrastructure failures should set it to `false`.
   */
  expose?: boolean;
}

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly fields?: FieldErrors;
  readonly expose: boolean;

  constructor(status: number, code: ErrorCode, options: AppErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.fields = options.fields;
    this.expose = options.expose ?? true;
    Error.captureStackTrace?.(this, new.target);
  }

  /** Tag for structured logs; never shown to a user. */
  get logTag(): string {
    return `${this.status} ${this.code}`;
  }
}

export class ValidationError extends AppError {
  constructor(fields: FieldErrors, message = "The submitted data is invalid.") {
    super(400, ErrorCode.VALIDATION_ERROR, { message, fields });
  }
}

export class BadRequestError extends AppError {
  constructor(message = "The request could not be processed.") {
    super(400, ErrorCode.BAD_REQUEST, { message });
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Authentication is required.") {
    super(401, ErrorCode.UNAUTHENTICATED, { message });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You are not allowed to perform this action.") {
    super(403, ErrorCode.FORBIDDEN, { message });
  }
}

/**
 * Deliberately also used for "exists but is not yours". Returning 404 instead of
 * 403 for someone else's resource stops the API from confirming that the
 * resource exists at all — see `modules/posts/posts.service.ts`.
 */
export class NotFoundError extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(404, ErrorCode.NOT_FOUND, { message });
  }
}

export class ConflictError extends AppError {
  constructor(message = "The resource already exists.", fields?: FieldErrors) {
    super(409, ErrorCode.CONFLICT, { message, fields });
  }
}

export class RateLimitedError extends AppError {
  /** Seconds the client should wait before retrying. */
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message = "Too many requests. Please slow down.") {
    super(429, ErrorCode.RATE_LIMITED, { message });
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "The uploaded file is too large.") {
    super(413, ErrorCode.PAYLOAD_TOO_LARGE, { message });
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message = "This file type is not allowed.") {
    super(415, ErrorCode.UNSUPPORTED_MEDIA_TYPE, { message });
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "A downstream service is unavailable. Please try again.") {
    super(503, ErrorCode.SERVICE_UNAVAILABLE, { message });
  }
}

/**
 * Wraps an unexpected failure. The original error is kept as `cause` for the
 * logs, but its message never leaves the process.
 */
export class InternalError extends AppError {
  constructor(cause: unknown, message = "Something went wrong on our side.") {
    super(500, ErrorCode.INTERNAL_ERROR, { message, cause, expose: false });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Maps any thrown value onto the public error contract. Only `expose`d
 * messages survive; everything else collapses to a generic 500.
 */
export function toErrorPayload(error: unknown): {
  status: number;
  payload: ErrorPayload;
  isInternal: boolean;
} {
  if (isAppError(error)) {
    return {
      status: error.status,
      isInternal: false,
      payload: {
        error: {
          code: error.code,
          message: error.expose ? error.message : "Something went wrong on our side.",
          ...(error.fields ? { fields: error.fields } : {}),
        },
      },
    };
  }

  return {
    status: 500,
    isInternal: true,
    payload: {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: "Something went wrong on our side.",
      },
    },
  };
}

/**
 * Narrow a Prisma error to a friendly conflict without leaking query details.
 * `P2002` is a unique-constraint violation, `P2025` a missing record.
 */
export function fromPrismaError(error: unknown, message: string): AppError | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === "P2002") return new ConflictError(message);
  if (code === "P2025") return new NotFoundError();
  return undefined;
}
