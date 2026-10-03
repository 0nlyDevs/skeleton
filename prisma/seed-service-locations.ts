/**
 * Where each municipal service receives people on the city map, plus the
 * city's emergency facilities (hospital, A&E, rescue). Positions are on the
 * map's 1000 × 640 plane; the district is derived from the position, exactly
 * as the API does for admins.
 *
 * Idempotent: a position is only set on a service that has none, and each
 * emergency facility is created once (by slug).
 */

import { zoneAt } from "../src/modules/alerts/city-zones";
import type { prisma as Prisma } from "../src/lib/db/prisma";

type Client = typeof Prisma;

const LOCATIONS: Readonly<Record<string, { x: number; y: number; emergency?: boolean }>> = {
  "etat-civil": { x: 505, y: 300 },
  energie: { x: 700, y: 205 },
  "eau-oxygene": { x: 240, y: 390 },
  transports: { x: 545, y: 322 },
  sante: { x: 455, y: 338, emergency: true },
  logement: { x: 600, y: 300 },
  "proprete-recyclage": { x: 560, y: 470 },
  education: { x: 235, y: 235 },
  "serres-alimentation": { x: 440, y: 190 },
  securite: { x: 475, y: 285, emergency: true },
};

const EMERGENCY = [
  {
    slug: "hopital-central-asclepios",
    name: "Hôpital central Asclépios",
    category: "Urgences",
    icon: "heart-pulse",
    summary: "Urgences adultes et enfants 24 h/24, maternité, réanimation et centre des grands brûlés.",
    description:
      "L'hôpital central accueille toutes les urgences de la cité, jour et nuit. Il dispose d'un service de réanimation, d'une maternité et du seul centre des grands brûlés de Terra Nova.",
    howTo: "En cas d'urgence vitale, appelez le numéro d'urgence ou présentez-vous directement à l'accueil des urgences, entrée nord.",
    phone: "+00 1 15 15 15",
    hours: "Urgences 24 h/24, 7 j/7",
    address: "Dôme Asclépios, entrée nord, Nova Prime",
    x: 470,
    y: 352,
    en: { name: "Asclepios Central Hospital", category: "Emergency", summary: "Adult and child A&E around the clock, maternity, intensive care and the burns unit.", hours: "A&E 24/7" },
  },
  {
    slug: "urgences-verdant-basin",
    name: "Urgences de Verdant Basin",
    category: "Urgences",
    icon: "heart-pulse",
    summary: "Accueil des urgences du nord : blessures, malaises, coups de chaleur.",
    description: "Antenne d'urgence pour les quartiers du nord, renforcée pendant les vagues de chaleur.",
    howTo: "Présentez-vous à l'accueil avec votre carte de résident. Les cas graves sont transférés à l'hôpital central.",
    phone: "+00 1 15 15 20",
    hours: "24 h/24",
    address: "Rue des Canopées, près de Greenroot Market",
    x: 455,
    y: 165,
    en: { name: "Verdant Basin A&E", category: "Emergency", summary: "Emergency care for the north: injuries, faintness, heat stroke.", hours: "24/7" },
  },
  {
    slug: "caserne-de-secours-du-sud",
    name: "Caserne de secours du Sud",
    category: "Urgences",
    icon: "shield",
    summary: "Pompiers et sauvetage nautique pour Sunken Delta et Obsidian Coast.",
    description: "La caserne du sud intervient sur les incendies, les inondations et les sauvetages en mer autour du delta et de la côte.",
    howTo: "En cas d'incendie, d'inondation ou de personne en danger dans l'eau, appelez immédiatement le numéro d'urgence.",
    phone: "+00 1 18 18 18",
    hours: "24 h/24",
    address: "Quai de Coral Harbor, Sunken Delta",
    x: 255,
    y: 440,
    en: { name: "South Rescue Station", category: "Emergency", summary: "Fire and water rescue for Sunken Delta and Obsidian Coast.", hours: "24/7" },
  },
  {
    slug: "poste-medical-du-spaceport",
    name: "Poste médical du spaceport",
    category: "Urgences",
    icon: "heart-pulse",
    summary: "Premiers secours et décompression pour les voyageurs et les habitants de l'est.",
    description: "Le poste médical prend en charge les premiers secours et les accidents de décompression autour du spaceport et des Skyport Isles.",
    howTo: "Rendez-vous au niveau des départs, porte 3, ou demandez à n'importe quel agent du spaceport.",
    phone: "+00 1 15 15 40",
    hours: "24 h/24",
    address: "Terminal des départs, porte 3, Skyport Isles",
    x: 795,
    y: 400,
    en: { name: "Spaceport Medical Post", category: "Emergency", summary: "First aid and decompression care for travellers and the east.", hours: "24/7" },
  },
] as const;

export async function seedServiceLocations(prisma: Client): Promise<void> {
  for (const [slug, location] of Object.entries(LOCATIONS)) {
    const zone = zoneAt(location.x, location.y);
    if (!zone) throw new Error(`Seed location for ${slug} is not inside a district.`);
    await prisma.municipalService.updateMany({
      where: { slug, mapX: null },
      data: { mapX: location.x, mapY: location.y, zone, emergency: location.emergency ?? false },
    });
  }

  let created = 0;
  for (const [index, facility] of EMERGENCY.entries()) {
    if (await prisma.municipalService.findUnique({ where: { slug: facility.slug }, select: { id: true } })) continue;
    const zone = zoneAt(facility.x, facility.y);
    if (!zone) throw new Error(`Seed location for ${facility.slug} is not inside a district.`);
    const { x, y, en, ...fields } = facility;
    await prisma.municipalService.create({
      data: { ...fields, mapX: x, mapY: y, zone, emergency: true, sortOrder: 100 + index, translations: { en: { ...en } } },
    });
    created += 1;
  }
  if (created > 0) console.log(`  emergency facilities: ${created}`);
}
