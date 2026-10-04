"use client";

import { Copy, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { useI18n } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { CITY_ZONE_IDS, cityZoneLabelKey } from "@/modules/alerts/city-zones";
import type { AdminCreatedAccountDto } from "@/modules/assisted-accounts/assisted-accounts.service";

const ROLES = ["USER", "AGENT", "ADMIN"] as const;
const FIELD = "h-10 w-full rounded-[0.875rem] bg-field px-3 text-[0.9375rem]";

/**
 * Administrators create an account for a resident, an agent or another
 * administrator, with or without an e-mail address. The one-time access code
 * is shown once; the person chooses their own password at first sign-in.
 */
export function CreateAccountPanel({ onCreated }: { readonly onCreated: () => void }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<AdminCreatedAccountDto | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    const text = (name: string): string => String(form.get(name) ?? "").trim();
    setSending(true);
    setErrors({});
    try {
      const response = await apiFetch<{ data: AdminCreatedAccountDto }>("/api/users", {
        method: "POST",
        body: { firstName: text("firstName"), lastName: text("lastName"), email: text("email") || undefined, role: text("role"), cityZone: text("cityZone") || undefined, locale },
      });
      setCreated(response.data);
      element.reset();
      onCreated();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) setErrors(error.fields);
      toast.error(describeApiError(error, t));
    } finally {
      setSending(false);
    }
  };

  const copy = (value: string) => {
    void navigator.clipboard?.writeText(value).then(() => toast.success(t("tn.admin.create.copied"))).catch(() => undefined);
  };

  return (
    <section aria-labelledby="create-account-title" className="mb-5 flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="create-account-title" className="flex items-center gap-2 text-lg font-semibold">
            <UserPlus className="size-5" aria-hidden />
            {t("tn.admin.create.title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("tn.admin.create.body")}</p>
        </div>
        <Button type="button" variant={open ? "outline" : "primary"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? t("common.close") : t("tn.admin.create.open")}
        </Button>
      </div>

      {created ? (
        <div role="status" className="flex flex-col gap-2 rounded-2xl bg-success/10 p-4">
          <p className="font-semibold">{t("tn.admin.create.done", { name: created.name, role: t(`role.${created.role.toLowerCase() as "user" | "agent" | "admin"}`) })}</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            {([["username", created.username], ["code", created.accessCode]] as const).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2">
                <div>
                  <dt className="text-[0.75rem] text-muted-foreground">{t(`tn.admin.create.${key}`)}</dt>
                  <dd className="font-mono text-[0.9375rem] font-semibold">{value}</dd>
                </div>
                <button type="button" onClick={() => copy(value)} aria-label={`${t("tn.admin.create.copy")} : ${t(`tn.admin.create.${key}`)}`} className="grid size-9 place-items-center rounded-full hover:bg-surface-muted">
                  <Copy className="size-4" aria-hidden />
                </button>
              </div>
            ))}
          </dl>
          <p className="text-[0.8125rem] text-muted-foreground">{t("tn.admin.create.once")}</p>
        </div>
      ) : null}

      {open ? (
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" noValidate>
          {(["firstName", "lastName"] as const).map((name) => (
            <div key={name} className="flex flex-col gap-1.5">
              <Label htmlFor={`create-${name}`}>{t(`tn.admin.create.${name}`)}</Label>
              <Input id={`create-${name}`} name={name} required maxLength={60} aria-invalid={errors[name] ? true : undefined} />
              {errors[name] ? <p role="alert" className="text-[0.8125rem] font-medium text-error">{errors[name]}</p> : null}
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-email">
              {t("tn.admin.create.email")} <span className="font-normal text-muted-foreground">· {t("tn.admin.create.email_optional")}</span>
            </Label>
            <Input id="create-email" name="email" type="email" maxLength={160} aria-invalid={errors.email ? true : undefined} />
            {errors.email ? <p role="alert" className="text-[0.8125rem] font-medium text-error">{errors.email}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-role">{t("tn.admin.create.role")}</Label>
            <select id="create-role" name="role" defaultValue="USER" className={FIELD}>
              {ROLES.map((role) => (
                <option key={role} value={role}>{t(`role.${role.toLowerCase() as "user" | "agent" | "admin"}`)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-zone">
              {t("tn.admin.create.zone")} <span className="font-normal text-muted-foreground">· {t("tn.admin.create.email_optional")}</span>
            </Label>
            <select id="create-zone" name="cityZone" defaultValue="" className={FIELD}>
              <option value="">—</option>
              {CITY_ZONE_IDS.map((id) => (
                <option key={id} value={id}>{t(cityZoneLabelKey(id))}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={sending}>
              {sending ? <Spinner className="size-4" /> : <UserPlus className="size-4" aria-hidden />}
              {t("tn.admin.create.submit")}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
