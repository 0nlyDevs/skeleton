import { apiRoute } from "@/lib/api/route";
import { formatDateTime } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n";
import { getServerDictionary } from "@/lib/i18n/server";
import { buildRequestSummary } from "@/modules/city-requests/city-requests.summary";
import { z } from "zod";

/** A CSV cell: quoted, with formula injection neutralised for spreadsheets. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** `GET /api/city-requests/summary` — F56: the resident's requests as a CSV, in their language. */
export const GET = apiRoute({
  query: z.object({ filter: z.enum(["all", "open", "done"]).default("all") }),
  handler: async ({ query, auth }) => {
    const [{ t, locale }, summary] = await Promise.all([getServerDictionary(), buildRequestSummary(auth.user, query.filter)]);
    const header = [t("tn.summary.csv.reference"), t("tn.summary.csv.subject"), t("tn.summary.csv.service"), t("tn.summary.csv.status"), t("tn.summary.csv.sent"), t("tn.summary.csv.updated"), t("tn.summary.csv.days"), t("tn.summary.csv.last_reply")];
    const lines = summary.rows.map((row) =>
      [
        row.reference,
        row.subject,
        row.service ?? "",
        t(`tn.status.${row.status}` as MessageKey),
        formatDateTime(row.createdAt, locale),
        formatDateTime(row.updatedAt, locale),
        row.handledInDays === null ? "" : String(row.handledInDays),
        row.lastReply?.body ?? "",
      ]
        .map(cell)
        .join(","),
    );
    const body = `﻿${[header.map(cell).join(","), ...lines].join("\r\n")}\r\n`;
    return new Response(body, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="mes-demandes-${new Date().toISOString().slice(0, 10)}.csv"`,
        "cache-control": "no-store",
      },
    });
  },
});
