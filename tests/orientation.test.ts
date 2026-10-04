import { describe, expect, it } from "vitest";

import { scoreServices, type ServiceCandidate } from "@/modules/orientation/orientation.score";
import { simplify } from "@/modules/plain/plain.service";

const service = (slug: string, name: string, summary: string, emergency = false): ServiceCandidate => ({ slug, name, category: name, summary, description: summary, howTo: null, emergency });
const SERVICES = [
  service("eau-oxygene", "Eau et oxygène", "Distribution de l'eau, de l'air respirable et signalement des fuites."),
  service("etat-civil", "État civil et citoyenneté", "Naissances, mariages, cartes de résident."),
  service("transports", "Transports et navettes", "Lignes de maglev, horaires et abonnements."),
  service("securite", "Sécurité et protection civile", "Secours, incendies et urgences.", true),
  service("logement", "Logement et modules", "Attribution et réparation des modules d'habitation."),
];

const best = (text: string) => scoreServices(text, SERVICES)[0]?.slug;

describe("orientation (D10, F91, F92)", () => {
  it("finds the service from everyday words", () => {
    expect(best("mon robinet fuit")).toBe("eau-oxygene");
    expect(best("je veux la carte de résident pour mon fils")).toBe("etat-civil");
    expect(best("à quelle heure passe le bus ?")).toBe("transports");
  });

  it("survives spelling mistakes and missing accents", () => {
    expect(best("mon robnet fui dans la cuisine")).toBe("eau-oxygene");
    expect(best("carte de residant")).toBe("etat-civil");
    expect(best("naisance de mon bebe")).toBe("etat-civil");
  });

  it("puts emergency services first when someone is in danger", () => {
    expect(best("il y a un incendie chez mon voisin")).toBe("securite");
  });

  it("returns nothing for a sentence about nothing", () => {
    expect(scoreServices("zzz qqq", SERVICES)).toEqual([]);
  });
});

describe("plain language (F89, F90)", () => {
  it("splits long administrative sentences, swaps hard phrases and keeps every number", async () => {
    const text = "Afin de solliciter votre carte, veuillez acquitter la somme de 25 crédits, puis vous munir de pièces justificatives de moins de 3 mois.";
    const { lines } = await simplify(text, "fr");
    const joined = lines.join(" ");
    expect(joined).toContain("25");
    expect(joined).toContain("3 mois");
    expect(joined).not.toMatch(/acquitter|solliciter|veuillez/i);
  });
});
