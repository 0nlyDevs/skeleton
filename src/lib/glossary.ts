/**
 * D13 — the words of the platform that may need explaining. Each id has a
 * term and a plain-language definition in the dictionaries
 * (`tn.glossary.term.<id>`, `tn.glossary.def.<id>`), shown inline by
 * `<Term>` and listed on the glossary page.
 */
export const GLOSSARY_IDS = ["procedure", "reference", "taken_on", "waiting", "resolved", "closed", "report", "municipal_service", "agent", "encrypted", "two_factor", "backup_codes", "alert", "high_contrast", "eco_mode"] as const;

export type GlossaryId = (typeof GLOSSARY_IDS)[number];
