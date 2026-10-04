import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { getServerDictionary } from "@/lib/i18n/server";
import { checkReceipt } from "@/modules/city-requests/city-requests.receipt";
import { receiptCheckQuerySchema } from "@/modules/city-requests/city-requests.schema";

export const metadata: Metadata = { title: "Vérifier un accusé de réception" };

/**
 * F83 — anyone shown a receipt can check it here with its reference and its
 * code. The answer says only that the city received a request then, never
 * who sent it or what it says.
 */
export default async function ReceiptCheckPage({ searchParams }: { readonly searchParams: Promise<Record<string, string | undefined>> }) {
  const raw = await searchParams;
  const { t, locale } = await getServerDictionary();
  const asked = Boolean(raw.reference || raw.code);
  const parsed = receiptCheckQuerySchema.safeParse(raw);
  const result = parsed.success ? await checkReceipt(parsed.data.reference, parsed.data.code) : null;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-5">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("tn.receipt.check.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("tn.receipt.check.subtitle")}</p>
      </header>

      <form action="/receipt" method="get" className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-panel">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="receipt-reference">{t("tn.receipt.reference")}</Label>
          <Input id="receipt-reference" name="reference" defaultValue={raw.reference ?? ""} placeholder="TN-000000" maxLength={9} required autoComplete="off" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="receipt-code">{t("tn.receipt.code")}</Label>
          <Input id="receipt-code" name="code" defaultValue={raw.code ?? ""} placeholder="AB12-CD34" maxLength={12} required autoComplete="off" />
        </div>
        <Button type="submit" className="self-start">{t("tn.receipt.check.submit")}</Button>
      </form>

      {asked ? (
        result?.valid && result.receivedAt ? (
          <div role="status" className="rounded-2xl border border-success/40 bg-success/10 p-4">
            <p className="font-semibold text-success">{t("tn.receipt.check.valid")}</p>
            <p className="mt-1 text-sm">
              {t("tn.receipt.check.valid_body", { date: formatDateTime(result.receivedAt, locale), service: result.service ?? t("tn.no_service") })}
            </p>
          </div>
        ) : (
          <div role="alert" className="rounded-2xl border border-error/40 bg-error/10 p-4">
            <p className="font-semibold text-error">{t("tn.receipt.check.invalid")}</p>
            <p className="mt-1 text-sm">{t("tn.receipt.check.invalid_body")}</p>
          </div>
        )
      ) : null}
    </div>
  );
}
