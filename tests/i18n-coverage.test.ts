import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { en } from "@/lib/i18n/dictionaries/en";
import { fr } from "@/lib/i18n/dictionaries/fr";
import { localizeServerMessage } from "@/lib/i18n/server-messages";

const ROOT = path.resolve(__dirname, "..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "generated" || name === "i18n" ? [] : sources(full);
    return full.endsWith(".ts") ? [full] : [];
  });
}

// Messages that end up in front of users: thrown errors, ack messages and
// validation messages written as plain English sentences.
const PATTERNS = [
  /Error\(\s*"([^"]+)"/g,
  /message:\s*"([^"]+)"/g,
  /\.(?:min|max|regex|length|email|url)\([^)]*?,\s*"([^"]+)"\)/g,
  /refine\([^,]+,\s*"([^"]+)"/g,
];
// Operator-only messages (logs, misconfiguration) that never reach the UI.
const INTERNAL = new Set([
  "AI provider returned an empty completion.",
  "Refusing to encrypt the unreadable marker.",
  "Refusing to resolve an unsafe filename.",
  "Refusing to resolve a path outside the upload directory.",
  "The request could not reach the server.",
  "The server returned an unexpected response.",
]);

describe("French interface", () => {
  it("has a French string for every interface key", () => {
    expect(Object.keys(en).filter((key) => !(key in fr))).toEqual([]);
  });

  it("translates every user-facing server message", () => {
    const missing: string[] = [];
    for (const file of ["src/modules", "src/lib", "src/app/api"].flatMap((dir) => sources(path.join(ROOT, dir)))) {
      const text = readFileSync(file, "utf8");
      for (const pattern of PATTERNS) {
        for (const match of text.matchAll(pattern)) {
          const message = match[1] ?? "";
          if (!/^[A-Z].*[.!?]$/.test(message) || INTERNAL.has(message)) continue;
          if (localizeServerMessage(message, "fr") === message) missing.push(`${path.relative(ROOT, file)}: ${message}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
