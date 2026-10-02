/**
 * One-off backfill: encrypt private fields written before encryption at rest
 * existed. Idempotent (already-encrypted values are skipped) and batched.
 *
 *   npm run security:encrypt-at-rest
 */

import { encryptField, isEncrypted } from "../src/lib/crypto/field-encryption";
import { prisma } from "../src/lib/db/prisma";
import { formatBirthDate } from "../src/lib/validation/profile";

const BATCH = 500;

async function messages(): Promise<number> {
  let done = 0;
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.message.findMany({
      where: { NOT: { content: { startsWith: "enc:v1:" } }, content: { not: "" } },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, content: true },
    });
    if (rows.length === 0) return done;
    for (const row of rows) {
      if (isEncrypted(row.content)) continue;
      await prisma.message.update({ where: { id: row.id }, data: { content: encryptField(row.content) } });
      done += 1;
    }
    cursor = rows[rows.length - 1]?.id;
  }
}

async function notifications(): Promise<number> {
  const rows = await prisma.notification.findMany({
    where: { body: { not: null }, NOT: { body: { startsWith: "enc:v1:" } } },
    select: { id: true, body: true },
  });
  for (const row of rows) {
    if (row.body) await prisma.notification.update({ where: { id: row.id }, data: { body: encryptField(row.body) } });
  }
  return rows.length;
}

async function birthDates(): Promise<number> {
  const rows = await prisma.user.findMany({ where: { birthDate: { not: null } }, select: { id: true, birthDate: true } });
  for (const row of rows) {
    await prisma.user.update({
      where: { id: row.id },
      data: { birthDateEncrypted: encryptField(formatBirthDate(row.birthDate) ?? ""), birthDate: null },
    });
  }
  return rows.length;
}

async function main(): Promise<void> {
  console.log(`messages encrypted: ${await messages()}`);
  console.log(`notification bodies encrypted: ${await notifications()}`);
  console.log(`birth dates encrypted: ${await birthDates()}`);
  await prisma.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
