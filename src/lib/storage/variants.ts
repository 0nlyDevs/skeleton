/**
 * Resized copies of stored images, made on first request.
 *
 * Uploads are kept once, at up to 2048 px. A feed column shows them at
 * 600 px and an avatar at 40, so serving the original is mostly wasted bytes.
 * The file route accepts `?w=` from a short allow-list; the copy is made with
 * sharp the first time, written next to the original, and read from disk
 * after that. The allow-list keeps the number of copies per image bounded.
 */

import sharp from "sharp";

import { readUpload, removeUpload, saveUpload, variantFilename } from "./disk";

export const IMAGE_WIDTHS = [160, 320, 640, 1080] as const;
export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

export function isImageWidth(value: number): value is ImageWidth {
  return (IMAGE_WIDTHS as readonly number[]).includes(value);
}

/** The bytes of `filename` at `width`, creating the copy if needed. */
export async function readImageVariant(filename: string, width: ImageWidth): Promise<Buffer> {
  const name = variantFilename(filename, width);
  try {
    return await readUpload(name);
  } catch {
    const original = await readUpload(filename);
    const resized = await sharp(original).resize({ width, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
    // A failed cache write only costs a resize next time.
    await saveUpload(name, resized).catch(() => undefined);
    return resized;
  }
}

/** Delete every resized copy of `filename`. */
export async function removeImageVariants(filename: string): Promise<void> {
  await Promise.all(IMAGE_WIDTHS.map((width) => removeUpload(variantFilename(filename, width)).catch(() => undefined)));
}
