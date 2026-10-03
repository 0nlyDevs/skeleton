import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { brand, FROZEN_IDENTIFIERS } from "@/lib/brand";

/**
 * Brand strings live in one module.
 *
 * This is a lint rule expressed as a test, because the failure it prevents is
 * invisible otherwise: a hardcoded brand name in a new component renders
 * correctly today and is wrong after the rename. Nothing breaks at the rename;
 * two different names just coexist.
 *
 * The frozen identifiers are the counterweight. They look renameable and are
 * not, so they are allowlisted by exact value — a repository-wide
 * find-and-replace would break field encryption and 2FA enrolment while every
 * test still passed.
 */

const ROOT = path.resolve(__dirname, "..");

/** Directories whose contents are generated, vendored, or not ours to rename. */
const SKIP_DIRS = new Set(["generated", "node_modules", ".next", ".git", "i18n"]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return SKIP_DIRS.has(name) ? [] : sources(full);
    return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
  });
}

describe("brand centralisation", () => {
  it("exposes a non-empty name, because everything else formats off it", () => {
    expect(brand.name.trim()).not.toBe("");
    expect(brand.description).toContain(brand.name);
  });

  it("keeps no stray hardcoded brand name outside the brand module", () => {
    // The UI skeleton loader (`Skeleton` from @/components/ui/skeleton) is a
    // different thing entirely and is left alone; this only catches the word
    // used as a product name in a string.
    const offenders: string[] = [];

    for (const file of sources(path.join(ROOT, "src"))) {
      if (file.endsWith(path.join("lib", "brand.ts"))) continue;

      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        const isComment = /^\s*(\*|\/\/|\/\*)/.test(line);
        if (isComment) return;

        const report = () =>
          offenders.push(
            `${path.relative(ROOT, file)}:${index + 1}  ${line.trim().slice(0, 90)}`,
          );

        // 1. Inside a quoted string — prose, filenames, prompts, User-Agents.
        for (const match of line.matchAll(/["'`]([^"'`]*)\bSkeleton\b([^"'`]*)["'`]/g)) {
          const [term, body] = match;
          // Quotes pair across JSX tags, so a line like
          // `<Skeleton className="h-10" />` looks like one long "string". A real
          // brand string never contains markup.
          if (body.includes("<") || body.includes(">")) continue;
          if (Object.values(FROZEN_IDENTIFIERS).some((frozen) => term.includes(frozen))) continue;
          report();
        }

        // 2. As JSX text content — the wordmark is the most visible instance,
        //    and `>Skeleton<` is unambiguous: a component would be `<Skeleton`.
        if (/>\s*Skeleton\s*</.test(line)) report();
      });
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the persistence-critical identifiers exactly as they are", () => {
    // If this fails, data written by a previous deploy is now unreadable. These
    // are values, not configuration: making them settable would invite the very
    // change that destroys data.
    expect(FROZEN_IDENTIFIERS.ENCRYPTION_KEY_INFO).toBe("skeleton-data-encryption");
    expect(FROZEN_IDENTIFIERS.DEVICE_COOKIE).toBe("skeleton_device");
  });

  it("actually derives the field-encryption key from the frozen identifier", () => {
    // Guards against someone "cleaning up" the literal in the crypto module
    // while leaving this constant untouched, which would pass every other test
    // here and orphan every encrypted row.
    const source = readFileSync(
      path.join(ROOT, "src/lib/crypto/field-encryption.ts"),
      "utf8",
    );
    expect(source).toContain("FROZEN_IDENTIFIERS.ENCRYPTION_KEY_INFO");
  });

  it("actually uses the frozen device cookie as the cookie name", () => {
    const source = readFileSync(
      path.join(ROOT, "src/modules/devices/devices.service.ts"),
      "utf8",
    );
    expect(source).toContain("FROZEN_IDENTIFIERS.DEVICE_COOKIE");
  });
});