import type { Metadata } from "next";

import { PrintButton } from "@/components/city/print-button";
import { NotFoundPanel } from "@/components/feedback/not-found-panel";
import { BubbleMark } from "@/components/layout/bubble-logo";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import Link from "@/components/ui/link";
import { requirePageAuth } from "@/lib/auth/page-guards";
import { NotFoundError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { getServerDictionary } from "@/lib/i18n/server";
import { cityRequestRefParamSchema } from "@/modules/city-requests/city-requests.schema";
import { getCityRequest } from "@/modules/city-requests/city-requests.service";

export const metadata: Metadata = { title: "Accusé de réception" };

/**
 * F83 — the receipt of a request: who received what and when, with a
 * reference and a check code. It prints on one page, and anyone the resident
 * shows it to can check the code on /receipt.
 */
export default async function ReceiptPage({ params }: { readonly params: Promise<{ reference: string }> }) {
  const raw = await params;
  const { user } = await requirePageAuth(`/space/requests/${encodeURIComponent(raw.reference)}/receipt`);
  const parsed = cityRequestRefParamSchema.safeParse(raw);
  const request = parsed.success
    ? await getCityRequest(parsed.data.reference, user).catch((error: unknown) => {
        if (error instanceof NotFoundError) return null;
        throw error;
      })
    : null;
  if (!request || !request.receiptCode) return <NotFoundPanel backHref="/space" />;
  const { t, locale } = await getServerDictionary();

  const rows = [
    { label: t("tn.receipt.reference"), value: request.reference, mono: true },
    { label: t("tn.receipt.code"), value: request.receiptCode, mono: true },
    { label: t("tn.receipt.received"), value: formatDateTime(request.createdAt, locale) },
    { label: t("tn.receipt.subject"), value: request.subject },
    { label: t("tn.receipt.service"), value: request.service?.name ?? t("tn.no_service") },
    { label: t("tn.receipt.sender"), value: user.name },
  ];

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Breadcrumbs
          label={t("tn.breadcrumb.label")}
          items={[{ label: t("tn.nav.my_space"), href: "/space" }, { label: request.reference, href: `/space/requests/${request.reference}` }, { label: t("tn.receipt.title") }]}
        />
        <PrintButton label={t("tn.receipt.print")} />
      </div>

      <article className="print-document flex flex-col gap-5 rounded-2xl border border-border/70 bg-card p-6 shadow-panel">
        <header className="flex items-center gap-3">
          <BubbleMark className="h-10" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{t("tn.receipt.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("tn.receipt.issuer")}</p>
          </div>
        </header>
        <p className="text-[0.9375rem]">{t("tn.receipt.statement")}</p>
        <dl className="flex flex-col divide-y divide-border/70">
          {rows.map((row) => (
            <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
              <dt className="text-[0.8125rem] text-muted-foreground">{row.label}</dt>
              <dd className={row.mono ? "font-mono font-semibold" : "font-medium"}>{row.value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[0.8125rem] text-muted-foreground">{t("tn.receipt.how_to_check")}</p>
      </article>

      <p className="text-sm print:hidden">
        <Link href={`/receipt?reference=${request.reference}&code=${request.receiptCode}`} className="font-medium text-primary hover:underline">
          {t("tn.receipt.check_link")}
        </Link>
      </p>
    </div>
  );
}
