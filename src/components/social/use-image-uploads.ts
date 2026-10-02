"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { apiFetch } from "@/lib/api/client";
import { describeApiError } from "@/lib/api/error-message";

export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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

      for (const file of list.slice(0, Math.max(0, room))) {
        if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type) || file.size > MAX_IMAGE_BYTES) {
          setRejection(t("composer.image_type"));
          continue;
        }
        const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const previewUrl = URL.createObjectURL(file);
        objectUrls.current.push(previewUrl);
        setImages((current) => [...current, { key, previewUrl, uploadId: null, status: "uploading" }]);

        const form = new FormData();
        form.append("file", file);
        form.append("visibility", "PRIVATE");
        void apiFetch<{ data: { id: string } }>("/api/upload", { method: "POST", body: form })
          .then((response) =>
            setImages((current) =>
              current.map((image) => (image.key === key ? { ...image, uploadId: response.data.id, status: "ready" } : image)),
            ),
          )
          .catch((error: unknown) =>
            setImages((current) =>
              current.map((image) =>
                image.key === key ? { ...image, status: "error", error: describeApiError(error, t) } : image,
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
