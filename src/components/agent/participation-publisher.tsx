"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { CITY_ZONE_IDS, cityZoneLabelKey } from "@/modules/alerts/city-zones";

import { SELECT_CLASS } from "./form-field";

function Err({ id, text }: { readonly id: string; readonly text?: string | undefined }) {
  return text ? <p id={id} role="alert" className="mt-1 text-[0.8125rem] text-error">{text}</p> : null;
}

/** Local time of a `datetime-local` field, sent with its offset. */
function iso(local: string): string {
  return new Date(local).toISOString();
}

/** F67 + F65 — administrators publish a city project, or put a decision to the vote. */
export function ParticipationPublisher() {
  const t = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState<"project" | "vote" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [project, setProject] = useState({ title: "", summary: "", body: "", zone: "", budget: "", startsOn: "", endsOn: "", progress: "0", consultationOpen: true, status: "PLANNED" });
  const [vote, setVote] = useState({ question: "", description: "", options: "", opensAt: "", closesAt: "" });

  const send = async (kind: "project" | "vote", event: FormEvent) => {
    event.preventDefault();
    setBusy(kind);
    setErrors({});
    try {
      if (kind === "project") {
        await apiFetch("/api/projects", {
          method: "POST",
          body: {
            title: project.title,
            summary: project.summary,
            body: project.body,
            zone: project.zone || null,
            budget: project.budget ? Number(project.budget) : null,
            status: project.status,
            startsOn: project.startsOn || null,
            endsOn: project.endsOn || null,
            progress: Number(project.progress) || 0,
            consultationOpen: project.consultationOpen,
          },
        });
        setProject({ ...project, title: "", summary: "", body: "" });
      } else {
        await apiFetch("/api/decisions", {
          method: "POST",
          body: { question: vote.question, description: vote.description, options: vote.options.split("\n").map((line) => line.trim()).filter(Boolean), opensAt: vote.opensAt ? iso(vote.opensAt) : "", closesAt: vote.closesAt ? iso(vote.closesAt) : "" },
        });
        setVote({ question: "", description: "", options: "", opensAt: "", closesAt: "" });
      }
      toast.success(t(kind === "project" ? "tn.participate.admin.project_done" : "tn.participate.admin.vote_done"));
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) setErrors(error.fields);
      toast.error(describeApiError(error, t));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={(event) => void send("project", event)} className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-panel" noValidate>
        <h2 className="text-lg font-semibold">{t("tn.participate.admin.project")}</h2>
        <div><Label htmlFor="p-title">{t("tn.participate.idea_title")}</Label><Input id="p-title" value={project.title} onChange={(e) => setProject({ ...project, title: e.target.value })} maxLength={160} /><Err id="p-title-e" text={errors.title} /></div>
        <div><Label htmlFor="p-summary">{t("tn.participate.admin.summary")}</Label><Input id="p-summary" value={project.summary} onChange={(e) => setProject({ ...project, summary: e.target.value })} maxLength={300} /><Err id="p-summary-e" text={errors.summary} /></div>
        <div><Label htmlFor="p-body">{t("tn.participate.admin.body")}</Label><Textarea id="p-body" value={project.body} onChange={(e) => setProject({ ...project, body: e.target.value })} rows={4} /><Err id="p-body-e" text={errors.body} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="p-zone">{t("tn.participate.idea_zone")}</Label>
            <select id="p-zone" value={project.zone} onChange={(e) => setProject({ ...project, zone: e.target.value })} className={SELECT_CLASS}>
              <option value="">{t("tn.participate.idea_zone_all")}</option>
              {CITY_ZONE_IDS.map((id) => <option key={id} value={id}>{t(cityZoneLabelKey(id))}</option>)}
            </select></div>
          <div><Label htmlFor="p-status">{t("tn.participate.idea_state")}</Label>
            <select id="p-status" value={project.status} onChange={(e) => setProject({ ...project, status: e.target.value })} className={SELECT_CLASS}>
              {["PLANNED", "IN_PROGRESS", "DONE"].map((v) => <option key={v} value={v}>{t(`tn.participate.status.${v}` as never)}</option>)}
            </select></div>
          <div><Label htmlFor="p-budget">{t("tn.participate.budget")}</Label><Input id="p-budget" type="number" min={0} value={project.budget} onChange={(e) => setProject({ ...project, budget: e.target.value })} /></div>
          <div><Label htmlFor="p-progress">{t("tn.participate.progress")} (%)</Label><Input id="p-progress" type="number" min={0} max={100} value={project.progress} onChange={(e) => setProject({ ...project, progress: e.target.value })} /></div>
          <div><Label htmlFor="p-start">{t("tn.participate.admin.starts")}</Label><Input id="p-start" type="date" value={project.startsOn} onChange={(e) => setProject({ ...project, startsOn: e.target.value })} /></div>
          <div><Label htmlFor="p-end">{t("tn.participate.admin.ends")}</Label><Input id="p-end" type="date" value={project.endsOn} onChange={(e) => setProject({ ...project, endsOn: e.target.value })} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><Switch checked={project.consultationOpen} onCheckedChange={(v) => setProject({ ...project, consultationOpen: v })} />{t("tn.participate.admin.consultation")}</label>
        <Button type="submit" className="self-start" disabled={busy !== null}>{busy === "project" ? <Loader2 className="animate-spin" aria-hidden /> : null}{t("tn.participate.admin.publish")}</Button>
      </form>

      <form onSubmit={(event) => void send("vote", event)} className="flex flex-col gap-3 rounded-2xl bg-card p-5 shadow-panel" noValidate>
        <h2 className="text-lg font-semibold">{t("tn.participate.admin.vote")}</h2>
        <div><Label htmlFor="v-question">{t("tn.participate.admin.question")}</Label><Input id="v-question" value={vote.question} onChange={(e) => setVote({ ...vote, question: e.target.value })} maxLength={200} /><Err id="v-q-e" text={errors.question} /></div>
        <div><Label htmlFor="v-desc">{t("tn.participate.admin.explain")}</Label><Textarea id="v-desc" value={vote.description} onChange={(e) => setVote({ ...vote, description: e.target.value })} rows={3} /><Err id="v-d-e" text={errors.description} /></div>
        <div><Label htmlFor="v-options">{t("tn.participate.admin.options")}</Label><Textarea id="v-options" value={vote.options} onChange={(e) => setVote({ ...vote, options: e.target.value })} rows={4} placeholder={t("tn.participate.admin.options_hint")} /><Err id="v-o-e" text={errors.options} /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><Label htmlFor="v-open">{t("tn.participate.admin.opens")}</Label><Input id="v-open" type="datetime-local" value={vote.opensAt} onChange={(e) => setVote({ ...vote, opensAt: e.target.value })} /></div>
          <div><Label htmlFor="v-close">{t("tn.participate.admin.closes")}</Label><Input id="v-close" type="datetime-local" value={vote.closesAt} onChange={(e) => setVote({ ...vote, closesAt: e.target.value })} /><Err id="v-c-e" text={errors.closesAt} /></div>
        </div>
        <Button type="submit" className="self-start" disabled={busy !== null || !vote.opensAt || !vote.closesAt}>{busy === "vote" ? <Loader2 className="animate-spin" aria-hidden /> : null}{t("tn.participate.admin.open_vote")}</Button>
      </form>
    </div>
  );
}
