"use client";

import { ArrowLeft, ArrowRight, Building2, Camera, CheckCircle2, FolderOpen, Loader2, Send, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ServiceIcon } from "@/components/city/service-icon";
import { useTranslation } from "@/components/providers/i18n-provider";
import { IMAGE_INPUT_ACCEPT, uploadImage } from "@/components/social/use-image-uploads";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import Link from "@/components/ui/link";
import { Textarea } from "@/components/ui/textarea";
import { patchProfile } from "@/hooks/use-profile-overrides";
import { apiFetch, ApiRequestError } from "@/lib/api/client";
import { WELCOME_SERVICE_COOKIE, setWelcomeCookie } from "@/lib/onboarding";
import { cn, initials } from "@/lib/utils";
import { CITY_ZONES, cityZoneLabelKey, type CityZoneId } from "@/modules/alerts/city-zones";
import type { UserProfileDto } from "@/modules/users/users.dto";

const STEPS = ["welcome", "profile", "services", "request"] as const;
const BIO_MAX = 500;

export interface WizardService {
  readonly slug: string;
  readonly name: string;
  readonly summary: string;
  readonly icon: string;
}

/**
 * D12 — the first-login wizard: what the platform is for, a profile photo and
 * a few words, the most common services, then a first request. It opens once
 * per browser; the checklist in the citizen space keeps the progress after.
 * Radix keeps focus inside, Escape closes it, and each step's title takes the
 * focus so a screen reader announces where the resident is.
 */
export function WelcomeWizard({
  name,
  image: initialImage,
  services,
}: {
  readonly name: string;
  readonly image: string | null;
  readonly services: readonly WizardService[];
}) {
  const t = useTranslation();
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [image, setImage] = useState(initialImage);
  const [bio, setBio] = useState("");
  const [cityZone, setCityZone] = useState<CityZoneId | "">("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const firstStep = useRef(true);

  // Moving between steps announces the new one: focus goes to its title.
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [step]);

  // While the guide is open, alerts and notices wait: nothing is drawn over it and no toast pops up.
  useEffect(() => {
    if (!open) return;
    document.body.dataset.wizard = "1";
    return () => {
      delete document.body.dataset.wizard;
    };
  }, [open]);

  /** Saved on the account, so the guide does not open again on any device. */
  const markDone = () => {
    void apiFetch("/api/users/me/onboarding", { method: "POST" }).catch(() => undefined);
  };

  const close = () => {
    markDone();
    setOpen(false);
    // Opened from the top bar (`?guide=1`): leave the URL so it does not reopen.
    router.replace("/space", { scroll: false });
    router.refresh();
  };

  const next = () => setStep((current) => Math.min(current + 1, STEPS.length - 1));
  const back = () => setStep((current) => Math.max(current - 1, 0));

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      // Avatars are seen by every viewer, so the upload is PUBLIC.
      const { url } = await uploadImage(file, "PUBLIC");
      const saved = await apiFetch<UserProfileDto>("/api/users/me", { method: "PATCH", body: { image: url } });
      setImage(url);
      patchProfile({ userId: saved.id, name: saved.name, username: saved.username, image: saved.image });
      toast.success(t("tn.wizard.profile.photo_done"));
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 413) toast.error(t("feedback.upload_too_large"));
      else if (caught instanceof ApiRequestError && caught.status === 415) toast.error(t("feedback.upload_type"));
      else toast.error(t("feedback.error.body"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveProfile = async () => {
    const body = { ...(bio.trim() ? { bio: bio.trim() } : {}), ...(cityZone ? { cityZone } : {}) };
    if (Object.keys(body).length === 0) {
      next();
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/users/me", { method: "PATCH", body });
      next();
    } catch {
      toast.error(t("feedback.error.body"));
    } finally {
      setSaving(false);
    }
  };

  const current = STEPS[step] ?? "welcome";
  const title =
    current === "welcome"
      ? t("tn.wizard.welcome.title", { name })
      : current === "profile"
        ? t("tn.wizard.profile.title")
        : current === "services"
          ? t("tn.wizard.services.title")
          : t("tn.wizard.request.title");

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : close())}>
      {/* A toast, the alert line or the official message must never close the guide: only its own buttons or Escape do. */}
      <DialogContent className="max-w-xl gap-5" aria-describedby="wizard-body" onInteractOutside={(event) => event.preventDefault()} onPointerDownOutside={(event) => event.preventDefault()} onFocusOutside={(event) => event.preventDefault()}>
        <div className="flex flex-col gap-3 pr-8">
          <p className="text-[0.8125rem] font-medium text-muted-foreground" aria-live="polite">
            {t("tn.wizard.step", { current: step + 1, total: STEPS.length })}
          </p>
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((key, index) => (
              <span key={key} className={cn("h-1.5 flex-1 rounded-full", index <= step ? "bg-primary" : "bg-border")} />
            ))}
          </div>
          <DialogTitle ref={titleRef} tabIndex={-1} className="text-xl outline-none">
            {title}
          </DialogTitle>
        </div>

        {current === "welcome" ? (
          <div className="flex flex-col gap-4">
            <DialogDescription id="wizard-body">{t("tn.wizard.welcome.body")}</DialogDescription>
            <ul className="flex flex-col gap-2.5">
              {[
                { icon: Building2, key: "tn.wizard.welcome.point1" as const },
                { icon: Send, key: "tn.wizard.welcome.point2" as const },
                { icon: FolderOpen, key: "tn.wizard.welcome.point3" as const },
              ].map((point) => (
                <li key={point.key} className="flex items-start gap-3 rounded-xl border border-border/70 bg-surface-muted/40 p-3 text-sm">
                  <point.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  {t(point.key)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {current === "profile" ? (
          <div className="flex flex-col gap-4">
            <DialogDescription id="wizard-body">{t("tn.wizard.profile.body")}</DialogDescription>
            <div className="flex items-center gap-4">
              <Avatar className="size-16">
                {image ? <AvatarImage src={image} alt="" /> : null}
                <AvatarFallback>{initials(name)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">{t("tn.wizard.profile.photo")}</span>
                <input
                  ref={fileRef}
                  type="file"
          aria-label={t("tn.a11y.choose_file")}
                  accept={IMAGE_INPUT_ACCEPT}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(event) => void upload(event.target.files?.[0])}
                />
                <Button type="button" variant="secondary" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()} className="w-fit">
                  {uploading ? <Loader2 className="animate-spin" aria-hidden /> : image ? <CheckCircle2 aria-hidden /> : <Camera aria-hidden />}
                  {t("settings.profile.upload")}
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-bio" className="text-sm font-medium">
                {t("tn.wizard.profile.bio")}
              </label>
              <Textarea
                id="wizard-bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder={t("tn.wizard.profile.bio_placeholder")}
                rows={3}
                maxLength={BIO_MAX}
              />
            </div>
            {/* The district decides which local alerts reach this resident. */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-zone" className="text-sm font-medium">
                {t("alerts.location.label")}
              </label>
              <select
                id="wizard-zone"
                value={cityZone}
                onChange={(event) => setCityZone(event.target.value as CityZoneId | "")}
                aria-describedby="wizard-zone-hint"
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <option value="">{t("alerts.location.choose")}</option>
                {CITY_ZONES.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {t(cityZoneLabelKey(zone.id))}
                  </option>
                ))}
              </select>
              <p id="wizard-zone-hint" className="text-[0.8125rem] text-muted-foreground">
                {t("alerts.location.private")}
              </p>
            </div>
          </div>
        ) : null}

        {current === "services" ? (
          <div className="flex flex-col gap-4">
            <DialogDescription id="wizard-body">{t("tn.wizard.services.body")}</DialogDescription>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2.5">
              {services.map((service) => (
                <li key={service.slug}>
                  <Link
                    href={`/services/${service.slug}`}
                    onClick={() => {
                      setWelcomeCookie(WELCOME_SERVICE_COOKIE);
                      markDone();
                    }}
                    className="flex min-w-0 items-center gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:border-primary/40 hover:bg-surface-muted/50"
                  >
                    <ServiceIcon name={service.icon} className="size-9" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{service.name}</span>
                      <span className="block truncate text-[0.8125rem] text-muted-foreground">{service.summary}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/services" onClick={markDone} className="w-fit text-sm text-primary hover:underline">
              {t("tn.wizard.services.all")}
            </Link>
          </div>
        ) : null}

        {current === "request" ? (
          <div className="flex flex-col gap-4">
            <DialogDescription id="wizard-body">{t("tn.wizard.request.body")}</DialogDescription>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {[
                { href: "/contact", icon: Send, title: "tn.wizard.request.question" as const, body: "tn.wizard.request.question_body" as const },
                { href: "/contact?type=issue", icon: TriangleAlert, title: "tn.wizard.request.issue" as const, body: "tn.wizard.request.issue_body" as const },
              ].map((option) => (
                <Link
                  key={option.href}
                  href={option.href}
                  onClick={markDone}
                  className="flex flex-col gap-1.5 rounded-xl border border-border/70 p-4 transition-colors hover:border-primary/40 hover:bg-surface-muted/50"
                >
                  <option.icon className="size-5 text-primary" aria-hidden />
                  <span className="font-medium">{t(option.title)}</span>
                  <span className="text-[0.8125rem] text-muted-foreground">{t(option.body)}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
          {step === 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={close}>
              {t("tn.wizard.skip")}
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={back}>
              <ArrowLeft aria-hidden />
              {t("common.back")}
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            {current === "profile" ? (
              <>
                <Button type="button" variant="secondary" size="sm" onClick={next}>
                  {t("tn.wizard.skip_step")}
                </Button>
                <Button type="button" size="sm" disabled={saving || uploading} onClick={() => void saveProfile()}>
                  {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
                  {t("tn.wizard.profile.save")}
                </Button>
              </>
            ) : current === "request" ? (
              <Button type="button" size="sm" onClick={close}>
                {t("tn.wizard.request.later")}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={next}>
                {t("common.next")}
                <ArrowRight aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
