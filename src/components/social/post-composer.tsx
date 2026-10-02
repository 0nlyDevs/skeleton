"use client";

import { AtSign, ImagePlus, Loader2, MapPin, X } from "lucide-react";
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

  const publish = async () => {
    if (publishing) return;
    if (uploads.uploading) {
      setHint(t("composer.uploading"));
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
        },
      });
      setBody("");
      setPlace(null);
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
            placeholder={group ? t("composer.placeholder_group") : t("composer.placeholder", { name: viewer.name.split(" ")[0] ?? viewer.name })}
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
