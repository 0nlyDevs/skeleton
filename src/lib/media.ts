/**
 * Responsive sources for stored images. Files served by `/api/files/<id>`
 * exist at a few widths (see `lib/storage/variants`); `srcSet` lets the
 * browser download the smallest one that is sharp at the displayed size.
 * Any other URL (a provider avatar, a static asset) is left untouched.
 */

const STORED = /^\/api\/files\/[A-Za-z0-9_-]+$/;

export function isStoredImage(url: string | null | undefined): url is string {
  return typeof url === "string" && STORED.test(url);
}

/** `srcSet` for a stored image, or `undefined` for any other URL. */
export function storedSrcSet(url: string | null | undefined, widths: readonly number[] = [320, 640, 1080]): string | undefined {
  if (!isStoredImage(url)) return undefined;
  return widths.map((width) => `${url}?w=${width} ${width}w`).join(", ");
}

/** A single smaller copy, for thumbnails and avatars of a known size. */
export function storedSrc(url: string, width: 160 | 320 | 640 | 1080): string {
  return isStoredImage(url) ? `${url}?w=${width}` : url;
}
