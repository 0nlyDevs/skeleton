"use client";

import { Layers } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "@/components/providers/i18n-provider";
import Link from "@/components/ui/link";
import { apiFetch } from "@/lib/api/client";
import { formatRelative } from "@/lib/format";
import type { SimilarGroupDto } from "@/modules/city-requests/city-requests.similar";

/**
 * F75 — "Sujets qui reviennent": open requests about the same problem,
 * gathered so an agent can answer them together instead of one by one.
 */
export function SimilarGroups() {
  const { t, locale } = useI18n();
  const [groups, setGroups] = useState<SimilarGroupDto[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    apiFetch<{ data: SimilarGroupDto[] }>("/api/city-requests/groups")
      .then((response) => live && setGroups(response.data))
      .catch(() => live && setGroups([]));
    return () => {
      live = false;
    };
  }, []);

  if (!groups || groups.length === 0) return null;
  return (
    <section aria-labelledby="similar-title" className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-panel">
      <div>
        <h2 id="similar-title" className="flex items-center gap-2 text-lg font-semibold">
          <Layers className="size-[1.125rem]" aria-hidden />
          {t("tn.similar.title")}
        </h2>
        <p className="text-[0.8125rem] text-muted-foreground">{t("tn.similar.subtitle")}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {groups.map((group) => (
          <li key={group.id} className="rounded-2xl bg-surface-muted p-3">
            <button type="button" aria-expanded={open === group.id} onClick={() => setOpen(open === group.id ? null : group.id)} className="flex w-full flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-left">
              <span className="font-semibold">{group.title}</span>
              <span className="text-[0.8125rem] text-muted-foreground">
                {t("tn.similar.count", { count: group.count })}
                {group.needAction > 0 ? ` · ${t("tn.similar.need_action", { count: group.needAction })}` : ""} · {t("tn.similar.oldest", { when: formatRelative(group.oldestAt, locale) })}
              </span>
            </button>
            {open === group.id ? (
              <ul className="mt-2 flex flex-wrap gap-2">
                {group.references.map((reference) => (
                  <li key={reference}>
                    <Link href={`/agent/requests/${reference}`} className="rounded-full bg-card px-3 py-1.5 font-mono text-[0.8125rem] hover:bg-accent">{reference}</Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
