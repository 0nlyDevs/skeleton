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
import type { MessageKey } from "@/lib/i18n";
import type { ServiceDto } from "@/modules/city-services/city-services.service";
import { SERVICE_ICONS, TRANSLATABLE_SERVICE_FIELDS } from "@/modules/city-services/city-services.schema";

import { FormField, SELECT_CLASS } from "./form-field";
import { MapPositionPicker } from "./map-position-picker";

type TextKey = "name" | "category" | "summary" | "description" | "howTo" | "email" | "phone" | "hours" | "address";
type TranslatableKey = (typeof TRANSLATABLE_SERVICE_FIELDS)[number];

const TRANSLATION_LIMITS: Readonly<Record<TranslatableKey, number>> = { name: 120, category: 60, summary: 240, description: 5000, howTo: 4000, hours: 160 };
const TRANSLATION_LABELS: Readonly<Record<TranslatableKey, MessageKey>> = {
  name: "tn.agent.services.form.name",
  category: "tn.agent.services.form.category",
  summary: "tn.agent.services.form.summary",
  description: "tn.agent.services.form.description",
  howTo: "tn.agent.services.form.how_to",
  hours: "tn.agent.services.form.hours",
};

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
  const [featured, setFeatured] = useState(initial?.featured ?? false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(initial?.location ? { x: initial.location.x, y: initial.location.y } : null);
  const [emergency, setEmergency] = useState(initial?.emergency ?? false);
  // F27 — the English copy of each text field; empty means "show the French".
  const [english, setEnglish] = useState<Record<TranslatableKey, string>>(() => {
    const copy = initial?.translations.en ?? {};
    return Object.fromEntries(TRANSLATABLE_SERVICE_FIELDS.map((key) => [key, copy[key] ?? ""])) as Record<TranslatableKey, string>;
  });
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
        body: {
          ...values,
          icon,
          sortOrder,
          active,
          featured,
          emergency,
          mapX: position?.x ?? null,
          mapY: position?.y ?? null,
          translations: { en: english },
          latitude: initial?.latitude ?? null,
          longitude: initial?.longitude ?? null,
        },
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
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={featured} onCheckedChange={setFeatured} />
        {t("tn.agent.services.form.featured")}
      </label>

      <fieldset className="flex flex-col gap-3 rounded-xl border border-border/70 p-4">
        <legend className="px-1 text-sm font-medium">{t("tn.agent.services.form.location")}</legend>
        <p className="text-[0.8125rem] text-muted-foreground">{t("tn.agent.services.form.location_hint")}</p>
        <MapPositionPicker value={position} emergency={emergency} onChange={setPosition} />
        {fields.mapX ? <p className="text-[0.8125rem] text-error">{fields.mapX}</p> : null}
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={emergency} onCheckedChange={setEmergency} />
          {t("tn.agent.services.form.emergency")}
        </label>
      </fieldset>

      <fieldset lang="en" className="flex flex-col gap-4 rounded-xl border border-border/70 p-4">
        <legend className="px-1 font-semibold">{t("tn.agent.services.translation.title")}</legend>
        <p className="-mt-2 text-[0.8125rem] text-muted-foreground">{t("tn.agent.services.translation.hint")}</p>
        {TRANSLATABLE_SERVICE_FIELDS.map((key) => {
          const id = `service-en-${key}`;
          const long = key === "description" || key === "howTo";
          const onChange = (event: { target: { value: string } }) => setEnglish((current) => ({ ...current, [key]: event.target.value }));
          return (
            <FormField key={key} id={id} label={`${t(TRANSLATION_LABELS[key])} (EN)`}>
              {long ? (
                <Textarea id={id} value={english[key]} onChange={onChange} rows={key === "description" ? 5 : 4} maxLength={TRANSLATION_LIMITS[key]} />
              ) : (
                <Input id={id} value={english[key]} onChange={onChange} maxLength={TRANSLATION_LIMITS[key]} />
              )}
            </FormField>
          );
        })}
      </fieldset>
      <Button type="submit" disabled={busy} className="self-end">
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
        {t("common.save")}
      </Button>
    </form>
  );
}
