/**
 * Image sanitisation.
 *
 * Every accepted image is decoded and re-encoded rather than stored as sent:
 *   * metadata (EXIF GPS position, camera serial, embedded thumbnails) is
 *     dropped, so a photo never leaks where it was taken;
 *   * a polyglot (a valid JPEG header followed by HTML or a script) does not
 *     survive a decode/encode round trip;
 *   * decompression bombs are refused before allocation (`limitInputPixels`);
 *   * the result is capped at 2048px and normalised to WebP, so the feed never
 *     serves a 30 MB camera original.
 */

import sharp from "sharp";

import { UnsupportedMediaTypeError } from "@/lib/errors";

const MAX_DIMENSION = 2048;
/** ~40 megapixels: far above any phone camera, far below a bomb. */
const MAX_INPUT_PIXELS = 40_000_000;

export interface SanitizedImage {
  readonly bytes: Buffer;
  readonly width: number;
  readonly height: number;
  readonly mime: "image/webp";
}

export async function sanitizeImage(input: Buffer): Promise<SanitizedImage> {
  try {
    const { data, info } = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
      // Apply the EXIF orientation before metadata is discarded.
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    return { bytes: data, width: info.width, height: info.height, mime: "image/webp" };
  } catch {
    throw new UnsupportedMediaTypeError("This image could not be read. Try another file.");
  }
}
