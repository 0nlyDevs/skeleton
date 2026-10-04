/**
 * F80 — how the city ranks its work.
 *
 * A small, pure scorer: given a request and the current time, it proposes a
 * priority and says why. It reads only facts the services already have — how
 * long the request has waited without an agent, how many residents back it,
 * whether the words point to an emergency, and whether the problem itself is
 * about safety or water. It is deliberately explainable: the reasons are shown
 * to the agent, who stays free to keep their own priority.
 */

import { CITY_REQUEST_PRIORITIES, type IssueType } from "./city-requests.schema";

export type CityRequestPriority = (typeof CITY_REQUEST_PRIORITIES)[number];

export type PriorityReason = "waiting" | "supports" | "urgent" | "safety";

export interface PrioritySuggestion {
  readonly priority: CityRequestPriority;
  readonly score: number;
  readonly reasons: readonly PriorityReason[];
}

export interface PriorityInput {
  readonly createdAt: Date | string;
  readonly assigneeId: string | null;
  readonly issueType: string | null;
  readonly supportCount?: number;
  readonly subject: string;
}

/** Words that signal something is happening now, not a routine question. */
const URGENT_WORDS = [
  "urgent", "urgence", "danger", "dangereux", "incendie", "feu", "fuite",
  "inondation", "noyade", "coupure", "panne", "accident", "menace", "effondrement", "electrocut",
];

/** Problems whose very nature is safety-relevant. */
const SAFETY_ISSUES = new Set(["safety", "water"]);

const HOUR_MS = 3_600_000;

function toMillis(value: Date | string): number {
  return typeof value === "string" ? Date.parse(value) : value.getTime();
}

export function suggestPriority(input: PriorityInput, now: number = Date.now()): PrioritySuggestion {
  const reasons: PriorityReason[] = [];
  let score = 0;

  const ageHours = Math.max(0, (now - toMillis(input.createdAt)) / HOUR_MS);
  if (!input.assigneeId && ageHours >= 24) {
    score += 2;
    reasons.push("waiting");
    if (ageHours >= 72) score += 1;
  }

  const supportCount = input.supportCount ?? 0;
  if (supportCount >= 3) {
    score += 2;
    reasons.push("supports");
    if (supportCount >= 8) score += 1;
  }

  const subject = input.subject.toLocaleLowerCase();
  if (URGENT_WORDS.some((word) => subject.includes(word))) {
    score += 2;
    reasons.push("urgent");
  }

  if (input.issueType && SAFETY_ISSUES.has(input.issueType as IssueType)) {
    score += 3;
    reasons.push("safety");
  }

  const priority: CityRequestPriority = score >= 7 ? "URGENT" : score >= 4 ? "HIGH" : score >= 2 ? "NORMAL" : "LOW";
  return { priority, score, reasons };
}

/** Higher is more urgent; lets a list be sorted by suggestion without recomputing the label. */
export function priorityRank(priority: CityRequestPriority): number {
  return CITY_REQUEST_PRIORITIES.indexOf(priority);
}
