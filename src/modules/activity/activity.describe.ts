/**
 * Turns a history entry into a sentence a person can read ("Marie a passé la
 * demande TN-100003 de Nouvelle à En cours") plus detail lines. Pure: shared by
 * the agents' history page and the CSV export, so both say the same thing.
 */

import type { MessageKey, Translator } from "@/lib/i18n";

import type { ActivityEntryDto } from "./activity.dto";

const str = (value: unknown): string | null => (typeof value === "string" && value.length > 0 ? value : null);

function label(t: Translator, prefix: string, value: unknown): string {
  const raw = str(value);
  if (!raw) return "—";
  const key = `${prefix}.${prefix === "role" ? raw.toLowerCase() : raw}` as MessageKey;
  const translated = t(key);
  return translated === key ? raw : translated;
}

/** The field names an edit touched, in words. */
function fieldList(t: Translator, value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value
    .filter((field): field is string => typeof field === "string")
    .map((field) => {
      const key = `tn.history.field.${field}` as MessageKey;
      const translated = t(key);
      return translated === key ? field : translated;
    })
    .join(", ");
}

export function describeActivity(entry: ActivityEntryDto, t: Translator, formatDate: (iso: string) => string): { sentence: string; details: string[] } {
  const actor = entry.actor?.name ?? t("tn.history.system");
  const target = entry.target?.label ?? t("tn.history.unknown_target");
  const d = entry.details;
  const op = entry.op ?? "update";
  const details: string[] = [];
  const params = { actor, target };

  const key = (suffix: string) => `tn.history.${entry.action.replace(/\./g, "_")}.${suffix}` as MessageKey;
  const sentenceFor = (suffix: string): string => {
    const specific = key(suffix);
    const text = t(specific, params);
    if (text !== specific) return text;
    const generic = key("update");
    const fallback = t(generic, params);
    return fallback !== generic ? fallback : t("tn.history.generic", { actor, action: entry.action, target });
  };

  let sentence: string;
  switch (entry.action) {
    case "city_request.changed": {
      sentence = sentenceFor(op);
      if (Array.isArray(d.changes)) {
        for (const change of d.changes as { kind?: unknown; from?: unknown; to?: unknown }[]) {
          if (change.kind === "status") details.push(t("tn.history.change.status", { from: label(t, "tn.status", change.from), to: label(t, "tn.status", change.to) }));
          else if (change.kind === "priority") details.push(t("tn.history.change.priority", { from: label(t, "tn.priority", change.from), to: label(t, "tn.priority", change.to) }));
          else if (change.kind === "assignee") details.push(t("tn.history.change.assignee", { from: str(change.from) ?? "—", to: str(change.to) ?? t("tn.history.nobody") }));
        }
      }
      if (str(d.issueType)) details.push(t("tn.history.detail.issue", { type: label(t, "tn.issue", d.issueType) }));
      if (str(d.service)) details.push(t("tn.history.detail.service", { name: String(d.service) }));
      break;
    }
    case "user.banned":
      sentence = sentenceFor("update");
      if (str(d.reason)) details.push(t("tn.history.detail.reason", { reason: String(d.reason) }));
      details.push(str(d.expiresAt) ? t("tn.history.detail.until", { date: formatDate(String(d.expiresAt)) }) : t("tn.history.detail.indefinite"));
      break;
    case "user.role_changed":
      sentence = sentenceFor("update");
      details.push(t("tn.history.change.role", { from: label(t, "role", d.from), to: label(t, "role", d.to) }));
      break;
    case "webcup.triaged":
      sentence = sentenceFor("update");
      if (str(d.triage)) details.push(t("tn.history.change.triage", { from: str(d.from) ? label(t, "tn.triage", d.from) : "—", to: label(t, "tn.triage", d.triage) }));
      if (d.noteChanged === true) details.push(t("tn.history.detail.note"));
      break;
    case "feature_flag.toggled":
      sentence = sentenceFor(d.enabled === true ? "on" : "off");
      break;
    case "report.resolved":
    case "report.dismissed":
    case "post.moderated":
    case "comment.deleted":
      sentence = sentenceFor("update");
      if (str(d.authorName)) details.push(t("tn.history.detail.author", { name: String(d.authorName) }));
      if (str(d.reason)) details.push(t("tn.history.detail.reason", { reason: String(d.reason) }));
      break;
    default:
      sentence = sentenceFor(op);
  }

  const changed = fieldList(t, d.changed);
  if (changed && op !== "create") details.push(t("tn.history.detail.fields", { fields: changed }));
  if (op === "create" && d.published === true) details.push(t("tn.history.detail.published"));
  return { sentence, details };
}
