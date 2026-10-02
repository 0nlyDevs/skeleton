"use client";

/**
 * Browser-side image preparation before upload.
 *
 * Phone photos are often HEIC or 4–12 MB: sent as-is they are refused (type or
 * size) and cost bandwidth for nothing. Every image is decoded here (whatever
 * the browser can read, HEIC included on Safari), oriented, scaled to at most
 * `maxSide` pixels and re-encoded as WebP (JPEG where WebP encoding is not
 * available). The server still validates, decodes and re-encodes everything:
 * this is a convenience and an eco-design measure, not a security boundary.
 */

const PASS_THROUGH = new Set(["image/jpeg", "image/png", "image/webp"]);
const PASS_THROUGH_MAX_BYTES = 1.5 * 1024 * 1024;

export class UnsupportedImageError extends Error {}

async function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function prepareImage(file: File, maxSide = 2048): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Not decodable here: let the server decide (it answers with a clear error).
    if (PASS_THROUGH.has(file.type)) return file;
    throw new UnsupportedImageError(file.type || "unknown");
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && PASS_THROUGH.has(file.type) && file.size <= PASS_THROUGH_MAX_BYTES) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const webp = await encode(canvas, "image/webp", 0.85);
  const blob = webp?.type === "image/webp" ? webp : await encode(canvas, "image/jpeg", 0.85);
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${name}.${blob.type === "image/webp" ? "webp" : "jpg"}`, { type: blob.type });
}

/** Image files from a paste event (screenshots, copied images). */
export function imagesFromClipboard(event: { clipboardData: DataTransfer | null }): File[] {
  const items = event.clipboardData ? [...event.clipboardData.items] : [];
  return items
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);
}
