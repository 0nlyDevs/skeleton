"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EXPORT_DATASETS, type ExportDataset } from "@/modules/exports/exports.schema";

import { SELECT_CLASS } from "./form-field";

const DATASETS = Object.keys(EXPORT_DATASETS) as ExportDataset[];

/**
 * F88 — pick what to send to another service: a dataset, the useful columns,
 * a period, a format. The file holds follow-up data only, never a name or a
 * message.
 */
export function ExportBuilder() {
  const t = useTranslation();
  const [dataset, setDataset] = useState<ExportDataset>("requests");
  const [fields, setFields] = useState<readonly string[]>(EXPORT_DATASETS.requests);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [format, setFormat] = useState<"csv" | "json">("csv");

  const choose = (next: ExportDataset) => {
    setDataset(next);
    setFields(EXPORT_DATASETS[next]);
  };
  const toggle = (field: string) => setFields((current) => (current.includes(field) ? current.filter((item) => item !== field) : [...current, field]));

  // Columns keep the dataset's order, whatever the order of the clicks.
  const ordered = EXPORT_DATASETS[dataset].filter((field) => fields.includes(field));
  const params = new URLSearchParams({ dataset, fields: ordered.join(","), format });
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-border/70 bg-card p-5 shadow-panel">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-dataset">{t("tn.export.dataset")}</Label>
          <select id="export-dataset" value={dataset} onChange={(event) => choose(event.target.value as ExportDataset)} className={SELECT_CLASS}>
            {DATASETS.map((item) => (
              <option key={item} value={item}>{t(`tn.export.dataset.${item}` as MessageKey)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-format">{t("tn.export.format")}</Label>
          <select id="export-format" value={format} onChange={(event) => setFormat(event.target.value as "csv" | "json")} className={SELECT_CLASS}>
            <option value="csv">{t("tn.export.format.csv")}</option>
            <option value="json">{t("tn.export.format.json")}</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-from">{t("tn.export.from")}</Label>
          <Input id="export-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-to">{t("tn.export.to")}</Label>
          <Input id="export-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("tn.export.columns")}</legend>
        <div className="flex flex-wrap gap-1.5">
          {EXPORT_DATASETS[dataset].map((field) => {
            const on = fields.includes(field);
            return (
              <button
                key={field}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(field)}
                className={cn("rounded-full px-3 py-1.5 text-[0.8125rem] font-medium", on ? "bg-foreground text-background" : "border border-border bg-surface hover:bg-surface-muted")}
              >
                {t(`tn.export.field.${field}` as MessageKey)}
              </button>
            );
          })}
        </div>
        <p className="text-[0.8125rem] text-muted-foreground">{t("tn.export.privacy")}</p>
      </fieldset>

      {ordered.length === 0 ? (
        <p role="alert" className="text-sm text-error">{t("tn.export.none")}</p>
      ) : (
        <Button asChild className="self-start">
          <a href={`/api/exports?${params.toString()}`} download>
            <Download aria-hidden />
            {t("tn.export.download")}
          </a>
        </Button>
      )}
    </div>
  );
}
