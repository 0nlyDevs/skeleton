/**
 * F86 — a medical emergency is not an ordinary request. Words that describe
 * one move the request to the top of the agents' list at once; the resident
 * is told to call the emergency number first. Pure, so it is tested.
 */

const PATTERNS: readonly RegExp[] = [
  /\burgence (medicale|vitale)\b/,
  /\b(ne respire (plus|pas)|respire (plus|mal)|etouffe|s etouffe)\b/,
  /\b(inconscient|inconsciente|evanoui|evanouie|malaise|convulsion|convulsions)\b/,
  /\b(crise cardiaque|infarctus|arret cardiaque|douleur (a la|dans la) poitrine|avc)\b/,
  /\b(hemorragie|saigne beaucoup|saignement (important|abondant))\b/,
  /\b(overdose|empoisonnement|intoxication|brulure grave|noyade|decompression)\b/,
  /\b(medical emergency|not breathing|unconscious|heart attack|stroke|severe bleeding|choking|seizure)\b/,
];

function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ");
}

export function isMedicalEmergency(...texts: readonly (string | null | undefined)[]): boolean {
  const folded = fold(texts.filter(Boolean).join(" "));
  return PATTERNS.some((pattern) => pattern.test(folded));
}

/** The city's emergency number, as shown on the emergency services. */
export const EMERGENCY_PHONE = "+00 1 15 15 15";
