/**
 * Client for the official Terra Nova API (24H by Webcup).
 *
 * The key stays on the server (header `X-Webcup-Api-Key`). Every field is
 * read defensively: unknown fields are kept in `raw`, missing ones default,
 * and nothing assumes a number of requests, waves or a fixed schedule.
 */

import { z } from "zod";

import { env } from "@/lib/env";

const intish = z.preprocess((value) => (value === "" || value === null || value === undefined ? undefined : Number(value)), z.number().int().optional());
const boolish = z.preprocess((value) => value === true || value === 1 || value === "1" || value === "true", z.boolean());

export const webcupRequestSchema = z
  .object({
    id: intish,
    request_code: z.string().trim().min(1).max(40),
    requester_name: z.string().max(160).optional().nullable(),
    requester_type: z.string().max(80).optional().nullable(),
    message_public: z.string().max(20_000).default(""),
    difficulty: z.string().max(40).optional().nullable(),
    difficulty_level: intish,
    xp_base: intish,
    xp_time_bonus: intish,
    xp_total: intish,
    xp_available: intish,
    is_initial: boolish.optional(),
    visible_since_wave: intish,
    arrival_type: z.string().max(40).optional().nullable(),
    wave_number: intish,
    arrival_time: z.string().max(20).optional().nullable(),
    group_name: z.string().max(120).optional().nullable(),
    is_ai_related: boolish.optional(),
    is_ai_request: boolish.optional(),
    sort_order: intish,
  })
  .passthrough();

export type WebcupApiRequest = z.infer<typeof webcupRequestSchema>;

export const webcupSessionSchema = z
  .object({
    status: z.string().max(40).default("none"),
    is_running: boolish.optional(),
    current_wave: intish,
    elapsed_minutes: intish,
    visible_requests_count: intish,
    initial_requests_count: intish,
    wave_requests_count: intish,
    next_wave_number: intish,
    minutes_until_next_wave: intish,
  })
  .passthrough();

export type WebcupSession = z.infer<typeof webcupSessionSchema>;

export class WebcupApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

export interface WebcupFetchResult {
  readonly session: WebcupSession;
  readonly requests: WebcupApiRequest[];
  /** Entries that did not validate (kept out, counted for the dashboard). */
  readonly rejected: number;
}

export async function fetchWebcupFeed(): Promise<WebcupFetchResult> {
  if (!env.WEBCUP_API_KEY) throw new WebcupApiError("WEBCUP_API_KEY is not configured.", null);
  let response: Response;
  try {
    response = await fetch(env.WEBCUP_API_URL, {
      headers: { "X-Webcup-Api-Key": env.WEBCUP_API_KEY, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch (error) {
    throw new WebcupApiError(`Network error: ${(error as Error).message}`.slice(0, 280), null);
  }
  if (response.status === 403) throw new WebcupApiError("API key refused (403).", 403);
  if (!response.ok) throw new WebcupApiError(`Unexpected HTTP ${response.status}.`, response.status);

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new WebcupApiError("The API did not return JSON.", response.status);
  }
  const root = (body ?? {}) as { session?: unknown; requests?: unknown };
  const session = webcupSessionSchema.safeParse(root.session ?? {});
  const list = Array.isArray(root.requests) ? root.requests : [];
  const requests: WebcupApiRequest[] = [];
  let rejected = 0;
  for (const entry of list) {
    const parsed = webcupRequestSchema.safeParse(entry);
    if (parsed.success) requests.push(parsed.data);
    else rejected += 1;
  }
  return { session: session.success ? session.data : { status: "unknown" }, requests, rejected };
}
