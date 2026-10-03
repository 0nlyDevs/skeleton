"use client";

import { useEffect, useState } from "react";
import { BusFront, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api/client";
import type { TransportLineDto } from "@/modules/transports/transports.service";

type FormValue = Omit<TransportLineDto, "id" | "updatedAt">;
const blank: FormValue = { code: "", name: "", description: "", stops: ["", ""], firstDeparture: "06:00", lastDeparture: "22:00", headwayMinutes: 15, serviceDays: "Tous les jours", alert: "", published: false };

export function TransportLinesManager() {
  const t = useTranslation();
  const [rows, setRows] = useState<TransportLineDto[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<FormValue>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    try {
      const response = await apiFetch<{ data: TransportLineDto[] }>("/api/transport-lines");
      setRows(response.data);
    } catch { toast.error(t("feedback.error.body")); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let active = true;
    apiFetch<{ data: TransportLineDto[] }>("/api/transport-lines")
      .then((response) => { if (active) setRows(response.data); })
      .catch(() => { if (active) toast.error(t("feedback.error.body")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [t]);

  const startNew = () => { setSelected(null); setForm({ ...blank, stops: ["", ""] }); };
  const edit = (line: TransportLineDto) => {
    setSelected(line.id);
    setForm({ code: line.code, name: line.name, description: line.description ?? "", stops: line.stops, firstDeparture: line.firstDeparture, lastDeparture: line.lastDeparture, headwayMinutes: line.headwayMinutes, serviceDays: line.serviceDays, alert: line.alert ?? "", published: line.published });
  };
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true);
    try {
      const body = { ...form, stops: form.stops.map((stop) => stop.trim()).filter(Boolean), headwayMinutes: Number(form.headwayMinutes), description: form.description || null, alert: form.alert || null };
      if (selected) await apiFetch(`/api/transport-lines/${selected}`, { method: "PATCH", body });
      else await apiFetch("/api/transport-lines", { method: "POST", body });
      toast.success(t("tn.agent.transports.saved")); await reload(); startNew();
    } catch (error) { toast.error(error instanceof Error ? error.message : t("feedback.error.body")); }
    finally { setSaving(false); }
  };
  const remove = async (line: TransportLineDto) => {
    if (!window.confirm(t("tn.agent.transports.delete_confirm", { name: line.name }))) return;
    try { await apiFetch(`/api/transport-lines/${line.id}`, { method: "DELETE" }); toast.success(t("tn.agent.transports.deleted")); if (selected === line.id) startNew(); await reload(); }
    catch (error) { toast.error(error instanceof Error ? error.message : t("feedback.error.body")); }
  };

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]">
    <section className="flex flex-col gap-3" aria-labelledby="transport-lines-list">
      <div className="flex items-center justify-between"><h2 id="transport-lines-list" className="font-semibold">{t("tn.agent.transports.lines")}</h2><Button size="sm" onClick={startNew}><Plus aria-hidden />{t("tn.agent.transports.new")}</Button></div>
      {loading ? <p className="p-6 text-sm text-muted-foreground">{t("common.loading")}</p> : rows.length ? rows.map((line) => <Card key={line.id}><CardContent className="flex items-start gap-3 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-sm font-bold text-accent-foreground"><BusFront className="size-4" aria-hidden /></span><button type="button" className="min-w-0 flex-1 text-left" onClick={() => edit(line)}><span className="flex flex-wrap items-center gap-2 font-semibold">{line.code} · {line.name}<Badge variant={line.published ? "success" : "warning"}>{line.published ? t("tn.agent.transports.published") : t("tn.agent.transports.draft")}</Badge></span><span className="mt-1 block text-sm text-muted-foreground">{line.stops.join(" → ")}</span><span className="mt-1 block text-xs text-muted-foreground">{line.firstDeparture}–{line.lastDeparture} · {t("tn.transports.frequency_interval", { min: line.headwayMinutes })}</span></button><Button variant="ghost" size="icon" aria-label={t("tn.agent.transports.delete")} onClick={() => void remove(line)}><Trash2 className="size-4 text-error" aria-hidden /></Button></CardContent></Card>) : <Card><CardContent className="p-6 text-sm text-muted-foreground">{t("tn.agent.transports.empty")}</CardContent></Card>}
    </section>

    <Card className="h-fit"><CardHeader><CardTitle>{selected ? t("tn.agent.transports.edit") : t("tn.agent.transports.create")}</CardTitle></CardHeader><CardContent><form onSubmit={(event) => void save(event)} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3"><Field label={t("tn.agent.transports.code")}><Input required maxLength={20} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="D" /></Field><Field label={t("tn.agent.transports.name")}><Input required maxLength={140} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field></div>
      <Field label={t("tn.agent.transports.description")}><Input maxLength={500} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <Field label={t("tn.agent.transports.stops_hint")}><Textarea required rows={5} value={form.stops.join("\n")} onChange={(e) => setForm({ ...form, stops: e.target.value.split("\n") })} /><span className="text-xs text-muted-foreground">{t("tn.agent.transports.stops_help")}</span></Field>
      <div className="grid grid-cols-2 gap-3"><Field label={t("tn.agent.transports.first")}><Input type="time" required value={form.firstDeparture} onChange={(e) => setForm({ ...form, firstDeparture: e.target.value })} /></Field><Field label={t("tn.agent.transports.last")}><Input type="time" required value={form.lastDeparture} onChange={(e) => setForm({ ...form, lastDeparture: e.target.value })} /></Field></div>
      <div className="grid grid-cols-2 gap-3"><Field label={t("tn.agent.transports.headway")}><Input type="number" min={1} max={180} required value={form.headwayMinutes} onChange={(e) => setForm({ ...form, headwayMinutes: Number(e.target.value) })} /></Field><Field label={t("tn.agent.transports.days")}><Input required maxLength={120} value={form.serviceDays} onChange={(e) => setForm({ ...form, serviceDays: e.target.value })} /></Field></div>
      <Field label={t("tn.agent.transports.alert")}><Input maxLength={500} value={form.alert ?? ""} onChange={(e) => setForm({ ...form, alert: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="accent-[var(--primary)]" />{t("tn.agent.transports.publish")}</label>
      <div className="flex justify-end gap-2">{selected ? <Button type="button" variant="ghost" onClick={startNew}>{t("common.cancel")}</Button> : null}<Button type="submit" disabled={saving}>{saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}{t("tn.agent.transports.save")}</Button></div>
    </form></CardContent></Card>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium">{label}{children}</label>; }
