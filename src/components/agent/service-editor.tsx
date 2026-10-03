"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ServiceIcon } from "@/components/city/service-icon";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { ServiceDto } from "@/modules/city-services/city-services.service";
import { SERVICE_ICONS } from "@/modules/city-services/city-services.schema";

import { FormField, SELECT_CLASS } from "./form-field";

type TextKey = "name" | "category" | "summary" | "description" | "howTo" | "email" | "phone" | "hours" | "address";

/** Admin form for one municipal service. */
export function ServiceEditor({ initial }: { readonly initial: ServiceDto | null }) {
  const t = useTranslation();
  const router = useRouter();
  const [values, setValues] = useState<Record<TextKey, string>>({
    name: initial?.name ?? "",
    category: initial?.category ?? "",
    summary: initial?.summary ?? "",
    description: initial?.description ?? "",
    howTo: initial?.howTo ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    hours: initial?.hours ?? "",
    address: initial?.address ?? "",
  });
  const [icon, setIcon] = useState(initial?.icon ?? "building");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [active, setActive] = useState(initial?.active ?? true);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (key: TextKey) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFields({});
    try {
      const response = await apiFetch<{ data: ServiceDto }>(initial ? `/api/city-services/${initial.slug}` : "/api/city-services", {
        method: initial ? "PUT" : "POST",
        body: { ...values, icon, sortOrder, active, latitude: initial?.latitude ?? null, longitude: initial?.longitude ?? null },
      });
      toast.success(t("tn.agent.services.saved"));
      router.push(`/services/${response.data.slug}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) setFields(error.fields);
      toast.error(describeApiError(error, t));
      setBusy(false);
    }
  };

  const text = (key: TextKey, label: string, max: number) => (
    <FormField id={`service-${key}`} label={label} error={fields[key]}>
      <Input id={`service-${key}`} value={values[key]} onChange={set(key)} maxLength={max} />
    </FormField>
  );

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-panel" noValidate>
      <h1 className="text-lg font-semibold">{initial ? t("tn.agent.services.edit") : t("tn.agent.services.new")}</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {text("name", t("tn.agent.services.form.name"), 120)}
        {text("category", t("tn.agent.services.form.category"), 60)}
      </div>
      {text("summary", t("tn.agent.services.form.summary"), 240)}
      <FormField id="service-description" label={t("tn.agent.services.form.description")} error={fields.description}>
        <Textarea id="service-description" value={values.description} onChange={set("description")} rows={5} maxLength={5000} />
      </FormField>
      <FormField id="service-howTo" label={t("tn.agent.services.form.how_to")} error={fields.howTo}>
        <Textarea id="service-howTo" value={values.howTo} onChange={set("howTo")} rows={4} maxLength={4000} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        {text("email", t("tn.agent.services.form.email"), 160)}
        {text("phone", t("tn.agent.services.form.phone"), 40)}
        {text("hours", t("tn.agent.services.form.hours"), 160)}
        {text("address", t("tn.agent.services.form.address"), 200)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="service-icon" label={t("tn.agent.services.form.icon")}>
          <div className="flex items-center gap-2">
            <ServiceIcon name={icon} />
            <select id="service-icon" value={icon} onChange={(event) => setIcon(event.target.value)} className={SELECT_CLASS}>
              {SERVICE_ICONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </div>
        </FormField>
        <FormField id="service-order" label={t("tn.agent.services.form.order")}>
          <Input id="service-order" type="number" min={0} max={1000} value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value) || 0)} />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={active} onCheckedChange={setActive} />
        {t("tn.agent.services.form.active")}
      </label>
      <Button type="submit" disabled={busy} className="self-end">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {t("common.save")}
      </Button>
    </form>
  );
}
