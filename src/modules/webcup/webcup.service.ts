/**
 * Mirror of the Terra Nova API feed, and its triage by the city team.
 *
 * `syncWebcupFeed` upserts every visible request by `request_code` (stable
 * business key, so refreshes never duplicate), marks requests that left the
 * feed as not visible instead of deleting them, stores the session block and
 * the last error, and tells agents and administrators about new requests.
 */

import { isStaff } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { broadcastTo } from "@/lib/socket/emit";
import { SOCKET_EVENTS } from "@/lib/socket/events";
import { userRoom } from "@/lib/socket/rooms";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";
import { createNotification, notifyInBackground } from "../notifications/notifications.service";
import { WebcupApiError, fetchWebcupFeed, type WebcupApiRequest, type WebcupSession } from "./webcup.client";

const STATE_KEY = "current";

function toRow(request: WebcupApiRequest) {
  return {
    externalId: request.id ?? null,
    requesterName: request.requester_name ?? null,
    requesterType: request.requester_type ?? null,
    message: request.message_public,
    difficulty: request.difficulty ?? null,
    difficultyLevel: request.difficulty_level ?? null,
    // XP values are used exactly as the API provides them.
    xpBase: request.xp_base ?? 0,
    xpTimeBonus: request.xp_time_bonus ?? 0,
    xpTotal: request.xp_total ?? 0,
    xpAvailable: request.xp_available ?? request.xp_total ?? 0,
    isInitial: request.is_initial ?? false,
    wave: request.wave_number ?? request.visible_since_wave ?? null,
    arrivalType: request.arrival_type ?? null,
    arrivalTime: request.arrival_time || null,
    groupName: request.group_name ?? null,
    isAiRelated: Boolean(request.is_ai_related || request.is_ai_request),
    sortOrder: request.sort_order ?? null,
    raw: JSON.parse(JSON.stringify(request)) as object,
  };
}

async function staffIds(): Promise<string[]> {
  const rows = await prisma.user.findMany({ where: { role: { in: ["MODERATOR", "ADMIN"] }, banned: false }, select: { id: true }, take: 200 });
  return rows.map((row) => row.id);
}

export interface SyncResult {
  readonly ok: boolean;
  readonly added: string[];
  readonly visible: number;
  readonly error?: string;
}

let running: Promise<SyncResult> | null = null;

/** One sync at a time per process; concurrent callers share the same run. */
export function syncWebcupFeed(): Promise<SyncResult> {
  running ??= runSync().finally(() => {
    running = null;
  });
  return running;
}

async function runSync(): Promise<SyncResult> {
  const now = new Date();
  try {
    const feed = await fetchWebcupFeed();
    const codes = feed.requests.map((request) => request.request_code);
    const known = new Set(
      (await prisma.webcupRequest.findMany({ where: { code: { in: codes } }, select: { code: true } })).map((row) => row.code),
    );
    for (const request of feed.requests) {
      const data = toRow(request);
      await prisma.webcupRequest.upsert({
        where: { code: request.request_code },
        create: { code: request.request_code, ...data, firstSeenAt: now, lastSeenAt: now, visible: true },
        update: { ...data, lastSeenAt: now, visible: true },
      });
    }
    // Only an active session with an answer can hide requests: an empty or
    // inactive feed never wipes what the team already saw.
    if (feed.session.status === "active" && codes.length > 0) {
      await prisma.webcupRequest.updateMany({ where: { code: { notIn: codes }, visible: true }, data: { visible: false } });
    }
    await prisma.webcupFeedState.upsert({
      where: { key: STATE_KEY },
      create: { key: STATE_KEY, session: feed.session as object, lastFetchAt: now, lastSuccessAt: now, lastError: feed.rejected > 0 ? `${feed.rejected} entrée(s) illisible(s) ignorée(s)` : null },
      update: { session: feed.session as object, lastFetchAt: now, lastSuccessAt: now, lastError: feed.rejected > 0 ? `${feed.rejected} entrée(s) illisible(s) ignorée(s)` : null },
    });

    const added = codes.filter((code) => !known.has(code));
    const firstSync = known.size === 0 && (await prisma.webcupRequest.count()) === added.length;
    if (added.length > 0) {
      const staff = await staffIds();
      for (const id of staff) broadcastTo(userRoom(id)).emit(SOCKET_EVENTS.webcupFeed, { added });
      // The very first import is not "news": no notification storm.
      if (!firstSync) {
        notifyInBackground(
          (async () => {
            for (const id of staff) {
              await createNotification({
                userId: id,
                type: "SYSTEM",
                title: `${added.length} nouvelle(s) demande(s) du Haut Conseil : ${added.slice(0, 5).join(", ")}`,
                link: "/agent/feed",
              });
            }
          })(),
          { webcup: added.join(",") },
        );
      }
    }
    return { ok: true, added, visible: codes.length };
  } catch (error) {
    const message = error instanceof WebcupApiError ? error.message : "Unexpected error while reading the API.";
    if (!(error instanceof WebcupApiError)) logger.warn("webcup sync failed", { error });
    await prisma.webcupFeedState
      .upsert({ where: { key: STATE_KEY }, create: { key: STATE_KEY, lastFetchAt: now, lastError: message }, update: { lastFetchAt: now, lastError: message } })
      .catch(() => undefined);
    return { ok: false, added: [], visible: 0, error: message };
  }
}

export interface WebcupRequestDto {
  readonly code: string;
  readonly requesterName: string | null;
  readonly requesterType: string | null;
  readonly message: string;
  readonly difficulty: string | null;
  readonly difficultyLevel: number | null;
  readonly xpBase: number;
  readonly xpTimeBonus: number;
  readonly xpTotal: number;
  readonly xpAvailable: number;
  readonly isInitial: boolean;
  readonly wave: number | null;
  readonly arrivalTime: string | null;
  readonly groupName: string | null;
  readonly isAiRelated: boolean;
  readonly visible: boolean;
  readonly triage: string;
  readonly note: string | null;
  readonly firstSeenAt: string;
}

export interface WebcupFeedDto {
  readonly session: WebcupSession | null;
  readonly lastFetchAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastError: string | null;
  readonly configured: boolean;
  readonly requests: WebcupRequestDto[];
  readonly totals: { readonly xpVisible: number; readonly xpDone: number; readonly count: number; readonly done: number };
}

export async function getWebcupFeed(viewer: AuthUser): Promise<WebcupFeedDto> {
  if (!isStaff(viewer)) throw new ForbiddenError("Only city agents can read the Terra Nova feed.");
  const [state, rows] = await Promise.all([
    prisma.webcupFeedState.findUnique({ where: { key: STATE_KEY } }),
    prisma.webcupRequest.findMany({ orderBy: [{ visible: "desc" }, { wave: "asc" }, { sortOrder: "asc" }, { code: "asc" }], take: 500 }),
  ]);
  const requests = rows.map((row) => ({
    code: row.code,
    requesterName: row.requesterName,
    requesterType: row.requesterType,
    message: row.message,
    difficulty: row.difficulty,
    difficultyLevel: row.difficultyLevel,
    xpBase: row.xpBase,
    xpTimeBonus: row.xpTimeBonus,
    xpTotal: row.xpTotal,
    xpAvailable: row.xpAvailable,
    isInitial: row.isInitial,
    wave: row.wave,
    arrivalTime: row.arrivalTime,
    groupName: row.groupName,
    isAiRelated: row.isAiRelated,
    visible: row.visible,
    triage: row.triage,
    note: row.note,
    firstSeenAt: row.firstSeenAt.toISOString(),
  }));
  const visible = requests.filter((request) => request.visible);
  return {
    session: (state?.session as WebcupSession | null) ?? null,
    lastFetchAt: state?.lastFetchAt?.toISOString() ?? null,
    lastSuccessAt: state?.lastSuccessAt?.toISOString() ?? null,
    lastError: state?.lastError ?? null,
    configured: Boolean(env.WEBCUP_API_KEY),
    requests,
    totals: {
      count: visible.length,
      done: visible.filter((request) => request.triage === "DONE").length,
      xpVisible: visible.reduce((sum, request) => sum + request.xpAvailable, 0),
      xpDone: visible.filter((request) => request.triage === "DONE").reduce((sum, request) => sum + request.xpAvailable, 0),
    },
  };
}

export async function triageWebcupRequest(
  code: string,
  input: { triage?: "TODO" | "IN_PROGRESS" | "DONE" | "SKIPPED"; note?: string | null },
  actor: AuthUser,
  ip: string | null,
): Promise<void> {
  if (!isStaff(actor)) throw new ForbiddenError("Only city agents can triage the feed.");
  const row = await prisma.webcupRequest.findUnique({ where: { code } });
  if (!row) throw new NotFoundError("This request does not exist.");
  await prisma.webcupRequest.update({
    where: { code },
    data: { ...(input.triage ? { triage: input.triage } : {}), ...(input.note !== undefined ? { note: input.note } : {}) },
  });
  await recordAudit({ actorId: actor.id, action: auditActions.webcupTriaged, targetType: "webcup_request", targetId: code, metadata: { triage: input.triage ?? null }, ip });
}
