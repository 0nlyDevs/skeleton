/**
 * F74 — partner associations (hours and place at a glance) and structured
 * opening hours for the city's own services.
 *
 * Idempotent: an association is created once (by slug), and hours are only
 * set on a service that has none, so an administrator's edits are kept.
 */

import { zoneAt } from "../src/modules/alerts/city-zones";
import type { prisma as Prisma } from "../src/lib/db/prisma";
import type { OpeningHours } from "../src/modules/city-services/opening-hours";

type Client = typeof Prisma;

const weekdays = (open: string, close: string): OpeningHours => ({
  mon: { open, close },
  tue: { open, close },
  wed: { open, close },
  thu: { open, close },
  fri: { open, close },
  sat: null,
  sun: null,
});

const ALWAYS: OpeningHours = {
  mon: { open: "00:00", close: "23:59" },
  tue: { open: "00:00", close: "23:59" },
  wed: { open: "00:00", close: "23:59" },
  thu: { open: "00:00", close: "23:59" },
  fri: { open: "00:00", close: "23:59" },
  sat: { open: "00:00", close: "23:59" },
  sun: { open: "00:00", close: "23:59" },
};

/** Hours of the city's own counters, by service slug. */
const CITY_HOURS: Readonly<Record<string, OpeningHours>> = {
  "etat-civil": { ...weekdays("08:30", "17:00"), sat: { open: "09:00", close: "12:00" } },
  energie: weekdays("09:00", "17:00"),
  "eau-oxygene": weekdays("08:00", "18:00"),
  transports: { ...weekdays("07:00", "19:00"), sat: { open: "08:00", close: "16:00" } },
  logement: weekdays("09:00", "16:30"),
  "proprete-recyclage": { ...weekdays("08:00", "17:00"), sat: { open: "08:00", close: "12:00" } },
  education: weekdays("08:00", "16:00"),
  "serres-alimentation": { ...weekdays("07:00", "18:00"), sat: { open: "07:00", close: "13:00" } },
  sante: ALWAYS,
  securite: ALWAYS,
  "hopital-central-asclepios": ALWAYS,
  "urgences-verdant-basin": ALWAYS,
  "caserne-de-secours-du-sud": ALWAYS,
  "poste-medical-du-spaceport": ALWAYS,
};

const PARTNERS = [
  {
    slug: "association-passerelle",
    name: "Association Passerelle",
    category: "Associations partenaires",
    icon: "users",
    summary: "Accueil des nouveaux habitants : aide aux premières démarches, cours de langue, accompagnement.",
    description:
      "Les bénévoles de Passerelle accueillent les nouveaux habitants de Terra Nova. Ils aident à remplir les premières démarches, proposent des cours de langue gratuits et accompagnent les familles pendant leurs premières semaines.",
    howTo: "Venez sans rendez-vous aux heures d'ouverture, avec votre carte de résident si vous en avez une. Un bénévole vous reçoit en français ou en anglais.",
    phone: "+00 1 40 22 10",
    email: "bonjour@passerelle.example",
    hours: "Sans rendez-vous. Accueil en français et en anglais.",
    address: "12 allée des Arrivées, à côté du registre civil, Nova Prime",
    x: 520,
    y: 330,
    openingHours: { ...weekdays("09:00", "18:00"), sat: { open: "10:00", close: "14:00" } } satisfies OpeningHours,
    en: {
      name: "Passerelle Association",
      category: "Partner associations",
      summary: "Welcome for new residents: help with first procedures, language classes, support.",
      description:
        "Passerelle volunteers welcome new residents of Terra Nova. They help with the first procedures, give free language classes and support families during their first weeks.",
      howTo: "Come without an appointment during opening hours, with your resident card if you have one. A volunteer receives you in French or English.",
      hours: "No appointment needed. French and English spoken.",
    },
  },
  {
    slug: "banque-alimentaire-des-serres",
    name: "Banque alimentaire des Serres",
    category: "Associations partenaires",
    icon: "leaf",
    summary: "Paniers de légumes et produits de base pour les foyers en difficulté. Dons acceptés.",
    description:
      "La banque alimentaire distribue chaque semaine des paniers issus des serres de Verdant Basin. Elle reçoit aussi les dons des habitants et des cantines de la ville.",
    howTo: "Présentez-vous avec un sac. La première fois, un bénévole note seulement le nombre de personnes de votre foyer.",
    phone: "+00 1 40 31 55",
    email: null,
    hours: "Distribution les mardis, jeudis et samedis.",
    address: "Halle 3 du marché Greenroot, Verdant Basin",
    x: 430,
    y: 175,
    openingHours: { mon: null, tue: { open: "14:00", close: "19:00" }, wed: null, thu: { open: "14:00", close: "19:00" }, fri: null, sat: { open: "09:00", close: "13:00" }, sun: null } satisfies OpeningHours,
    en: {
      name: "Greenhouse Food Bank",
      category: "Partner associations",
      summary: "Vegetable baskets and staples for households in need. Donations welcome.",
      description: "The food bank hands out weekly baskets from the Verdant Basin greenhouses. It also takes donations from residents and city canteens.",
      howTo: "Come with a bag. The first time, a volunteer only notes how many people live in your home.",
      hours: "Distribution on Tuesdays, Thursdays and Saturdays.",
    },
  },
  {
    slug: "atelier-reparation-solidaire",
    name: "Atelier de réparation solidaire",
    category: "Associations partenaires",
    icon: "wrench",
    summary: "Réparez vos objets avec des bénévoles : petit électroménager, vélos, combinaisons.",
    description:
      "À l'atelier, des bénévoles vous aident à réparer vous-même ce qui peut encore servir : petit électroménager, vélos, combinaisons de sortie. Les pièces de récupération sont gratuites.",
    howTo: "Apportez l'objet à réparer. Comptez une heure sur place. Les grosses réparations se font sur rendez-vous par téléphone.",
    phone: "+00 1 40 47 08",
    email: "atelier@reparation-solidaire.example",
    hours: "Dernier accueil 45 minutes avant la fermeture.",
    address: "Hangar 7, quai de Coral Harbor, Sunken Delta",
    x: 280,
    y: 420,
    openingHours: { mon: null, tue: null, wed: { open: "10:00", close: "17:00" }, thu: { open: "10:00", close: "17:00" }, fri: { open: "10:00", close: "17:00" }, sat: { open: "10:00", close: "17:00" }, sun: null } satisfies OpeningHours,
    en: {
      name: "Community Repair Workshop",
      category: "Partner associations",
      summary: "Repair your things with volunteers: small appliances, bikes, suits.",
      description: "At the workshop, volunteers help you repair what can still be used: small appliances, bikes, outdoor suits. Salvaged parts are free.",
      howTo: "Bring the item to repair. Allow one hour on site. Large repairs are by appointment over the phone.",
      hours: "Last admission 45 minutes before closing.",
    },
  },
] as const;

/** F51 — where a resident's concern about how their data is used goes. */
const DATA_SERVICE = {
  slug: "donnees-personnelles",
  name: "Protection des données personnelles",
  category: "Vie privée",
  icon: "shield",
  summary: "Une question ou une inquiétude sur la façon dont vos données sont utilisées ? Écrivez-nous : vous suivez la réponse ici.",
  description:
    "Ce service répond aux habitants qui s'interrogent sur leurs données : ce qui est conservé, qui y accède, comment les corriger ou les supprimer. Chaque inquiétude reçoit une référence, une réponse écrite et reste consultable dans votre espace.",
  howTo: "Depuis « Mes données », choisissez « Signaler une inquiétude » et décrivez ce qui vous gêne. Vous êtes prévenu à chaque étape.",
  hours: "Réponse sous 3 jours ouvrés",
  en: { name: "Personal data protection", category: "Privacy", summary: "A question or concern about how your data is used? Write to us: you follow the answer here.", hours: "Answer within 3 working days" },
} as const;

export async function seedPartners(prisma: Client): Promise<void> {
  if (!(await prisma.municipalService.findUnique({ where: { slug: DATA_SERVICE.slug }, select: { id: true } }))) {
    const { en, ...fields } = DATA_SERVICE;
    await prisma.municipalService.create({ data: { ...fields, sortOrder: 300, translations: { en: { ...en } } } });
  }

  let hours = 0;
  for (const [slug, openingHours] of Object.entries(CITY_HOURS)) {
    const service = await prisma.municipalService.findUnique({ where: { slug }, select: { id: true, openingHours: true } });
    if (!service || service.openingHours !== null) continue;
    await prisma.municipalService.update({ where: { id: service.id }, data: { openingHours } });
    hours += 1;
  }

  let created = 0;
  for (const [index, partner] of PARTNERS.entries()) {
    if (await prisma.municipalService.findUnique({ where: { slug: partner.slug }, select: { id: true } })) continue;
    const zone = zoneAt(partner.x, partner.y);
    if (!zone) throw new Error(`Seed location for ${partner.slug} is not inside a district.`);
    const { x, y, en, ...fields } = partner;
    await prisma.municipalService.create({
      data: { ...fields, mapX: x, mapY: y, zone, partner: true, sortOrder: 200 + index, translations: { en: { ...en } } },
    });
    created += 1;
  }
  console.log(`  partner associations: ${created} created, opening hours set on ${hours} services`);
}
