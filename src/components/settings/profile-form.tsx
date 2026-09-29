"use client";

import { Camera, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/form-field";
import { useTranslation } from "@/components/providers/i18n-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { initials } from "@/lib/utils";

const BIO_MAX = 500;

/**
 * Profile settings.
 *
 * The avatar uploads immediately on selection rather than waiting for "save":
 * mixing a multipart payload into the JSON profile update would either complicate
 * the endpoint or silently drop the file. One resource, one endpoint, one round
 * trip — then the visible avatar updates from the response.
 */
export function ProfileForm({
  name: initialName,
  bio: initialBio,
  image: initialImage,
  email,
}: {
  readonly name: string;
  readonly bio: string | null;
  readonly image: string | null;
  readonly email: string;
}) {
  const t = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio ?? "");
  const [image, setImage] = useState(initialImage);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleAvatarSelected = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiFetch<{ data: { url: string } }>("/api/upload", {
        method: "POST",
        body: formData,
      });

      // Persist the choice immediately so a refresh does not revert it.
      await apiFetch("/api/users/me", {
        method: "PATCH",
        body: { image: response.data.url },
      });

      setImage(response.data.url);
      toast.success(t("settings.profile.saved"));
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        if (caught.status === 413) toast.error(t("feedback.upload_too_large"));
        else if (caught.status === 415) toast.error(t("feedback.upload_type"));
        else toast.error(t("feedback.error.body"));
      } else {
        toast.error(t("feedback.error.body"));
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      await apiFetch("/api/users/me", {
        method: "PATCH",
        body: { name: name.trim(), bio: bio.trim() },
      });
      toast.success(t("settings.profile.saved"));
    } catch (caught) {
      toast.error(
        caught instanceof ApiRequestError && caught.fields?.name
          ? caught.fields.name
          : t("feedback.error.body"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[24px] font-semibold tracking-[-0.015em]">
          {t("settings.profile.title")}
        </h1>
        <p className="text-[14px] text-muted-foreground">{t("settings.profile.subtitle")}</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.profile.avatar")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-5">
          <div className="relative">
            <Avatar className="size-20">
              {image ? <AvatarImage src={image} alt="" /> : null}
              <AvatarFallback className="text-xl">{initials(name || email)}</AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label={t("settings.profile.upload")}
              className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-panel transition-colors hover:bg-surface-muted disabled:opacity-60"
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-4" />}
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-[13.5px] font-medium">{t("settings.profile.avatar")}</p>
            <p className="text-[12.5px] text-muted-foreground">{t("settings.profile.avatar_hint")}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-1 w-fit"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? t("settings.profile.uploading") : t("settings.profile.upload")}
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void handleAvatarSelected(event.target.files?.[0])}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.profile.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-5" noValidate>
            <FormField label={t("settings.profile.name")} required>
              {(field) => (
                <Input
                  {...field}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={80}
                  autoComplete="name"
                  required
                />
              )}
            </FormField>

            <FormField label={t("auth.login.email")}>
              {(field) => (
                <Input {...field} value={email} readOnly disabled className="opacity-70" />
              )}
            </FormField>

            <FormField label={t("settings.profile.bio")} hint={t("settings.profile.bio_hint")}>
              {(field) => (
                <Textarea
                  {...field}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  rows={4}
                  maxLength={BIO_MAX}
                />
              )}
            </FormField>

            <div className="flex items-center justify-end gap-3">
              <Button type="submit" disabled={saving || name.trim().length === 0}>
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
