/**
 * Transport lines of Terra Nova (F36, F97): six lines that cross at shared
 * stops, so a route with a change can always be found; one line carries a
 * traffic alert to show the replacement routes.
 *
 * Idempotent: a line is created once (by code); edits made by staff are kept.
 */

import type { prisma as Prisma } from "../src/lib/db/prisma";

type Client = typeof Prisma;

const LINES = [
  { code: "N1", name: "Navette Nova Prime – Skyport", description: "La ligne du spatioport, par le centre.", stops: ["Registre civil", "Place du Haut Conseil", "Marché central", "Quai des navettes", "Spatioport"], firstDeparture: "05:30", lastDeparture: "23:30", headwayMinutes: 10, alert: null },
  { code: "N2", name: "Navette des Serres", description: "De Nova Prime aux serres de Verdant Basin.", stops: ["Place du Haut Conseil", "Hôpital Asclépios", "Halle Greenroot", "Serres nord", "Station de recyclage"], firstDeparture: "06:00", lastDeparture: "22:00", headwayMinutes: 15, alert: null },
  { code: "T3", name: "Tram du Delta", description: "Le long des quais de Sunken Delta.", stops: ["Marché central", "Pont des Marées", "Coral Harbor", "Tidewalk Bazaar", "Caserne du Sud"], firstDeparture: "05:45", lastDeparture: "23:00", headwayMinutes: 12, alert: "Ligne interrompue entre Pont des Marées et Tidewalk Bazaar : montée des eaux sur les quais." },
  { code: "B4", name: "Bus de la Côte", description: "D'Obsidian Coast au centre, par le sud.", stops: ["Phare d'Obsidian", "Caserne du Sud", "Coral Harbor", "Hôpital Asclépios", "Registre civil"], firstDeparture: "06:15", lastDeparture: "21:45", headwayMinutes: 20, alert: null },
  { code: "C5", name: "Câble de Crystal Reach", description: "Le téléphérique des hauteurs, vers les écoles.", stops: ["Marché central", "Écoles de Crystal Reach", "Belvédère", "Observatoire"], firstDeparture: "06:30", lastDeparture: "21:00", headwayMinutes: 15, alert: null },
  { code: "E6", name: "Express Ember – Frostpeak", description: "Le lien entre les secteurs nord et est.", stops: ["Serres nord", "Centrale solaire d'Ember", "Place du Haut Conseil", "Abri de Frostpeak", "Station Givre"], firstDeparture: "06:00", lastDeparture: "22:30", headwayMinutes: 25, alert: null },
] as const;

export async function seedTransports(prisma: Client): Promise<void> {
  let created = 0;
  for (const line of LINES) {
    if (await prisma.transportLine.findUnique({ where: { code: line.code }, select: { id: true } })) continue;
    await prisma.transportLine.create({ data: { ...line, stops: line.stops.join("\n"), published: true } });
    created += 1;
  }
  if (created > 0) console.log(`  transport lines: ${created}`);
}
