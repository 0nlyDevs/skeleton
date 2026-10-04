/**
 * The API route wrapper.
 *
 * This is where "deny by default" is actually implemented. Every route built
 * with `apiRoute` gets, in order:
 *
 *   1. a correlation id and a child logger,
 *   2. a process-local burst limit (cheap, always on),
 *   3. an origin check on state-changing requests (CSRF),
 *   4. session resolution, and a 401 unless explicitly public,
 *   5. role enforcement,
 *   6. an optional durable rate limit,
 *   7. Zod validation of params, query and body,
 *   8. the handler, then structured logging of status and duration,
 *
 * and every thrown value is mapped onto the JSON error contract with the right
 * status code. A route cannot forget any of it, because a route is not a
 * function — it is a configuration object.
 */

import type { NextRequest } from "next/server";
import type { z } from "zod";

import { getAuthContext } from "@/lib/auth/session";
import { roleIn } from "@/lib/auth/roles";
import {
  ForbiddenError,
  RateLimitedError,
  UnauthenticatedError,
  ServiceUnavailableError,
} from "@/lib/errors";
import { enterRequest } from "@/lib/load/monitor";
import { assertTrustedOrigin } from "@/lib/http/origin";
import { resolveClientIp, UNKNOWN_IP } from "@/lib/http/client-ip";
import { env } from "@/lib/env";
import { logger, newRequestId, type Logger } from "@/lib/logger";
import {
  RATE_LIMITS,
  consumeBurstLimit,
  enforceThenRecord,
  rateLimitKey,
  type RateLimitRule,
} from "@/lib/rate-limit";
import { parseJsonBody, parseOrThrow, searchParamsToObject } from "@/lib/validate";
import type { AuthContext, Role } from "@/types";

import { errorResponse, requestLocale } from "./response";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface RouteContext<TBody, TQuery, TParams, TAuth> {
  readonly request: NextRequest;
  /** Non-null unless the route was declared `public`. */
  readonly auth: TAuth;
  readonly params: TParams;
  readonly query: TQuery;
  readonly body: TBody;
  readonly requestId: string;
  readonly log: Logger;
  readonly ip: string;
}

interface SharedRouteOptions {
  /** Restrict to these roles. Implies authentication. */
  readonly roles?: readonly Role[];
  /** Durable rate limit for this specific route. */
  readonly rateLimit?: RateLimitRule;
  /** Namespace for the rate-limit key; defaults to the request path. */
  readonly rateLimitScope?: string;
  /** Opt out of the generic burst limiter (health checks, cron). */
  readonly skipBurstLimit?: boolean;
}

export interface ApiRouteOptions<TBody = undefined, TQuery = undefined, TParams = undefined>
  extends SharedRouteOptions {
  readonly body?: z.ZodType<TBody>;
  readonly query?: z.ZodType<TQuery>;
  readonly params?: z.ZodType<TParams>;
  readonly handler: (
    context: RouteContext<TBody, TQuery, TParams, AuthContext>,
  ) => Promise<Response> | Response;
}

export interface PublicRouteOptions<TBody = undefined, TQuery = undefined, TParams = undefined>
  extends SharedRouteOptions {
  readonly body?: z.ZodType<TBody>;
  readonly query?: z.ZodType<TQuery>;
  readonly params?: z.ZodType<TParams>;
  readonly handler: (
    context: RouteContext<TBody, TQuery, TParams, AuthContext | null>,
  ) => Promise<Response> | Response;
}

/** The shape Next.js 15 passes to a route handler. */
export interface NextRouteArgs {
  readonly params: Promise<Record<string, string>>;
}

export type AppRouteHandler = (
  request: NextRequest,
  args: NextRouteArgs,
) => Promise<Response>;

async function run<TBody, TQuery, TParams>(
  options: ApiRouteOptions<TBody, TQuery, TParams> | PublicRouteOptions<TBody, TQuery, TParams>,
  isPublic: boolean,
  request: NextRequest,
  args: NextRouteArgs,
): Promise<Response> {
  const requestId = newRequestId();
  const startedAt = Date.now();
  const url = new URL(request.url);
  const pathname = url.pathname;

  const log = logger.child({
    requestId,
    method: request.method,
    path: pathname,
  });

  // F77/F78 — under load, what can wait is refused at once so the essential keeps answering.
  const load = await enterRequest(pathname);
  try {
    if (load.shed) {
      throw new ServiceUnavailableError("Many residents are connected right now. This part is paused for a moment; your requests, alerts and services still work. Try again in a minute.");
    }
    const ip = resolveClientIp(request.headers, env.trustProxy);

    if (!options.skipBurstLimit) {
      const burst = await consumeBurstLimit({
        key: rateLimitKey("burst", ip === UNKNOWN_IP ? pathname : ip, pathname),
        rule: RATE_LIMITS.api,
      });
      if (!burst.allowed) {
        throw new RateLimitedError(burst.retryAfterSeconds);
      }
    }

    if (MUTATING_METHODS.has(request.method)) {
      assertTrustedOrigin(request, env.corsAllowedOrigins);
    }

    const auth = await getAuthContext();

    if (!isPublic && !auth) {
      throw new UnauthenticatedError();
    }

    if (auth && options.roles && options.roles.length > 0) {
      if (!roleIn(auth.user.role, options.roles)) {
        log.warn("role check failed", { userId: auth.user.id, role: auth.user.role });
        throw new ForbiddenError("Your account does not have access to this resource.");
      }
    }

    if (options.rateLimit) {
      // Signed-in callers are limited per account; guests on public routes
      // per IP, so an anonymous endpoint is never an unmetered one.
      const scope = options.rateLimitScope ?? pathname;
      const subject = auth ? auth.user.id : `ip:${ip}`;
      await enforceThenRecord([
        { key: rateLimitKey(`route:${scope}`, subject), rule: options.rateLimit },
      ]);
    }

    const rawParams = await args.params;
    const params = options.params
      ? parseOrThrow(options.params, rawParams, "params")
      : (rawParams as TParams);

    const rawQuery = searchParamsToObject(url.searchParams);
    const query = options.query
      ? parseOrThrow(options.query, rawQuery, "query")
      : (rawQuery as TQuery);

    const rawBody = options.body ? await parseJsonBody(request) : undefined;
    const body = options.body
      ? parseOrThrow(options.body, rawBody, "body")
      : (undefined as TBody);

    const response = await options.handler({
      request,
      auth: auth as never,
      params,
      query,
      body,
      requestId,
      log,
      ip,
    });

    log.info("request handled", {
      status: response.status,
      durationMs: Date.now() - startedAt,
      ...(auth ? { userId: auth.user.id } : {}),
    });

    return response;
  } catch (error) {
    const response = errorResponse(error, log, requestId, requestLocale(request));
    if (load.shed) response.headers.set("Retry-After", "60");
    return response;
  } finally {
    load.leave();
  }
}

/** An authenticated route. Unauthenticated callers receive 401. */
export function apiRoute<TBody = undefined, TQuery = undefined, TParams = undefined>(
  options: ApiRouteOptions<TBody, TQuery, TParams>,
): AppRouteHandler {
  return (request, args) => run(options, false, request, args);
}

/** An explicitly public route. Kept separate so the exception is visible. */
export function publicRoute<TBody = undefined, TQuery = undefined, TParams = undefined>(
  options: PublicRouteOptions<TBody, TQuery, TParams>,
): AppRouteHandler {
  return (request, args) => run(options, true, request, args);
}
