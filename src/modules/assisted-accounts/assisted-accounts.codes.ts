/**
 * F71 — pure helpers for assisted accounts: the printed access code and the
 * username derived from a name. Kept apart from the service so they can be
 * tested without a database.
 */

import { randomInt } from "node:crypto";

/** No look-alike characters (0/O, 1/l/I): the code is copied by hand. */
const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";

/** Never the same character twice in a row: easier to copy, and the password policy refuses repeats. */
function pick(alphabet: string, length: number): string {
  let out = "";
  while (out.length < length) {
    const next = alphabet[randomInt(alphabet.length)] ?? "";
    if (next !== out.at(-1)) out += next;
  }
  return out;
}

/** e.g. "KQTR-mxpa-4827!": every character class the password policy asks for. */
export function newAccessCode(): string {
  return `${pick(UPPER, 4)}-${pick(LOWER, 4)}-${pick(DIGITS, 4)}!`;
}

/** "Amina Rahal" → "amina.rahal" (accents dropped, only allowed characters). */
export function baseUsername(firstName: string, lastName: string): string {
  const clean = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  const base = [clean(firstName), clean(lastName)].filter(Boolean).join(".").slice(0, 22).replace(/\.$/, "");
  return base.length >= 3 ? base : `habitant${base}`;
}
