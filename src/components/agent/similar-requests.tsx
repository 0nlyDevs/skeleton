"use client";

import { useEffect, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import { apiFetch } from "@/lib/api/client";

/** F75 — on a request, the other open requests that read like it. */
export function SimilarRequests({ reference }: { readonly reference: string }) {
  const t = useTranslation();
  const [items, setItems] = useState<{ reference: string; subject: string }[]>([]);

  useEffect(() => {
    let live = true;
    apiFetch<{ data: { reference: string; subject: string }[] }>(`/api/city-requests/${reference}/similar`)
      .then((response) => live && setItems(response.data))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [reference]);

  if (items.length === 0) return null;
  return (
    <section className="rounded-2xl bg-card p-4 shadow-panel" aria-labelledby="similar-here">
      <h2 id="similar-here" className="mb-2 font-semibold">{t("tn.similar.here")}</h2>
      <ul className="flex flex-col gap-1.5 text-sm">
        {items.map((item) => (
          <li key={item.reference}>
            <Link href={`/agent/requests/${item.reference}`} className="flex gap-2 rounded-xl px-2 py-1.5 hover:bg-surface-muted">
              <span className="font-mono text-[0.75rem] text-muted-foreground">{item.reference}</span>
              <span className="truncate">{item.subject}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
