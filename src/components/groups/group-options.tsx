"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { IMAGE_INPUT_ACCEPT, uploadImage } from "@/components/social/use-image-uploads";
import { Switch } from "@/components/ui/switch";
import { describeApiError } from "@/lib/api/error-message";
import { UnsupportedImageError } from "@/lib/images/prepare-image";

/** Who may join: at once, or after an admin approves (private groups always ask). */
export function ApprovalSwitch({
  privacy,
  value,
  onChange,
}: {
  readonly privacy: "PUBLIC" | "PRIVATE";
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
}) {
  const t = useTranslation();
  const forced = privacy === "PRIVATE";
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border border-border/70 px-3 py-2.5">
      <span>
        <span className="block text-[0.875rem] font-medium">{t("groups.approval")}</span>
        <span className="mt-0.5 block text-[0.7812rem] text-muted-foreground">
          {forced ? t("groups.approval_forced") : value ? t("groups.approval_on") : t("groups.approval_off")}
        </span>
      </span>
      <Switch checked={forced || value} disabled={forced} onCheckedChange={onChange} aria-label={t("groups.approval")} />
    </label>
  );
}

/** Cover image: uploaded public at once (covers are shown to every visitor). */
export function CoverPicker({ value, onChange }: { readonly value: string | null; readonly onChange: (url: string | null) => void }) {
  const t = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File) => {
    setBusy(true);
    try {
      const uploaded = await uploadImage(file, "PUBLIC");
      onChange(uploaded.url);
    } catch (error) {
      toast.error(error instanceof UnsupportedImageError ? t("composer.image_type") : describeApiError(error, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.8125rem] font-medium">{t("groups.cover")}</span>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="relative grid h-28 place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-surface-muted text-[0.8125rem] text-muted-foreground hover:border-primary"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- own public upload */}
        {value ? <img src={value} alt="" className="absolute inset-0 size-full object-cover" /> : null}
        <span className="relative inline-flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {value ? t("groups.cover_change") : t("groups.cover_add")}
        </span>
      </button>
      {value ? (
        <button type="button" onClick={() => onChange(null)} className="inline-flex items-center gap-1 self-start text-[0.7812rem] text-muted-foreground hover:underline">
          <X className="size-3.5" />
          {t("groups.cover_remove")}
        </button>
      ) : null}
      <input
        ref={input}
        type="file"
          aria-label={t("tn.a11y.choose_file")}
        accept={IMAGE_INPUT_ACCEPT}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void pick(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}
