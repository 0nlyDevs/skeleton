/**
 * Profile completion for accounts created through an OAuth provider.
 *
 * Email sign-up collects username and both name parts in the form; a provider
 * only hands over a display name and an email. This fills the gaps before the
 * row is inserted, so the rest of the application can rely on every account
 * having a unique public handle.
 */

import { randomInt } from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import { USERNAME_MAX_LENGTH, usernameViolation } from "@/lib/validation/profile";

type UserDraft = Record<string, unknown> & { email?: unknown; name?: unknown };

function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_")
    .slice(0, USERNAME_MAX_LENGTH - 5);
}

async function isTaken(candidate: string): Promise<boolean> {
  const existing = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
  return existing !== null;
}

/** A free, valid handle derived from the name or email local part. */
export async function generateUsername(seed: string): Promise<string> {
  let base = slugify(seed);
  if (usernameViolation(base) !== null) base = "user";

  if (!(await isTaken(base))) return base;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `${base}_${randomInt(1000, 99999)}`;
    if (usernameViolation(candidate) === null && !(await isTaken(candidate))) return candidate;
  }

  // Practically unreachable; the long random suffix makes a collision negligible.
  return `user_${randomInt(10 ** 8, 10 ** 9)}`;
}

function splitName(name: string): { firstName: string | null; lastName: string | null } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  return {
    firstName: parts[0]?.slice(0, 50) ?? null,
    lastName: parts.length > 1 ? parts.slice(1).join(" ").slice(0, 50) : null,
  };
}

export async function assignMissingProfileFields<T extends UserDraft>(user: T): Promise<T> {
  const next: Record<string, unknown> = { ...user };
  const name = typeof user.name === "string" ? user.name : "";
  const email = typeof user.email === "string" ? user.email : "";

  if (typeof next.username !== "string" || next.username.length === 0) {
    const handle = await generateUsername(name || email.split("@")[0] || "user");
    next.username = handle;
    next.displayUsername = handle;
  }

  if (!next.firstName && !next.lastName && name) {
    Object.assign(next, splitName(name));
  }

  return next as T;
}
