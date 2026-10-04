/**
 * F75 — spotting requests that talk about the same problem.
 *
 * Open requests are compared on their subject, message, kind of problem and
 * district with the local text embedding (no network needed), then gathered
 * into groups of similar requests. Each group gets a short title: from the AI
 * model when it is available (with a short timeout), otherwise from the words
 * its requests share. The result is cached for a minute and never blocks the
 * list: without the model, grouping still works.
 */

import { isStaff } from "@/lib/auth/guards";
import { decryptField } from "@/lib/crypto/field-encryption";
import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { cosine, localEmbedding, tokenize } from "@/lib/ai/vectors";
import { complete, isAiConfigured } from "@/lib/ai/provider";
import type { AuthUser } from "@/types";

/** Two requests this close read as the same problem. */
const THRESHOLD = 0.5;
const MAX_REQUESTS = 300;
const CACHE_MS = 60_000;

export interface SimilarGroupDto {
  /** Stable for a given set of requests; used as the React key. */
  readonly id: string;
  readonly title: string;
  readonly count: number;
  /** How many of them still need an agent's action. */
  readonly needAction: number;
  readonly oldestAt: string;
  readonly references: string[];
}

interface Item {
  readonly reference: string;
  readonly subject: string;
  readonly needsAction: boolean;
  readonly createdAt: Date;
  readonly vector: Float32Array;
  readonly tokens: string[];
}

async function loadItems(): Promise<Item[]> {
  const rows = await prisma.cityRequest.findMany({
    where: { status: { in: ["NEW", "IN_PROGRESS", "WAITING_CITIZEN"] } },
    orderBy: { createdAt: "desc" },
    take: MAX_REQUESTS,
    select: { reference: true, subject: true, message: true, issueType: true, zone: true, status: true, createdAt: true },
  });
  return rows.map((row) => {
    const text = `${row.subject} ${row.subject} ${decryptField(row.message)} ${row.issueType ?? ""} ${row.zone ?? ""}`;
    return { reference: row.reference, subject: row.subject, needsAction: row.status === "NEW", createdAt: row.createdAt, vector: localEmbedding(text), tokens: tokenize(row.subject) };
  });
}

/** The words that most of a group's subjects share, as a plain title. */
function keywordTitle(items: readonly Item[]): string {
  const counts = new Map<string, number>();
  for (const item of items) for (const token of new Set(item.tokens)) counts.set(token, (counts.get(token) ?? 0) + 1);
  const top = [...counts.entries()].filter(([, n]) => n >= Math.max(2, Math.ceil(items.length / 2))).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([token]) => token);
  const title = top.join(" · ");
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : (items[0]?.subject ?? "—");
}

const titles = new Map<string, string>();

async function aiTitle(key: string, items: readonly Item[]): Promise<string | null> {
  const cached = titles.get(key);
  if (cached) return cached;
  if (!isAiConfigured()) return null;
  try {
    const result = await Promise.race([
      complete({
        messages: [
          { role: "system", content: "You name a group of similar city requests in French, in at most six words, without quotes or punctuation. Reply with the title only." },
          { role: "user", content: `<user_content>\n${items.slice(0, 6).map((item) => `- ${item.subject}`).join("\n")}\n</user_content>` },
        ],
        maxTokens: 24,
        temperature: 0.2,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4_000)),
    ]);
    const text = result?.text.replace(/["«»\n]/g, "").trim();
    if (text && text.length <= 80) {
      titles.set(key, text);
      return text;
    }
  } catch (error) {
    logger.warn("group title by the model failed", { error });
  }
  return null;
}

export function clusterItems<T extends { vector: Float32Array }>(items: readonly T[], threshold = THRESHOLD): T[][] {
  const groups: { members: T[]; centre: Float32Array }[] = [];
  for (const item of items) {
    let best: { group: (typeof groups)[number]; score: number } | null = null;
    for (const group of groups) {
      const score = cosine(item.vector, group.centre);
      if (score >= threshold && (!best || score > best.score)) best = { group, score };
    }
    if (best) {
      best.group.members.push(item);
      // The centre follows the members, so a group does not drift on its first request alone.
      const sum = new Float32Array(best.group.centre.length);
      for (const member of best.group.members) for (let i = 0; i < sum.length; i += 1) sum[i] = (sum[i] ?? 0) + (member.vector[i] ?? 0);
      let norm = 0;
      for (const value of sum) norm += value * value;
      norm = Math.sqrt(norm) || 1;
      best.group.centre = sum.map((value) => value / norm);
    } else {
      groups.push({ members: [item], centre: item.vector });
    }
  }
  return groups.map((group) => group.members);
}

let cache: { at: number; groups: SimilarGroupDto[] } | null = null;

/** Groups of two or more similar open requests, the biggest first. */
export async function listSimilarGroups(actor: AuthUser): Promise<SimilarGroupDto[]> {
  if (!isStaff(actor)) throw new ForbiddenError("Only city agents can see grouped requests.");
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.groups;
  const items = await loadItems();
  const clusters = clusterItems(items).filter((members) => members.length >= 2).sort((a, b) => b.length - a.length).slice(0, 12);
  const groups = await Promise.all(
    clusters.map(async (members) => {
      const references = members.map((member) => member.reference).sort();
      const id = references.slice(0, 3).join("+");
      const title = (await aiTitle(id, members)) ?? keywordTitle(members);
      return {
        id,
        title,
        count: members.length,
        needAction: members.filter((member) => member.needsAction).length,
        oldestAt: new Date(Math.min(...members.map((member) => member.createdAt.getTime()))).toISOString(),
        references,
      };
    }),
  );
  cache = { at: Date.now(), groups };
  return groups;
}

/** The open requests that read like this one, for the agent looking at it. */
export async function similarTo(reference: string, actor: AuthUser): Promise<{ reference: string; subject: string; status: string }[]> {
  if (!isStaff(actor)) throw new NotFoundError("This request does not exist.");
  const items = await loadItems();
  const self = items.find((item) => item.reference === reference);
  if (!self) {
    // Closed requests are not in the open set: compare against it all the same.
    const row = await prisma.cityRequest.findUnique({ where: { reference }, select: { subject: true, message: true, issueType: true, zone: true } });
    if (!row) throw new NotFoundError("This request does not exist.");
    const vector = localEmbedding(`${row.subject} ${row.subject} ${decryptField(row.message)} ${row.issueType ?? ""} ${row.zone ?? ""}`);
    return rank(items, vector, reference);
  }
  return rank(items, self.vector, reference);
}

async function rank(items: readonly Item[], vector: Float32Array, reference: string) {
  const near = items.filter((item) => item.reference !== reference).map((item) => ({ item, score: cosine(vector, item.vector) })).filter((entry) => entry.score >= THRESHOLD).sort((a, b) => b.score - a.score).slice(0, 5);
  if (near.length === 0) return [];
  const rows = await prisma.cityRequest.findMany({ where: { reference: { in: near.map((entry) => entry.item.reference) } }, select: { reference: true, subject: true, status: true } });
  return near.flatMap((entry) => rows.filter((row) => row.reference === entry.item.reference));
}
