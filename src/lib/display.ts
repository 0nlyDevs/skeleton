/**
 * Reading preferences (F23, F24), stored in cookies like eco mode so the server
 * renders the right size and contrast from the first byte.
 */
export const TEXT_SIZE_COOKIE = "skeleton_text_size";
export const CONTRAST_COOKIE = "skeleton_contrast";

/** Root font sizes; every rem-based size, spacing included, follows them. */
export const TEXT_SIZES = ["normal", "large", "larger", "largest"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

export function parseTextSize(value: string | undefined): TextSize {
  return TEXT_SIZES.find((size) => size === value) ?? "normal";
}
