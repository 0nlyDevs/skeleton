/**
 * F87 — "can the important data be saved correctly?" answered by doing it:
 * the important tables are written to one compressed file, the file is read
 * back from disk, and its checksum and row counts are compared. The report
 * says, per table, how many rows were saved and whether the copy matches.
 * Encrypted fields stay encrypted in the copy.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

import { isAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";
import { ForbiddenError } from "@/lib/errors";
import type { AuthUser } from "@/types";

import { auditActions } from "../audit/audit.schema";
import { recordAudit } from "../audit/audit.service";

const DIR = path.resolve(env.UPLOAD_DIR, "..", ".backups");
const KEEP = 5;

export interface BackupTableDto {
  readonly table: string;
  readonly saved: number;
  readonly ok: boolean;
}

export interface BackupReportDto {
  readonly file: string;
  readonly createdAt: string;
  readonly sizeBytes: number;
  readonly checksum: string;
  readonly durationMs: number;
  readonly ok: boolean;
  readonly tables: BackupTableDto[];
}

export interface BackupFileDto {
  readonly file: string;
  readonly createdAt: string;
  readonly sizeBytes: number;
  /** The stored checksum still matches the file on disk. */
  readonly intact: boolean;
}

function assertAdmin(actor: AuthUser): void {
  if (!isAdmin(actor)) throw new ForbiddenError("Only administrators can run a backup.");
}

async function snapshot(): Promise<Record<string, unknown[]>> {
  const [users, services, requests, requestMessages, requestEvents, announcements, appointments, feedback, officialMessages, transportLines] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, username: true, cityZone: true, banned: true, createdAt: true } }),
    prisma.municipalService.findMany(),
    prisma.cityRequest.findMany(),
    prisma.cityRequestMessage.findMany(),
    prisma.cityRequestEvent.findMany(),
    prisma.announcement.findMany(),
    prisma.appointment.findMany(),
    prisma.serviceFeedback.findMany(),
    prisma.officialMessage.findMany(),
    prisma.transportLine.findMany(),
  ]);
  return { users, services, requests, requestMessages, requestEvents, announcements, appointments, feedback, officialMessages, transportLines };
}

export async function runBackup(actor: AuthUser, ip: string | null): Promise<BackupReportDto> {
  assertAdmin(actor);
  const started = Date.now();
  const data = await snapshot();
  const createdAt = new Date();
  const packed = gzipSync(Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), data })));
  const checksum = createHash("sha256").update(packed).digest("hex");
  await mkdir(DIR, { recursive: true });
  const file = `bubble-${createdAt.toISOString().replace(/[:.]/g, "-")}.json.gz`;
  await writeFile(path.join(DIR, file), packed, { mode: 0o600 });
  await writeFile(path.join(DIR, `${file}.sha256`), checksum, { mode: 0o600 });

  // A copy only counts once it has been read back from disk.
  const reread = await readFile(path.join(DIR, file));
  const sameBytes = createHash("sha256").update(reread).digest("hex") === checksum;
  const restored = JSON.parse(gunzipSync(reread).toString("utf8")) as { data: Record<string, unknown[]> };
  const tables = Object.keys(data).map((table) => {
    const saved = restored.data[table]?.length ?? 0;
    return { table, saved, ok: saved === (data[table]?.length ?? -1) };
  });
  const ok = sameBytes && tables.every((table) => table.ok);

  // Keep the last few copies only.
  const old = (await readdir(DIR)).filter((name) => name.endsWith(".json.gz")).sort().reverse().slice(KEEP);
  await Promise.all(old.flatMap((name) => [rm(path.join(DIR, name), { force: true }), rm(path.join(DIR, `${name}.sha256`), { force: true })]));

  const report: BackupReportDto = { file, createdAt: createdAt.toISOString(), sizeBytes: packed.byteLength, checksum, durationMs: Date.now() - started, ok, tables };
  await recordAudit({
    actorId: actor.id,
    action: auditActions.backupVerified,
    targetType: "backup",
    targetId: file.slice(0, 60),
    metadata: { op: ok ? "ok" : "failed", name: file, sizeBytes: report.sizeBytes, rows: tables.reduce((sum, table) => sum + table.saved, 0) },
    ip,
  });
  return report;
}

export async function listBackups(actor: AuthUser): Promise<BackupFileDto[]> {
  assertAdmin(actor);
  const names = await readdir(DIR).catch(() => [] as string[]);
  const files = names.filter((name) => name.endsWith(".json.gz")).sort().reverse();
  return Promise.all(
    files.map(async (file) => {
      const full = path.join(DIR, file);
      const [info, bytes, expected] = await Promise.all([stat(full), readFile(full), readFile(`${full}.sha256`, "utf8").catch(() => "")]);
      return { file, createdAt: info.mtime.toISOString(), sizeBytes: info.size, intact: createHash("sha256").update(bytes).digest("hex") === expected.trim() };
    }),
  );
}
