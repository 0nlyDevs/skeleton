"use client";

import { Camera, Loader2, PartyPopper } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { FormField } from "@/components/forms/form-field";
import { useTranslation } from "@/components/providers/i18n-provider";
import { IMAGE_INPUT_ACCEPT, uploadImage } from "@/components/social/use-image-uploads";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UsernameField, type UsernameState } from "@/components/forms/username-field";
import { patchProfile } from "@/hooks/use-profile-overrides";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import type { MessageKey } from "@/lib/i18n";
import {
  birthDateViolation,
  personNameViolation,
  usernameViolation,
} from "@/lib/validation/profile";
import type { UserProfileDto } from "@/modules/users/users.dto";
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
  profile,
  welcome = false,
}: {
  readonly profile: UserProfileDto;
  readonly welcome?: boolean;
}) {
  const t = useTranslation();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const email = profile.email;

  const [firstName, setFirstName] = useState(profile.firstName ?? "");
  const [lastName, setLastName] = useState(profile.lastName ?? "");
  const [username, setUsername] = useState(profile.displayUsername ?? profile.username ?? "");
  const [usernameState, setUsernameState] = useState<UsernameState>("idle");
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [image, setImage] = useState(profile.image);
  const [serverErrors, setServerErrors] = useState<Partial<Record<string, MessageKey>>>({});
  const name = `${firstName} ${lastName}`.trim();

  const invalid = {
    firstName: personNameViolation(firstName) !== null,
    lastName: personNameViolation(lastName) !== null,
    username: usernameViolation(username) !== null || usernameState === "taken",
    // Optional for accounts created before it existed or through OAuth.
    birthDate: birthDate !== "" && birthDateViolation(birthDate) !== null,
  };
  const errorFor = (field: keyof typeof invalid, key: MessageKey) => {
    const server = serverErrors[field];
    if (server) return { error: t(server) };
    return invalid[field] ? { error: t(key) } : {};
  };
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleAvatarSelected = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);

    try {
      // An avatar is rendered for every viewer of a post, so it must be
      // PUBLIC — the upload endpoint defaults to PRIVATE. Prepared in the
      // browser first (any format, scaled down: an avatar never needs more).
      const response = { data: await uploadImage(file, "PUBLIC") };

      // Persist the choice immediately so a refresh does not revert it.
      const saved = await apiFetch<UserProfileDto>("/api/users/me", {
        method: "PATCH",
        body: { image: response.data.url },
      });

      setImage(response.data.url);
      // Every avatar on screen (shell, feed, chat) switches now; the server
      // broadcast does the same for everyone else's open tabs.
      patchProfile({ userId: saved.id, name: saved.name, username: saved.username, image: saved.image });
      router.refresh();
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
    setServerErrors({});
    try {
      const saved = await apiFetch<UserProfileDto>("/api/users/me", {
        method: "PATCH",
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username.trim(),
          birthDate: birthDate === "" ? null : birthDate,
          bio: bio.trim(),
        },
      });
      patchProfile({ userId: saved.id, name: saved.name, username: saved.username, image: saved.image });
      router.refresh();
      toast.success(t("settings.profile.saved"));
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 409) {
        setServerErrors({ username: "profile.error.username_taken" });
      } else if (caught instanceof ApiRequestError && caught.fields) {
        const fields = caught.fields;
        setServerErrors({
          ...(fields.username ? { username: "profile.error.username" } : {}),
          ...(fields.firstName ? { firstName: "profile.error.name" } : {}),
          ...(fields.lastName ? { lastName: "profile.error.name" } : {}),
          ...(fields.birthDate ? { birthDate: "profile.error.birth_date" } : {}),
        });
        toast.error(t("error.VALIDATION_ERROR"));
      } else {
        toast.error(t("feedback.error.body"));
      }
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

      {welcome ? (
        <Alert>
          <PartyPopper />
          <AlertDescription className="text-foreground">{t("profile.welcome")}</AlertDescription>
        </Alert>
      ) : null}

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
            accept={IMAGE_INPUT_ACCEPT}
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <FormField label={t("profile.first_name")} required {...errorFor("firstName", "profile.error.name")}>
                {(field) => (
                  <Input
                    {...field}
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    maxLength={50}
                    autoComplete="given-name"
                    required
                  />
                )}
              </FormField>
              <FormField label={t("profile.last_name")} required {...errorFor("lastName", "profile.error.name")}>
                {(field) => (
                  <Input
                    {...field}
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    maxLength={50}
                    autoComplete="family-name"
                    required
                  />
                )}
              </FormField>
            </div>

            <FormField
              label={t("profile.username")}
              hint={
                profile.usernameChangeAvailableAt
                  ? t("profile.username_locked", { date: new Date(profile.usernameChangeAvailableAt).toLocaleDateString() })
                  : t("profile.username_hint_cooldown")
              }
              required
              {...(serverErrors.username ? { error: t(serverErrors.username) } : {})}
            >
              {(field) => (
                <UsernameField
                  inputProps={field}
                  value={username}
                  current={profile.username}
                  onStateChange={setUsernameState}
                  onChange={(value) => {
                    setServerErrors((current) => ({ ...current, username: undefined }));
                    setUsername(value);
                  }}
                />
              )}
            </FormField>

            <FormField
              label={t("profile.birth_date")}
              hint={t("profile.birth_date_hint")}
              {...errorFor("birthDate", "profile.error.birth_date")}
            >
              {(field) => (
                <Input
                  {...field}
                  type="date"
                  value={birthDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(event) => setBirthDate(event.target.value)}
                  autoComplete="bday"
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
              <Button type="submit" disabled={saving || Object.values(invalid).some(Boolean)}>
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
