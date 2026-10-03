import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * A migration is raw SQL, so a JavaScript-style escape is not corrected by
 * anything downstream. MySQL reads `\\` in a string literal as one backslash and
 * `\n` as a real line feed, and the result is then parsed as JSON. That means a
 * line break inside a JSON string *must* be written `\\n` in the migration: one
 * level of escaping for MySQL, one for JSON. Writing `\n` looks right and stores
 * a raw control character, which is not valid JSON at all.
 *
 * These tests read the SQL rather than a database, so the trap is caught at
 * review time instead of as a `JSON.parse` failure in production.
 */
const migrationsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "prisma", "migrations");

/** One left-to-right pass, matching how MySQL reads a `'...'` literal. */
function mysqlUnescape(literal: string): string {
  let out = "";
  for (let i = 0; i < literal.length; i += 1) {
    if (literal[i] !== "\\") {
      out += literal[i];
      continue;
    }
    const next = literal[i + 1];
    i += 1;
    if (next === "n") out += "\n";
    else if (next === "t") out += "\t";
    else if (next === "r") out += "\r";
    else if (next === "0") out += "\0";
    else out += next === "\\" ? "\\" : next === "'" ? "'" : next;
  }
  return out;
}

/** Single-quoted literals that hold a JSON document. */
function jsonLiterals(sql: string): string[] {
  return [...sql.matchAll(/'(\{[\s\S]*?\})'/g)].map((match) => mysqlUnescape(match[1] ?? ""));
}

const migrations = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({ name: entry.name, sql: readFileSync(path.join(migrationsDir, entry.name, "migration.sql"), "utf8") }))
  .map((entry) => ({ ...entry, documents: jsonLiterals(entry.sql) }))
  .filter((entry) => entry.documents.length > 0);

describe("JSON written by migrations", () => {
  it("checks at least one migration that writes JSON", () => {
    expect(migrations.length).toBeGreaterThan(0);
  });

  it.each(migrations)("$name stores JSON the reader can parse", ({ documents }) => {
    for (const document of documents) {
      expect(() => JSON.parse(document)).not.toThrow();
    }
  });

  it("keeps the numbered steps of a translated service readable as separate lines", () => {
    const wave2 = migrations.find((entry) => entry.name.includes("wave_2"));
    expect(wave2).toBeDefined();
    const civilRegistry = wave2?.documents.find((document) => document.includes("Civil registry"));
    expect(civilRegistry).toBeDefined();
    // Two escaped line breaks are what turn "1. ... 2. ... 3." into three lines.
    expect((JSON.parse(civilRegistry ?? "{}").en.howTo ?? "").split("\n")).toHaveLength(3);
  });
});