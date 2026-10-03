/**
 * Digital sobriety.
 *
 * Light mode decides how many bytes a resident on a slow connection pays, so
 * its rules are pinned here: an explicit choice always wins, slow-network
 * signals switch it on, and resized images stay inside the upload naming
 * rules (no path tricks through `?w=`).
 */

import { describe, expect, it } from "vitest";

import { isSlowConnection, resolveEcoMode } from "@/lib/eco";
import { isStoredImage, storedSrc, storedSrcSet } from "@/lib/media";
import { isSafeFilename, variantFilename } from "@/lib/storage/disk";
import { isImageWidth } from "@/lib/storage/variants";

const NONE = { choice: undefined, autoCookie: undefined, saveData: null, ect: null };

describe("resolveEcoMode", () => {
  it("serves the full page by default", () => {
    expect(resolveEcoMode(NONE)).toEqual({ on: false, auto: false });
  });

  it("switches on automatically for data saving or a slow link", () => {
    expect(resolveEcoMode({ ...NONE, saveData: "on" })).toEqual({ on: true, auto: true });
    expect(resolveEcoMode({ ...NONE, ect: "3g" })).toEqual({ on: true, auto: true });
    expect(resolveEcoMode({ ...NONE, autoCookie: "1" })).toEqual({ on: true, auto: true });
  });

  it("lets an explicit choice win over the connection", () => {
    expect(resolveEcoMode({ ...NONE, choice: "0", saveData: "on", ect: "2g" })).toEqual({ on: false, auto: false });
    expect(resolveEcoMode({ ...NONE, choice: "1", ect: "4g" })).toEqual({ on: true, auto: false });
  });
});

describe("isSlowConnection", () => {
  it("treats 4G and unknown links as normal", () => {
    expect(isSlowConnection(null, "4g")).toBe(false);
    expect(isSlowConnection(null, null)).toBe(false);
  });

  it("treats 3G or worse, and data saving, as slow", () => {
    expect(isSlowConnection(null, "slow-2g")).toBe(true);
    expect(isSlowConnection("on", "4g")).toBe(true);
  });
});

describe("resized image copies", () => {
  const original = "0b6f1c2a-3d4e-4f50-8a6b-7c8d9e0f1a2b.webp";

  it("keep a name the storage layer accepts", () => {
    expect(variantFilename(original, 640)).toBe("0b6f1c2a-3d4e-4f50-8a6b-7c8d9e0f1a2b.w640.webp");
    expect(isSafeFilename(variantFilename(original, 640))).toBe(true);
    expect(isSafeFilename("../0b6f1c2a-3d4e-4f50-8a6b-7c8d9e0f1a2b.w640.webp")).toBe(false);
  });

  it("only exist at the allowed widths", () => {
    expect(isImageWidth(640)).toBe(true);
    expect(isImageWidth(641)).toBe(false);
    expect(isImageWidth(4000)).toBe(false);
  });

  it("are offered as srcset only for stored files", () => {
    expect(storedSrcSet("/api/files/cm1abc")).toBe("/api/files/cm1abc?w=320 320w, /api/files/cm1abc?w=640 640w, /api/files/cm1abc?w=1080 1080w");
    expect(storedSrcSet("https://lh3.googleusercontent.com/a/x")).toBeUndefined();
    expect(storedSrc("/api/files/cm1abc", 160)).toBe("/api/files/cm1abc?w=160");
    expect(isStoredImage("/api/files/../../etc")).toBe(false);
  });
});
