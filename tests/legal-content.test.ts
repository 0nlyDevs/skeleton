import { describe, expect, it } from "vitest";

import { getLegalDocument } from "@/content/legal";
import type { LegalDocument } from "@/content/legal";

/**
 * The legal documents are the one place where a silent omission is a
 * compliance problem rather than a layout bug. A section that exists in
 * French and not in English is invisible in code review — both files are
 * plausible, both typecheck, and the page renders.
 *
 * These assertions are about *structure*. Whether the prose is legally sound is
 * not something a test can decide.
 */
describe("legal documents", () => {
  const slugs = ["privacy", "terms"] as const satisfies readonly LegalDocument["slug"][];

  it("carries every section in both languages", () => {
    for (const slug of slugs) {
      const en = getLegalDocument(slug, "en");
      const fr = getLegalDocument(slug, "fr");

      expect(fr.sections.map((section) => section.id)).toEqual(
        en.sections.map((section) => section.id),
      );
    }
  });

  it("agrees on the last-updated date, so neither locale claims a newer policy", () => {
    for (const slug of slugs) {
      expect(getLegalDocument(slug, "fr").updated).toBe(getLegalDocument(slug, "en").updated);
    }
  });

  it("gives every section a unique id, or the table of contents links break", () => {
    for (const slug of slugs) {
      for (const locale of ["en", "fr"] as const) {
        const ids = getLegalDocument(slug, locale).sections.map((section) => section.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("translates every heading rather than leaving the English in place", () => {
    for (const slug of slugs) {
      const en = getLegalDocument(slug, "en");
      const fr = getLegalDocument(slug, "fr");

      for (const [index, section] of en.sections.entries()) {
        expect(fr.sections[index]?.title).not.toBe(section.title);
      }
    }
  });

  it("names a sub-processor for every row of the processing table", () => {
    // An empty cell in a sub-processor table reads as "we do not disclose
    // this" rather than "we forgot", so both cells must have content.
    const processors = getLegalDocument("privacy", "en").sections.find(
      (section) => section.id === "processors",
    );

    expect(processors?.rows?.length ?? 0).toBeGreaterThan(0);
    for (const [term, detail] of processors?.rows ?? []) {
      expect(term.trim()).not.toBe("");
      expect(detail.trim()).not.toBe("");
    }
  });

  it("marks the subject-dependent sections, so they cannot be mistaken for settled", () => {
    // These are the paragraphs a team must revisit once the H-0 subject is
    // known. If the marker is dropped the gap becomes invisible.
    const privacy = getLegalDocument("privacy", "en");
    const subject = privacy.sections.filter((section) => section.subject);

    expect(subject.length).toBeGreaterThan(0);
    for (const section of subject) {
      expect(section.paragraphs.length + (section.bullets?.length ?? 0)).toBeGreaterThan(0);
    }
  });

  it("falls back to French rather than returning nothing for an unknown locale", () => {
    // The dictionary is French-first by product decision; the legal documents
    // must behave the same way rather than rendering an empty page.
    const fallback = getLegalDocument("privacy", "zz" as never);
    expect(fallback.sections.length).toBeGreaterThan(0);
  });
});