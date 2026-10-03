import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { recoverReleaseUploads, uploadRoot } from "@/lib/storage/disk";

const FILE = "0f8fad5b-d9cb-469f-a165-70867728950e.webp";
const originalCwd = process.cwd();
const originalHome = process.env.HOME;

afterEach(() => {
  process.chdir(originalCwd);
  process.env.HOME = originalHome;
});

describe("uploads on hosts that deploy into release folders", () => {
  it("stores outside the release and recovers files left by earlier releases", async () => {
    const base = mkdtempSync(path.join(tmpdir(), "skeleton-"));
    const home = path.join(base, "home");
    const current = path.join(base, "app", "releases", "new");
    const previous = path.join(base, "app", "releases", "old", "uploads");
    mkdirSync(home, { recursive: true });
    mkdirSync(current, { recursive: true });
    mkdirSync(previous, { recursive: true });
    writeFileSync(path.join(previous, FILE), "image");
    writeFileSync(path.join(previous, "not-an-upload.sh"), "echo");
    process.env.HOME = home;
    process.chdir(current);

    expect(uploadRoot()).toBe(path.join(home, "skeleton-data", "uploads"));
    expect(await recoverReleaseUploads()).toBe(1);
    expect(existsSync(path.join(home, "skeleton-data", "uploads", FILE))).toBe(true);
    expect(existsSync(path.join(home, "skeleton-data", "uploads", "not-an-upload.sh"))).toBe(false);
    expect(await recoverReleaseUploads()).toBe(0);
  });
});
