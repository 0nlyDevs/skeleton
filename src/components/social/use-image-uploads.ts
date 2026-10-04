"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";
import { prepareImage, UnsupportedImageError } from "@/lib/images/prepare-image";
import type { Translator } from "@/lib/i18n";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** File pickers accept any image: it is converted in the browser before upload. */
export const IMAGE_INPUT_ACCEPT = "image/*";

/**
 * Prepare (decode, orient, scale, re-encode) then upload one image.
 * Throws `UnsupportedImageError` for files the browser cannot read.
 */
export async function uploadImage(file: File, visibility: "PRIVATE" | "PUBLIC" = "PRIVATE"): Promise<{ id: string; url: string }> {
  const prepared = await prepareImage(file);
  if (prepared.size > MAX_IMAGE_BYTES) throw new ImageTooLargeError();
  const form = new FormData();
  form.append("file", prepared);
  form.append("visibility", visibility);
  const response = await apiFetch<{ data: { id: string; url: string } }>("/api/upload", { method: "POST", body: form });
  return response.data;
}

/** A picture that is still over the limit after being scaled down in the browser. */
export class ImageTooLargeError extends Error {}

/** The real reason an image could not be sent: its type, its weight, or the server's answer. */
export function describeImageError(error: unknown, t: Translator): string {
  if (error instanceof ImageTooLargeError) return t("errors.too_large");
  if (error instanceof UnsupportedImageError) return t("composer.image_type");
  return describeApiError(error, t);
}

export interface PendingImage {
  /** Local key; equals the upload id once uploaded. */
  readonly key: string;
  readonly previewUrl: string;
  readonly uploadId: string | null;
  readonly status: "uploading" | "ready" | "error";
  readonly error?: string;
}

/**
 * Image picking with instant previews and background uploads.
 *
 * Type and size are checked here for fast feedback only — the server checks
 * the magic bytes, decodes and re-encodes every image, and is the authority.
 */
export function useImageUploads(max: number, initial: ReadonlyArray<{ id: string; url: string }> = []) {
  const t = useTranslation();
  const [images, setImages] = useState<PendingImage[]>(() =>
    initial.map((image) => ({ key: image.id, previewUrl: image.url, uploadId: image.id, status: "ready" as const })),
  );
  const [rejection, setRejection] = useState<string | null>(null);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => () => objectUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const add = useCallback(
    (files: FileList | File[]) => {
      setRejection(null);
      const list = Array.from(files);
      const room = max - images.length;
      if (list.length > room) setRejection(t("composer.image_limit", { max }));

      for (const original of list.slice(0, Math.max(0, room))) {
        if (!original.type.startsWith("image/")) {
          setRejection(t("composer.image_type"));
          continue;
        }
        const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const previewUrl = URL.createObjectURL(original);
        objectUrls.current.push(previewUrl);
        setImages((current) => [...current, { key, previewUrl, uploadId: null, status: "uploading" }]);

        void uploadImage(original)
          .then((response) =>
            setImages((current) =>
              current.map((image) => (image.key === key ? { ...image, uploadId: response.id, status: "ready" } : image)),
            ),
          )
          .catch((error: unknown) =>
            setImages((current) =>
              current.map((image) =>
                image.key === key
                  ? { ...image, status: "error", error: describeImageError(error, t) }
                  : image,
              ),
            ),
          );
      }
    },
    [images.length, max, t],
  );

  const remove = useCallback((key: string) => {
    setImages((current) => current.filter((image) => image.key !== key));
  }, []);

  const reset = useCallback(() => {
    setImages([]);
    setRejection(null);
  }, []);

  return {
    images,
    add,
    remove,
    reset,
    rejection,
    uploading: images.some((image) => image.status === "uploading"),
    readyIds: images.filter((image) => image.status === "ready" && image.uploadId).map((image) => image.uploadId as string),
    hasErrors: images.some((image) => image.status === "error"),
  };
}
