import type { PageBlock } from "@/modules/pages/pages.schema";

export interface PageTemplate {
  readonly key: "blank" | "farewell" | "country" | "launch" | "event" | "tribute";
  readonly theme: string;
  readonly font: string;
  readonly title: string;
  readonly tagline: string;
  readonly blocks: PageBlock[];
}

const id = (prefix: string, index: number) => `${prefix}${index}`;
const inMonths = (months: number) => new Date(Date.now() + months * 30 * 86_400_000).toISOString();

/** Starting points: a team can adapt any of them to the contest subject in minutes. */
export const PAGE_TEMPLATES: readonly PageTemplate[] = [
  { key: "blank", theme: "aurora", font: "sans", title: "Ma page", tagline: "", blocks: [] },
  {
    key: "farewell",
    theme: "night",
    font: "serif",
    title: "C'est la fin",
    tagline: "Merci pour tout. Voici comment je veux dire au revoir.",
    blocks: [
      { id: id("f", 1), type: "text", text: "Après tout ce chemin parcouru ensemble, il est temps de tourner la page." },
      { id: id("f", 2), type: "timeline", items: [
        { date: "Le début", title: "On s'est lancés", text: "" },
        { date: "Le meilleur", title: "Les moments qui comptent", text: "" },
        { date: "Aujourd'hui", title: "Le mot de la fin", text: "" },
      ] },
      { id: id("f", 3), type: "quote", text: "Ce n'est qu'un au revoir.", author: "" },
    ],
  },
  {
    key: "country",
    theme: "ocean",
    font: "sans",
    title: "République de Nouvelle-Île",
    tagline: "Site officiel d'un pays qui n'existe (presque) pas.",
    blocks: [
      { id: id("c", 1), type: "stats", items: [
        { value: "1", label: "île" },
        { value: "42 000", label: "habitants" },
        { value: "365", label: "jours de soleil" },
      ] },
      { id: id("c", 2), type: "heading", text: "Notre histoire", level: 2 },
      { id: id("c", 3), type: "text", text: "Racontez la fondation, les traditions et les lois étonnantes du pays." },
      { id: id("c", 4), type: "heading", text: "Venir chez nous", level: 2 },
      { id: id("c", 5), type: "link", label: "Demander un visa", url: "https://example.com" },
    ],
  },
  {
    key: "launch",
    theme: "sunset",
    font: "sans",
    title: "L'invention qui change tout",
    tagline: "Présentez votre produit en une page.",
    blocks: [
      { id: id("l", 1), type: "stats", items: [
        { value: "3x", label: "plus rapide" },
        { value: "0", label: "émission" },
      ] },
      { id: id("l", 2), type: "heading", text: "Comment ça marche", level: 2 },
      { id: id("l", 3), type: "text", text: "Expliquez le problème, la solution et ce qui la rend unique." },
      { id: id("l", 4), type: "countdown", at: inMonths(1), label: "Lancement dans" },
      { id: id("l", 5), type: "link", label: "Précommander", url: "https://example.com" },
    ],
  },
  {
    key: "event",
    theme: "forest",
    font: "sans",
    title: "Le grand rendez-vous",
    tagline: "Date, lieu, programme : tout est ici.",
    blocks: [
      { id: id("e", 1), type: "countdown", at: inMonths(2), label: "Rendez-vous dans" },
      { id: id("e", 2), type: "heading", text: "Programme", level: 2 },
      { id: id("e", 3), type: "timeline", items: [
        { date: "10 h", title: "Accueil", text: "" },
        { date: "14 h", title: "Temps fort", text: "" },
      ] },
      { id: id("e", 4), type: "link", label: "Je participe", url: "https://example.com" },
    ],
  },
  {
    key: "tribute",
    theme: "paper",
    font: "serif",
    title: "En hommage",
    tagline: "Quelques mots, quelques images, beaucoup de souvenirs.",
    blocks: [
      { id: id("t", 1), type: "text", text: "Écrivez ici votre message." },
      { id: id("t", 2), type: "quote", text: "Les souvenirs sont le parfum de l'âme.", author: "George Sand" },
    ],
  },
];
