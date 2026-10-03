/**
 * Shape of the legal documents. See `./en.ts` for why this is structured data
 * rather than dictionary keys.
 */

export type LegalSection = {
  /** Stable anchor id, also used to cross-reference between the two documents. */
  readonly id: string;
  /**
   * `subject: true` marks the part that depends on what the product is about.
   *
   * The platform core below it is fixed by the code and survives any subject;
   * these sections are the ones to revisit once the H-0 subject is known.
   */
  readonly subject?: boolean;
  readonly title: string;
  readonly paragraphs: readonly string[];
  /** Two-column rows, e.g. the sub-processor table. */
  readonly rows?: readonly (readonly [string, string])[];
  /** Bulleted list rendered under the paragraphs. */
  readonly bullets?: readonly string[];
};

export type LegalDocument = {
  readonly slug: "privacy" | "terms";
  /** ISO date of the last substantive change, rendered through `legal.updated`. */
  readonly updated: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
};

export type LegalBundle = {
  readonly documents: Record<LegalDocument["slug"], LegalDocument>;
};
