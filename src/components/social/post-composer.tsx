"use client";

import { AtSign, BarChart3, ImagePlus, Loader2, MapPin, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { cn } from "@/lib/utils";
import type { FeedItemDto } from "@/modules/posts/posts.dto";

import { LocationPicker, type PickedPlace } from "@/components/maps/location-picker";

import { MentionInput, type MentionInputHandle } from "./mention-input";
import { ACCEPTED_IMAGE_TYPES, useImageUploads } from "./use-image-uploads";

const MAX_IMAGES = 6;
const MAX_BODY = 20_000;

export interface ComposerViewer {
  readonly name: string;
  readonly image: string | null;
}

/**
 * Create a post: text (optional when there is a photo), up to six images,
 * `@mentions`. The publish button is only ever disabled while something is in
 * flight; pressing it with nothing to post explains why instead.
 */
export function PostComposer({
  viewer,
  group,
  onPublished,
}: {
  readonly viewer: ComposerViewer;
  readonly group?: { readonly id: string; readonly name: string } | null;
  readonly onPublished: (post: FeedItemDto) => void;
}) {
  const t = useTranslation();
  const [body, setBody] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const input = useRef<MentionInputHandle>(null);
  const uploads = useImageUploads(MAX_IMAGES);
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [picking, setPicking] = useState(false);
  const [poll, setPoll] = useState<PollDraft | null>(null);

  const publish = async () => {
    if (publishing) return;
    if (uploads.uploading) {
      setHint(t("composer.uploading"));
      return;
    }
    const pollOptions = poll ? poll.options.map((option) => option.trim()).filter(Boolean) : [];
    if (poll && body.trim().length === 0) {
      setHint(t("poll.need_question"));
      input.current?.focus();
      return;
    }
    if (poll && (pollOptions.length < 2 || new Set(pollOptions.map((option) => option.toLocaleLowerCase())).size !== pollOptions.length)) {
      setHint(t("poll.need_options"));
      return;
    }
    if (body.trim().length === 0 && uploads.readyIds.length === 0) {
      setHint(t("composer.empty_hint"));
      input.current?.focus();
      return;
    }
    if (body.length > MAX_BODY) {
      setHint(t("composer.too_long", { max: MAX_BODY }));
      return;
    }

    setHint(null);
    setPublishing(true);
    try {
      const response = await apiFetch<{ data: FeedItemDto }>("/api/posts", {
        method: "POST",
        body: {
          body: body.trim(),
          mediaIds: uploads.readyIds,
          published: true,
          ...(group ? { groupId: group.id } : {}),
          ...(place ? { location: place } : {}),
          ...(poll ? { poll: { options: pollOptions, multiple: poll.multiple, durationHours: poll.durationHours } } : {}),
        },
      });
      setBody("");
      setPlace(null);
      setPoll(null);
      uploads.reset();
      onPublished(response.data);
      toast.success(t("composer.published"));
    } catch (error) {
      setHint(describeApiError(error, t));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex gap-3">
        <UserAvatar name={viewer.name} image={viewer.image} size="md" />
        <div className="min-w-0 flex-1 rounded-2xl bg-surface-muted transition-colors focus-within:bg-surface focus-within:ring-2 focus-within:ring-ring/25">
          <MentionInput
            ref={input}
            value={body}
            onChange={(value) => {
              setBody(value);
              if (hint) setHint(null);
            }}
            placeholder={poll ? t("poll.question_placeholder") : group ? t("composer.placeholder_group") : t("composer.placeholder", { name: viewer.name.split(" ")[0] ?? viewer.name })}
            minRows={2}
            maxRows={14}
            maxLength={MAX_BODY}
          />
        </div>
      </div>

      {uploads.images.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {uploads.images.map((image) => (
            <li key={image.key} className="relative aspect-square overflow-hidden rounded-xl bg-surface-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={image.previewUrl} alt="" className={cn("h-full w-full object-cover", image.status !== "ready" && "opacity-60")} />
              {image.status === "uploading" ? (
                <span className="absolute inset-0 grid place-items-center">
                  <Loader2 className="size-5 animate-spin text-white drop-shadow" />
                </span>
              ) : null}
              {image.status === "error" ? (
                <span className="absolute inset-x-0 bottom-0 bg-error/90 px-1 py-0.5 text-center text-[10px] text-white" title={image.error}>
                  {image.error}
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => uploads.remove(image.key)}
                aria-label={t("composer.remove_image")}
                className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {poll ? <PollEditor draft={poll} onChange={setPoll} /> : null}

      {hint || uploads.rejection ? (
        <p role="status" className="mt-2 text-[12.5px] font-medium text-error">
          {hint ?? uploads.rejection}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border/60 pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => fileInput.current?.click()} disabled={uploads.images.length >= MAX_IMAGES}>
          <ImagePlus className="text-success" />
          {t("composer.photo")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setBody((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}@`);
            input.current?.focus();
          }}
        >
          <AtSign className="text-primary" />
          {t("composer.mention")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={poll !== null}
          onClick={() => setPoll((current) => (current ? null : { options: ["", ""], multiple: false, durationHours: 24 }))}
        >
          <BarChart3 className="text-warning" />
          {poll ? t("poll.remove") : t("poll.add")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setPicking(true)}>
          <MapPin className="text-error" />
          {t("place.add")}
        </Button>
        {place ? (
          <span className="inline-flex max-w-[14rem] items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-foreground">
            <span className="truncate">{place.name}</span>
            <button type="button" onClick={() => setPlace(null)} aria-label={t("place.remove")}>
              <X className="size-3" />
            </button>
          </span>
        ) : null}
        {group ? (
          <span className="ml-1 rounded-full bg-accent px-2.5 py-1 text-[12px] font-medium text-accent-foreground">
            {t("composer.in_group", { name: group.name })}
          </span>
        ) : null}
        <Button type="button" className="ml-auto min-w-24" onClick={() => void publish()} disabled={publishing}>
          {publishing ? <Loader2 className="animate-spin" /> : null}
          {publishing ? t("composer.publishing") : t("composer.publish")}
        </Button>
        <LocationPicker open={picking} onOpenChange={setPicking} onPick={setPlace} />
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_IMAGE_TYPES.join(",")}
          multiple
          hidden
          onChange={(event) => {
            if (event.target.files) uploads.add(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
    </Card>
  );
}

interface PollDraft {
  readonly options: readonly string[];
  readonly multiple: boolean;
  readonly durationHours: number | null;
}

const MAX_POLL_OPTIONS = 6;
const DURATIONS = [24, 72, 168, null] as const;

function PollEditor({ draft, onChange }: { readonly draft: PollDraft; readonly onChange: (draft: PollDraft) => void }) {
  const t = useTranslation();
  const setOption = (index: number, value: string) =>
    onChange({ ...draft, options: draft.options.map((option, position) => (position === index ? value : option)) });

  return (
    <fieldset className="mt-3 flex flex-col gap-2 rounded-2xl border border-border/70 p-3">
      <legend className="px-1 text-[12.5px] font-semibold text-muted-foreground">{t("poll.label")}</legend>
      {draft.options.map((option, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            value={option}
            maxLength={80}
            onChange={(event) => setOption(index, event.target.value)}
            placeholder={t("poll.option", { n: index + 1 })}
            aria-label={t("poll.option", { n: index + 1 })}
            className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
          {draft.options.length > 2 ? (
            <button
              type="button"
              aria-label={t("poll.remove_option")}
              onClick={() => onChange({ ...draft, options: draft.options.filter((_, position) => position !== index) })}
              className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-surface-muted"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3 pt-1 text-[13px]">
        {draft.options.length < MAX_POLL_OPTIONS ? (
          <button
            type="button"
            onClick={() => onChange({ ...draft, options: [...draft.options, ""] })}
            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
          >
            <Plus className="size-4" />
            {t("poll.add_option")}
          </button>
        ) : null}
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={draft.multiple}
            onChange={(event) => onChange({ ...draft, multiple: event.target.checked })}
            className="size-4 accent-[var(--color-primary)]"
          />
          {t("poll.multiple")}
        </label>
        <label className="ml-auto inline-flex items-center gap-2">
          <span className="text-muted-foreground">{t("poll.duration")}</span>
          <select
            value={draft.durationHours ?? "none"}
            onChange={(event) => onChange({ ...draft, durationHours: event.target.value === "none" ? null : Number(event.target.value) })}
            className="h-8 rounded-lg border border-border bg-surface px-2 text-[13px]"
          >
            {DURATIONS.map((hours) => (
              <option key={hours ?? "none"} value={hours ?? "none"}>
                {t(hours ? (`poll.duration.${hours}` as "poll.duration.24") : "poll.duration.none")}
              </option>
            ))}
          </select>
        </label>
      </div>
    </fieldset>
  );
}
