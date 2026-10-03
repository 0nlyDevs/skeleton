import { apiRoute } from "@/lib/api/route";
import { jsonOk } from "@/lib/api/response";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getServerDictionary } from "@/lib/i18n/server";

import { describeActivity } from "./activity.describe";
import { listActivityQuerySchema } from "./activity.schema";
import { exportActivity, listActivity } from "./activity.service";

/** `GET /api/agent/history` — the agents' history, filtered and paginated. */
export const listActivityRoute = apiRoute({
  roles: STAFF_ROLES,
  query: listActivityQuerySchema,
  handler: async ({ query, auth }) => jsonOk(await listActivity(query, auth.user)),
});

/** A CSV cell: quoted, with formula injection neutralised for spreadsheets. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** `GET /api/agent/history/export` — the same filters as a CSV file, in the reader's language. */
export const exportActivityRoute = apiRoute({
  roles: STAFF_ROLES,
  query: listActivityQuerySchema,
  handler: async ({ query, auth }) => {
    const [{ t, locale }, entries] = await Promise.all([getServerDictionary(), exportActivity(query, auth.user)]);
    const header = [t("tn.history.csv.date"), t("tn.history.csv.actor"), t("tn.history.csv.role"), t("tn.history.csv.category"), t("tn.history.csv.action"), t("tn.history.csv.details")];
    const lines = entries.map((entry) => {
      const { sentence, details } = describeActivity(entry, t, (iso) => formatDateTime(iso, locale));
      return [
        formatDateTime(entry.createdAt, locale),
        entry.actor?.name ?? "",
        entry.actor ? t(`role.${entry.actor.role.toLowerCase()}` as MessageKey) : "",
        t(`tn.history.category.${entry.category}` as MessageKey),
        sentence,
        details.join(" · "),
      ]
        .map(cell)
        .join(",");
    });
    // BOM so spreadsheet software reads the accents correctly.
    const body = `﻿${[header.map(cell).join(","), ...lines].join("\r\n")}\r\n`;
    return new Response(body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="historique-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  },
});
