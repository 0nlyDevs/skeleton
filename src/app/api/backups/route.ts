import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { listBackups, runBackup } from "@/modules/backups/backups.service";

/** F87 — the copies on disk, each rechecked against its checksum. */
export const GET = apiRoute({
  roles: ["ADMIN"],
  handler: async ({ auth }) => jsonOk({ data: await listBackups(auth.user) }),
});

/** F87 — make a copy now, read it back and report. */
export const POST = apiRoute({
  roles: ["ADMIN"],
  rateLimit: { limit: 6, windowMs: 60 * 60_000 },
  handler: async ({ auth, ip }) => jsonOk({ data: await runBackup(auth.user, ip) }, 201),
});
