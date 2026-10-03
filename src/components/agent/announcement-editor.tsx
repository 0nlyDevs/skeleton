"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { CoverPicker } from "@/components/groups/group-options";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import type { MessageKey } from "@/lib/i18n";
import type { AnnouncementDto } from "@/modules/announcements/announcements.service";
import { ANNOUNCEMENT_CATEGORIES } from "@/modules/announcements/announcements.schema";

import { FormField, SELECT_CLASS } from "./form-field";

/** Create or edit an announcement. Publishing notifies every resident. */
export function AnnouncementEditor({
  initial,
  services,
}: {
  readonly initial: AnnouncementDto | null;
  readonly services: readonly { id: string; name: string; slug: string }[];
}) {
  const t = useTranslation();
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [category, setCategory] = useState(initial?.category ?? "ANNOUNCEMENT");
  const [serviceId, setServiceId] = useState(services.find((item) => item.slug === initial?.service?.slug)?.id ?? "");
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [published, setPublished] = useState(initial ? initial.publishedAt !== null : true);
  const [coverImage, setCoverImage] = useState<string | null>(initial?.coverImage ?? null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFields({});
    try {
      const payload = { title, summary, body, category, pinned, published, coverImage, serviceId: serviceId || null };
      const response = await apiFetch<{ data: AnnouncementDto }>(initial ? `/api/announcements/${initial.slug}` : "/api/announcements", {
        method: initial ? "PUT" : "POST",
        body: payload,
      });
      toast.success(t("tn.agent.news.saved"));
      router.push(response.data.publishedAt ? `/announcements/${response.data.slug}` : "/agent/announcements");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) setFields(error.fields);
      toast.error(describeApiError(error, t));
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    setBusy(true);
    try {
      await apiFetch(`/api/announcements/${initial.slug}`, { method: "DELETE" });
      toast.success(t("tn.agent.news.deleted"));
      router.push("/agent/announcements");
      router.refresh();
    } catch (error) {
      toast.error(describeApiError(error, t));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-panel" noValidate>
      <h1 className="text-lg font-semibold">{initial ? t("tn.agent.news.edit") : t("tn.agent.news.new")}</h1>

      <FormField id="news-title" label={t("tn.agent.news.form.title")} error={fields.title}>
        <Input id="news-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required />
      </FormField>
      <FormField id="news-summary" label={t("tn.agent.news.form.summary")} error={fields.summary}>
        <Input id="news-summary" value={summary} onChange={(event) => setSummary(event.target.value)} maxLength={300} required />
      </FormField>
      <FormField id="news-body" label={t("tn.agent.news.form.body")} error={fields.body}>
        <Textarea id="news-body" value={body} onChange={(event) => setBody(event.target.value)} rows={10} maxLength={20000} required />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="news-category" label={t("tn.agent.news.form.category")}>
          <select id="news-category" value={category} onChange={(event) => setCategory(event.target.value)} className={SELECT_CLASS}>
            {ANNOUNCEMENT_CATEGORIES.map((value) => (
              <option key={value} value={value}>{t(`tn.category.${value}` as MessageKey)}</option>
            ))}
          </select>
        </FormField>
        <FormField id="news-service" label={t("tn.agent.news.form.service")}>
          <select id="news-service" value={serviceId} onChange={(event) => setServiceId(event.target.value)} className={SELECT_CLASS}>
            <option value="">{t("tn.no_service")}</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>{service.name}</option>
            ))}
          </select>
        </FormField>
      </div>

      <CoverPicker value={coverImage} onChange={setCoverImage} />

      <div className="flex flex-col gap-2.5">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={pinned} onCheckedChange={setPinned} />
          {t("tn.agent.news.form.pinned")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={published} onCheckedChange={setPublished} />
          {t("tn.agent.news.form.published")}
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {initial ? (
          <Button type="button" variant="ghost" className="text-error" onClick={() => setConfirm(true)} disabled={busy}>
            <Trash2 aria-hidden />
            {t("common.delete")}
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {t("common.save")}
        </Button>
      </div>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t("tn.agent.news.delete_confirm")} busy={busy} onConfirm={() => void remove()} />
    </form>
  );
}
