/**
 * D10/F91/F92 — finding the right service from a badly written need.
 *
 * Pure scoring, no network: the text is folded (accents, case), each word is
 * matched to every service's words with tolerance for typos, plurals and word
 * starts, a table of everyday words ("robinet", "loyer", "bus") points to the
 * services that handle them, and the local text embedding adds a sense of
 * overall meaning. The result is a ranked list with the words that matched,
 * so the answer can say why.
 */

import { cosine, localEmbedding } from "@/lib/ai/vectors";

export interface ServiceCandidate {
  readonly slug: string;
  readonly name: string;
  readonly category: string;
  readonly summary: string;
  readonly description: string;
  readonly howTo: string | null;
  readonly emergency: boolean;
}

export interface ScoredService {
  readonly slug: string;
  readonly score: number;
  /** The words of the resident that led here, in their own spelling. */
  readonly matched: string[];
}

/** Everyday words a resident uses, and the service that answers them. */
export const EVERYDAY: Readonly<Record<string, string>> = {
  "etat-civil": "naissance naitre bebe mariage marier pacs deces carte residence resident identite papier papiers passeport acte extrait nom famille inscription arrivee arriver nouveau nouvelle habitant declaration",
  energie: "electricite electrique courant lumiere lampe lampadaire eclairage panne coupure solaire panneau panneaux batterie compteur facture energie reseau prise",
  "eau-oxygene": "eau robinet fuite douche tuyau canalisation oxygene air respirer respiration potable arrosage humidite inondation",
  transports: "bus navette maglev train metro ligne arret horaire horaires billet abonnement gare velo trajet voyage deplacement retard station",
  sante: "sante medecin docteur malade maladie douleur fievre hopital soin soins vaccin vaccination medicament ordonnance infirmier consultation mal",
  logement: "logement maison appartement module habitation loyer louer demenager demenagement chambre reparation fuite toit chauffage voisin voisins chez",
  "proprete-recyclage": "poubelle poubelles dechet dechets ordures recyclage tri trier propre sale encombrant encombrants nettoyage depot",
  education: "ecole college lycee universite eleve enfant enfants cours inscription scolaire cantine professeur formation apprendre",
  "serres-alimentation": "nourriture manger legume legumes fruit fruits marche serre serres alimentation agricole culture panier repas",
  securite: "securite police danger voleur vol agression incendie feu pompier urgence secours accident menace bagarre protection",
};

/** Words that mean "someone may be in danger": emergency services come first. */
const DANGER = /\b(urgence|urgent|danger|incendie|feu|agression|accident|inconscient|ne respire|saigne|blesse|secours|au secours|malaise|noye|noyade|menace)\b/;

function fold(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOP = new Set("a au aux avec ce ces dans de des du elle en et il ils je j la le les leur lui ma mais me mes mon ne nos notre nous on ou par pas pour qui que quoi sa se ses son sur ta te tes ton tu un une vos votre vous y est sont suis ai as ont avoir etre faire fait veux voudrais peux puis comment ou quand quel quelle quels besoin souhaite cherche chercher trouver aide aider svp bonjour merci the my i is to of and for how can want need please".split(" "));

export function wordsOf(text: string): string[] {
  return fold(text).split(" ").filter((word) => word.length > 1 && !STOP.has(word));
}

function distance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0] as number;
    row[0] = i;
    let best = row[0];
    for (let j = 1; j <= b.length; j += 1) {
      const temp = row[j] as number;
      row[j] = Math.min((row[j] as number) + 1, (row[j - 1] as number) + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = temp;
      best = Math.min(best, row[j] as number);
    }
    if (best > limit) return limit + 1;
  }
  return row[b.length] as number;
}

/** How well one word of the resident matches one word of a service, 0 to 1. */
export function wordMatch(word: string, target: string): number {
  if (word === target) return 1;
  if (word.length >= 4 && (target.startsWith(word) || word.startsWith(target.slice(0, Math.max(4, target.length - 2))))) return target.length >= 4 ? 0.8 : 0;
  const limit = word.length >= 8 ? 2 : word.length >= 5 ? 1 : 0;
  return limit > 0 && distance(word, target, limit) <= limit ? 0.65 : 0;
}

function fieldScore(words: readonly string[], field: string, weight: number, matched: Set<string>): number {
  const targets = [...new Set(fold(field).split(" ").filter((word) => word.length > 2))];
  let score = 0;
  for (const word of words) {
    let best = 0;
    for (const target of targets) best = Math.max(best, wordMatch(word, target));
    if (best > 0) matched.add(word);
    score += best * weight;
  }
  return score;
}

export function scoreServices(text: string, services: readonly ServiceCandidate[]): ScoredService[] {
  const words = wordsOf(text);
  if (words.length === 0) return [];
  const query = localEmbedding(text);
  const danger = DANGER.test(fold(text));
  return services
    .map((service) => {
      const matched = new Set<string>();
      let score = 0;
      score += fieldScore(words, service.name, 3, matched);
      score += fieldScore(words, EVERYDAY[service.slug] ?? "", 2.5, matched);
      score += fieldScore(words, service.category, 1.5, matched);
      score += fieldScore(words, service.summary, 1.5, matched);
      score += fieldScore(words, `${service.description} ${service.howTo ?? ""}`, 0.8, matched);
      // Overall sense of the sentence, for what no single word gives away.
      score += Math.max(0, cosine(query, localEmbedding(`${service.name} ${service.summary} ${service.description}`))) * 4;
      if (danger && service.emergency) score += 6;
      return { slug: service.slug, score: Math.round(score * 100) / 100, matched: [...matched] };
    })
    .filter((entry) => entry.score > 0.9)
    .sort((a, b) => b.score - a.score);
}

export function looksUrgent(text: string): boolean {
  return DANGER.test(fold(text));
}
