import { describe, expect, it } from "vitest";

import { localEmbedding } from "@/lib/ai/vectors";
import { clusterItems } from "@/modules/city-requests/city-requests.similar";
import { isMedicalEmergency } from "@/modules/city-requests/city-requests.emergency";

const item = (text: string) => ({ text, vector: localEmbedding(text) });

describe("similar requests (F75)", () => {
  it("gathers requests about the same problem and keeps others apart", () => {
    const groups = clusterItems([
      item("Lampadaire éteint rue des Canopées lampadaire éteint depuis lundi"),
      item("Le lampadaire de la rue des Canopées est éteint, lampadaire éteint la nuit"),
      item("Lampadaire éteint devant la halle des Canopées"),
      item("Demande de carte de résident pour mon fils"),
    ]);
    const sizes = groups.map((group) => group.length).sort();
    expect(sizes).toEqual([1, 3]);
  });
});

describe("medical emergency words (F86)", () => {
  it("recognises an emergency, with or without accents", () => {
    expect(isMedicalEmergency("Mon voisin est inconscient et ne respire plus")).toBe(true);
    expect(isMedicalEmergency("Urgence médicale au dôme nord")).toBe(true);
    expect(isMedicalEmergency("Question sur la carte de résident", "Je voudrais renouveler ma carte")).toBe(false);
  });
});
