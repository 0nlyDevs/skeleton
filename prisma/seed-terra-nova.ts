/**
 * Terra Nova demo data: municipal services, city announcements and a few
 * citizen requests with answers, so every screen has something real to show.
 *
 * Idempotent: services and announcements are upserted by slug, and sample
 * requests (owned by the first citizen account) are created once per reference.
 */

import { encryptField } from "../src/lib/crypto/field-encryption";
import type { prisma as Prisma } from "../src/lib/db/prisma";

import { FEATURED_SERVICES, SERVICE_TRANSLATIONS_EN } from "./seed-terra-nova.en";

type Client = typeof Prisma;
type SeedUser = { id: string; role: string };

const SERVICES = [
  {
    slug: "etat-civil",
    name: "État civil et citoyenneté",
    category: "Démarches",
    icon: "id-card",
    summary: "Enregistrement des nouveaux habitants, naissances, unions et cartes de résident.",
    description:
      "Le service d'état civil tient le registre des habitants de Terra Nova. Il délivre la carte de résident, enregistre les naissances et les unions, et met à jour votre dossier quand vous changez de module d'habitation.",
    howTo:
      "1. Créez votre compte sur le portail.\n2. Envoyez une demande au service en précisant la démarche voulue.\n3. Un agent vous indique les pièces à fournir et vous donne un rendez-vous au Dôme central.",
    email: "etat-civil@terranova.city",
    phone: "+00 1 10 00 01",
    hours: "Du lundi au vendredi, 8 h – 17 h (heure de la cité)",
    address: "Dôme central, niveau 1, guichet A",
  },
  {
    slug: "energie",
    name: "Énergie et réseau solaire",
    category: "Infrastructures",
    icon: "zap",
    summary: "Raccordement au réseau, pannes, compteurs et coupures programmées.",
    description:
      "Le service de l'énergie gère les fermes solaires, les batteries de la cité et la distribution vers chaque module. Il intervient en cas de panne et publie les coupures programmées dans les annonces.",
    howTo: "Pour une panne, envoyez une demande avec votre secteur et votre numéro de module. Les urgences vitales passent par la ligne de sécurité.",
    email: "energie@terranova.city",
    phone: "+00 1 10 00 02",
    hours: "Astreinte 24 h/24 pour les pannes",
    address: "Centrale Héliade, secteur Est",
  },
  {
    slug: "eau-oxygene",
    name: "Eau et oxygène",
    category: "Infrastructures",
    icon: "droplets",
    summary: "Recyclage de l'eau, qualité de l'air et alertes de pressurisation.",
    description:
      "Ce service assure le recyclage de l'eau, la production d'oxygène et la pressurisation des dômes. Il contrôle la qualité de l'air dans chaque secteur et publie les résultats chaque semaine.",
    howTo: "Signalez toute baisse de pression, odeur ou fuite par une demande. En cas d'alarme, suivez les consignes affichées dans votre module.",
    email: "vital@terranova.city",
    phone: "+00 1 10 00 03",
    hours: "Astreinte 24 h/24",
    address: "Station Hydra, sous-niveau 2",
  },
  {
    slug: "transports",
    name: "Transports et navettes",
    category: "Vie quotidienne",
    icon: "bus",
    summary: "Navettes entre dômes, horaires, abonnements et objets trouvés.",
    description:
      "Les navettes pressurisées relient les dômes résidentiels, les serres et le spatioport. Le service gère les horaires, les abonnements et les objets trouvés.",
    howTo: "Les horaires sont publiés dans les annonces. Pour un abonnement ou un objet perdu, envoyez une demande au service.",
    email: "navettes@terranova.city",
    phone: "+00 1 10 00 04",
    hours: "Navettes de 5 h à 1 h · guichet 9 h – 18 h",
    address: "Gare centrale, Dôme central",
  },
  {
    slug: "sante",
    name: "Centre de santé",
    category: "Santé et social",
    icon: "heart-pulse",
    summary: "Consultations, adaptation à la gravité réduite et suivi médical.",
    description:
      "Le centre de santé accueille les habitants pour les consultations, la médecine d'adaptation (gravité réduite, rayonnements) et les vaccinations. Il coordonne aussi le soutien psychologique des nouveaux arrivants.",
    howTo: "Prenez rendez-vous par une demande. Pour une urgence, rendez-vous directement au centre ou appelez la ligne de sécurité.",
    email: "sante@terranova.city",
    phone: "+00 1 10 00 05",
    hours: "Tous les jours, 7 h – 21 h · urgences 24 h/24",
    address: "Dôme Asclépios",
  },
  {
    slug: "logement",
    name: "Logement et modules",
    category: "Démarches",
    icon: "home",
    summary: "Attribution des modules d'habitation, réparations et changements de secteur.",
    description:
      "Le service du logement attribue les modules d'habitation, organise les réparations et traite les demandes de changement de secteur.",
    howTo: "Décrivez votre besoin (réparation, changement, colocation) dans une demande. Joignez votre numéro de module.",
    email: "logement@terranova.city",
    phone: "+00 1 10 00 06",
    hours: "Du lundi au vendredi, 9 h – 17 h",
    address: "Dôme central, niveau 2",
  },
  {
    slug: "proprete-recyclage",
    name: "Propreté et recyclage",
    category: "Vie quotidienne",
    icon: "recycle",
    summary: "Collecte, tri et valorisation : rien ne se perd à Terra Nova.",
    description:
      "Sur une autre planète, chaque ressource compte. Le service organise la collecte, le tri et la valorisation des déchets, et accompagne les habitants dans les bons gestes.",
    howTo: "Consultez le calendrier de collecte dans les annonces. Pour un encombrant ou un problème de collecte, envoyez une demande.",
    email: "recyclage@terranova.city",
    phone: "+00 1 10 00 07",
    hours: "Collectes de 6 h à 12 h",
    address: "Centre de valorisation, secteur Sud",
  },
  {
    slug: "education",
    name: "Écoles et formation",
    category: "Santé et social",
    icon: "graduation-cap",
    summary: "Inscriptions scolaires, formation des nouveaux arrivants et bibliothèque.",
    description:
      "Le service éducation gère les inscriptions à l'école de la cité, les formations obligatoires des nouveaux arrivants (sécurité, survie, pressurisation) et la bibliothèque numérique.",
    howTo: "Pour une inscription, envoyez une demande avec l'âge de l'enfant et votre secteur.",
    email: "education@terranova.city",
    phone: "+00 1 10 00 08",
    hours: "Du lundi au vendredi, 8 h – 16 h",
    address: "Campus Hypatie",
  },
  {
    slug: "serres-alimentation",
    name: "Serres et alimentation",
    category: "Vie quotidienne",
    icon: "leaf",
    summary: "Production des serres, paniers alimentaires et jardins partagés.",
    description:
      "Les serres hydroponiques nourrissent la cité. Le service distribue les paniers alimentaires et attribue les parcelles des jardins partagés.",
    howTo: "Inscrivez-vous aux paniers ou demandez une parcelle par une demande au service.",
    email: "serres@terranova.city",
    phone: "+00 1 10 00 09",
    hours: "Distribution tous les jours, 10 h – 19 h",
    address: "Serres Déméter, secteur Ouest",
  },
  {
    slug: "securite",
    name: "Sécurité et protection civile",
    category: "Sécurité",
    icon: "shield",
    summary: "Alertes, exercices d'évacuation, tempêtes de poussière et sécurité des sas.",
    description:
      "La protection civile prépare la cité aux tempêtes de poussière, aux dépressurisations et aux évacuations. Elle publie les alertes et organise les exercices.",
    howTo: "En cas de danger immédiat, utilisez les bornes d'alerte. Pour une question ou un signalement non urgent, envoyez une demande.",
    email: "securite@terranova.city",
    phone: "+00 1 10 00 10",
    hours: "24 h/24",
    address: "Poste central de sécurité, Dôme central",
  },
] as const;

const ANNOUNCEMENTS = [
  {
    slug: "bienvenue-sur-le-portail-de-terra-nova",
    title: "Bienvenue sur le portail de Terra Nova",
    summary: "Toutes vos démarches auprès de la ville se font désormais en ligne.",
    body:
      "Le Haut Conseil de Terra Nova ouvre le portail numérique des habitants.\n\nVous pouvez y trouver les services de la ville, lire les annonces, envoyer une demande à l'administration et suivre sa réponse depuis votre espace personnel.\n\nLes agents municipaux répondent à chaque demande dans le portail, et vous êtes prévenu par notification.",
    category: "ANNOUNCEMENT",
    pinned: true,
    service: null,
    daysAgo: 0,
  },
  {
    slug: "tempete-de-poussiere-prevue-secteur-est",
    title: "Tempête de poussière prévue sur le secteur Est",
    summary: "Restez dans les dômes jeudi de 14 h à 20 h ; navettes Est suspendues.",
    body:
      "Une tempête de poussière est attendue jeudi après-midi sur le secteur Est.\n\n• Restez à l'intérieur des dômes de 14 h à 20 h.\n• Les navettes vers le secteur Est sont suspendues pendant l'alerte.\n• Les sas extérieurs seront verrouillés.\n\nLa protection civile publiera la fin de l'alerte ici.",
    category: "ALERT",
    pinned: true,
    service: "securite",
    daysAgo: 1,
  },
  {
    slug: "coupure-programmee-du-reseau-solaire",
    title: "Coupure programmée du réseau solaire, secteur Nord",
    summary: "Maintenance des batteries samedi de 6 h à 9 h.",
    body:
      "Le service de l'énergie remplace deux batteries de stockage. Le secteur Nord sera alimenté par le réseau de secours samedi de 6 h à 9 h : évitez les appareils de forte puissance pendant cette période.",
    category: "SERVICE_CHANGE",
    pinned: false,
    service: "energie",
    daysAgo: 2,
  },
  {
    slug: "nouveaux-horaires-des-navettes",
    title: "Nouveaux horaires des navettes",
    summary: "Une navette toutes les 10 minutes aux heures de pointe.",
    body:
      "À partir de lundi, les navettes entre le Dôme central et les serres passent toutes les 10 minutes de 7 h à 9 h et de 17 h à 19 h. Le reste de la journée, la fréquence reste de 20 minutes.",
    category: "PRACTICAL",
    pinned: false,
    service: "transports",
    daysAgo: 3,
  },
  {
    slug: "fete-de-la-premiere-recolte",
    title: "Fête de la première récolte",
    summary: "Rendez-vous aux serres Déméter dimanche pour célébrer la première récolte.",
    body:
      "Les serres Déméter ont produit leur première récolte complète. Tous les habitants sont invités dimanche à partir de 11 h : dégustation, visites des serres et inscriptions aux jardins partagés.",
    category: "EVENT",
    pinned: false,
    service: "serres-alimentation",
    daysAgo: 4,
  },
] as const;

const REQUESTS = [
  {
    service: "eau-oxygene",
    subject: "Odeur inhabituelle dans le module B-12",
    message: "Depuis ce matin, une odeur métallique persiste dans mon module B-12, surtout près de la ventilation. Est-ce dangereux ?",
    status: "IN_PROGRESS",
    priority: "HIGH",
    replies: [
      { from: "agent", body: "Merci pour votre signalement. Une équipe contrôle la qualité de l'air de votre secteur dans l'heure. Gardez la ventilation allumée." },
      { from: "agent", body: "Équipe envoyée à 10 h 40, filtre B-12 à remplacer.", internal: true },
    ],
  },
  {
    service: "transports",
    subject: "Abonnement navette pour un nouvel arrivant",
    message: "Je viens d'arriver à Terra Nova. Comment obtenir un abonnement mensuel pour la navette entre le Dôme central et les serres ?",
    status: "WAITING_CITIZEN",
    priority: "NORMAL",
    replies: [
      { from: "agent", body: "Bienvenue ! Pouvez-vous nous indiquer votre numéro de résident ? Nous préparerons l'abonnement à votre nom." },
    ],
  },
  {
    service: "logement",
    subject: "Porte du sas qui ferme mal",
    message: "La porte intérieure du sas de mon module se bloque à mi-course depuis deux jours.",
    status: "NEW",
    priority: "NORMAL",
    replies: [],
  },
  {
    service: null,
    subject: "Question sur la fête de la récolte",
    message: "Bonjour, les enfants peuvent-ils participer aux visites des serres dimanche ?",
    status: "RESOLVED",
    priority: "LOW",
    replies: [
      { from: "agent", body: "Bonjour, oui : les visites sont ouvertes à tous, accompagnés d'un adulte. Bonne fête !" },
      { from: "citizen", body: "Merci beaucoup !" },
    ],
  },
] as const;

export async function seedTerraNova(prisma: Client, users: readonly SeedUser[]): Promise<void> {
  const admin = users.find((user) => user.role === "ADMIN") ?? users[0];
  const agent = users.find((user) => user.role === "MODERATOR") ?? admin;

  const serviceIds = new Map<string, string>();
  for (const [index, service] of SERVICES.entries()) {
    const row = await prisma.municipalService.upsert({
      where: { slug: service.slug },
      create: {
        ...service,
        sortOrder: index,
        featured: FEATURED_SERVICES.includes(service.slug),
        ...(SERVICE_TRANSLATIONS_EN[service.slug] ? { translations: { en: { ...SERVICE_TRANSLATIONS_EN[service.slug] } } } : {}),
      },
      update: {},
    });
    serviceIds.set(service.slug, row.id);
  }
  console.log(`  municipal services: ${SERVICES.length}`);

  for (const announcement of ANNOUNCEMENTS) {
    const { service, daysAgo, ...data } = announcement;
    await prisma.announcement.upsert({
      where: { slug: announcement.slug },
      create: {
        ...data,
        serviceId: service ? (serviceIds.get(service) ?? null) : null,
        authorId: admin.id,
        publishedAt: new Date(Date.now() - daysAgo * 86_400_000),
      },
      update: {},
    });
  }
  console.log(`  announcements: ${ANNOUNCEMENTS.length}`);

  // Sample requests belong to the first citizen account.
  const citizen = users.find((user) => user.role === "USER");
  if (!citizen) return;
  let created = 0;
  for (const [index, request] of REQUESTS.entries()) {
    const reference = `TN-${String(100_001 + index).padStart(6, "0")}`;
    const existing = await prisma.cityRequest.findUnique({ where: { reference }, select: { id: true, citizenId: true } });
    if (existing?.citizenId === citizen.id) continue;
    // A sample seeded under an account that is no longer the citizen is rebuilt.
    if (existing) await prisma.cityRequest.delete({ where: { id: existing.id } });
    const assigned = request.status !== "NEW";
    await prisma.cityRequest.create({
      data: {
        reference,
        citizenId: citizen.id,
        serviceId: request.service ? (serviceIds.get(request.service) ?? null) : null,
        subject: request.subject,
        message: encryptField(request.message),
        status: request.status,
        priority: request.priority,
        assigneeId: assigned ? agent.id : null,
        events: {
          create: [
            { actorId: citizen.id, kind: "created", toValue: "NEW" },
            ...(assigned ? [{ actorId: agent.id, kind: "status", fromValue: "NEW", toValue: request.status }] : []),
          ],
        },
        messages: {
          create: request.replies.map((reply) => ({
            authorId: reply.from === "agent" ? agent.id : citizen.id,
            body: encryptField(reply.body),
            internal: "internal" in reply ? reply.internal : false,
          })),
        },
      },
    });
    created += 1;
  }
  if (created > 0) console.log(`  citizen requests: ${created}`);
}
