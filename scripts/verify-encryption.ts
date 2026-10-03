/**
 * Verify that encrypted columns can actually be read with the configured key.
 *
 * Why this exists: `DATA_ENCRYPTION_KEY` is not part of the schema, so a
 * deployment can come up healthy, serve 200s, and return empty strings for
 * every message ever written under a different key. Nothing crashes. The data
 * is simply gone, and the only clue is a log line nobody is watching.
 *
 * This reads a sample of encrypted values and reports how many fail, so the
 * mismatch is caught before the demo rather than during it.
 *
 *   npm run security:verify-encryption
 */

import { decryptField, encryptionHealth, isEncrypted } from "@/lib/crypto/field-encryption";
import { prisma } from "@/lib/db/prisma";

/**
 * Columns that may hold `enc:v1:` values, with the table they belong to.
 *
 * `notification.body` is listed even though nothing writes it encrypted today
 * — no notification is ever passed through `encryptField`. It is here because the
 * read path calls `decryptNullable`, so an *older* build that did encrypt them
 * would leave rows that break silently under the current key. Reporting "no
 * encrypted rows" is the healthy answer; this probe exists so that a future
 * build which starts encrypting cannot forget to check.
 */
const PROBES = [
  { table: "message", column: "content" },
  { table: "notification", column: "body" },
  { table: "user", column: "birthDateEncrypted" },
] as const;

const SAMPLE = 50;

async function main(): Promise<number> {
  const health = encryptionHealth();
  console.log(`Key source: ${health.keySource}`);

  if (health.keySource === "BETTER_AUTH_SECRET") {
    console.warn(
      "  DATA_ENCRYPTION_KEY is unset, so the key is derived from BETTER_AUTH_SECRET.\n" +
        "  Rotating BETTER_AUTH_SECRET for any other reason will orphan every encrypted row.",
    );
  }

  let totalChecked = 0;
  let totalFailed = 0;

  for (const { table, column } of PROBES) {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, string>>>(
      `SELECT \`${column}\` AS value FROM \`${table}\` WHERE \`${column}\` LIKE 'enc:v1:%' LIMIT ${SAMPLE}`,
    ).catch(() => null);

    if (rows === null) {
      console.log(`  ${table}.${column}: table or column not found, skipped`);
      continue;
    }

    if (rows.length === 0) {
      console.log(`  ${table}.${column}: no encrypted rows`);
      continue;
    }

    let failed = 0;
    for (const row of rows) {
      const value = typeof row.value === "string" ? row.value : "";
      if (!isEncrypted(value)) continue;
      totalChecked += 1;
      if (decryptField(value).startsWith("[unreadable")) failed += 1;
    }
    totalFailed += failed;

    const verdict = failed === 0 ? "ok" : "UNREADABLE";
    console.log(`  ${table}.${column}: ${rows.length - failed}/${rows.length} readable — ${verdict}`);
  }

  if (totalChecked === 0) {
    console.log("\nNothing encrypted to check. Nothing to fix.");
    return 0;
  }

  if (totalFailed > 0) {
    console.error(
      `\n${totalFailed}/${totalChecked} sampled values could not be decrypted.\n` +
        "Values written under a different key are unrecoverable — AES-GCM is authenticated,\n" +
        "so there is no way to read them without the original key. Options:\n" +
        "  1. Set DATA_ENCRYPTION_KEY to the value the rows were written with, then re-run.\n" +
        "  2. If that value is gone, re-seed the demo data (npm run db:seed).\n" +
        "Until then, encrypted columns will render the unreadable marker.",
    );
    return 1;
  }

  console.log(`\nAll ${totalChecked} sampled values decrypted correctly.`);
  return 0;
}

main()
  .then((code) => {
    void prisma.$disconnect().finally(() => process.exit(code));
  })
  .catch((error: unknown) => {
    console.error("verification failed:", error);
    process.exit(1);
  });
