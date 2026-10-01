"use client";

import { Globe, Loader2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/form-field";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError, apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { GroupDto } from "@/modules/groups/groups.dto";

export function PrivacyPicker({
  value,
  onChange,
}: {
  readonly value: "PUBLIC" | "PRIVATE";
  readonly onChange: (value: "PUBLIC" | "PRIVATE") => void;
}) {
  const t = useTranslation();
  return (
    <div role="radiogroup" aria-label={t("groups.privacy")} className="grid gap-2 sm:grid-cols-2">
      {(["PUBLIC", "PRIVATE"] as const).map((option) => {
        const Icon = option === "PUBLIC" ? Globe : Lock;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={value === option}
            onClick={() => onChange(option)}
            className={cn(
              "flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
              value === option ? "border-primary bg-accent" : "border-border hover:bg-surface-muted",
            )}
          >
            <span className="flex items-center gap-2 text-[14px] font-semibold">
              <Icon className="size-4" aria-hidden />
              {option === "PUBLIC" ? t("groups.public") : t("groups.private")}
            </span>
            <span className="text-[12px] leading-snug text-muted-foreground">
              {option === "PUBLIC" ? t("groups.public_hint") : t("groups.private_hint")}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function CreateGroupDialog({ open, onOpenChange }: { readonly open: boolean; readonly onOpenChange: (open: boolean) => void }) {
  const t = useTranslation();
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [privacy, setPrivacy] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 3) {
      setErrors({ name: t("error.VALIDATION_ERROR") });
      return;
    }
    setBusy(true);
    setErrors({});
    try {
      const response = await apiFetch<{ data: GroupDto }>("/api/groups", {
        method: "POST",
        body: { name: name.trim(), description: description.trim(), privacy },
      });
      toast.success(t("groups.created"));
      onOpenChange(false);
      router.push(`/groups/${response.data.slug}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields) setErrors(error.fields);
      else toast.error(describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("groups.create")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
          <FormField label={t("groups.name")} required {...(errors.name ? { error: errors.name } : {})}>
            {(field) => <Input {...field} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus />}
          </FormField>
          <FormField label={t("groups.description")} {...(errors.description ? { error: errors.description } : {})}>
            {(field) => <Textarea {...field} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} />}
          </FormField>
          <PrivacyPicker value={privacy} onChange={setPrivacy} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              {t("groups.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
