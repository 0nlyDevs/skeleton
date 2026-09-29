/**
 * Durable rate-limit store backed by MySQL.
 *
 * Why this exists: cPanel's Node.js app runs several Passenger workers, so an
 * in-memory counter would let an attacker multiply the allowed attempts by the
 * number of processes. This store keeps one row per live key, so the limit is
 * global, and the table size is bounded by the number of distinct keys inside
 * one window rather than by request volume.
 *
 * One row per key also means the hot path is a single indexed upsert.
 */

import { prisma } from "@/lib/db/prisma";

import type { CounterState, RateLimitRule, RateLimitStore } from "./types";

interface BucketRow {
  count: number | bigint;
  expiresAt: Date;
}

export class PrismaRateLimitStore implements RateLimitStore {
  async increment(key: string, rule: RateLimitRule, now: Date): Promise<CounterState> {
    const expiresAt = new Date(now.getTime() + rule.windowMs);

    // Atomic: a new key starts at 1, an expired window restarts at 1, a live
    // window increments. Doing this in one statement avoids the read-modify-
    // write race that two separate queries would introduce.
    await prisma.$executeRaw`
      INSERT INTO \`rateLimitBucket\` (\`key\`, \`count\`, \`expiresAt\`, \`createdAt\`, \`updatedAt\`)
      VALUES (${key}, 1, ${expiresAt}, NOW(3), NOW(3))
      ON DUPLICATE KEY UPDATE
        \`count\` = IF(\`expiresAt\` <= NOW(3), 1, \`count\` + 1),
        \`expiresAt\` = IF(\`expiresAt\` <= NOW(3), ${expiresAt}, \`expiresAt\`),
        \`updatedAt\` = NOW(3)
    `;

    const state = await this.read(key, rule, now);
    return state ?? { count: rule.limit, resetAt: expiresAt };
  }

  async peek(key: string, rule: RateLimitRule, now: Date): Promise<CounterState> {
    const state = await this.read(key, rule, now);
    return state ?? { count: 0, resetAt: new Date(now.getTime() + rule.windowMs) };
  }

  async clear(key: string): Promise<void> {
    await prisma.rateLimitBucket.deleteMany({ where: { key } });
  }

  /**
   * Remove expired rows. Called from the maintenance cron so the table stays
   * flat on a host with a tight disk quota.
   */
  async pruneExpired(now: Date = new Date()): Promise<number> {
    const { count } = await prisma.rateLimitBucket.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    return count;
  }

  private async read(
    key: string,
    _rule: RateLimitRule,
    now: Date,
  ): Promise<CounterState | undefined> {
    const rows = await prisma.$queryRaw<BucketRow[]>`
      SELECT \`count\`, \`expiresAt\`
      FROM \`rateLimitBucket\`
      WHERE \`key\` = ${key}
      LIMIT 1
    `;

    const row = rows[0];
    if (!row) return undefined;
    if (row.expiresAt.getTime() <= now.getTime()) return undefined;

    return { count: Number(row.count), resetAt: row.expiresAt };
  }
}
