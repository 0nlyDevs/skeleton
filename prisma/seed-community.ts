/**
 * The life of the city, so the platform never opens empty: residents of
 * every district, who follows whom, neighbourhood groups, posts and their
 * comments, the general conversation, and opinions left on services (some
 * already answered by the city).
 *
 * These residents are part of the demo world: their e-mail addresses are
 * under `.example`, and their password is a random value nobody knows, so
 * the accounts cannot be signed into.
 *
 * Idempotent: residents by e-mail, groups by slug, posts by title and
 * author, opinions by reference; comments and messages only on first run.
 */

import { randomBytes, randomUUID } from "node:crypto";

import { hashPassword } from "../src/lib/auth/password";
import type { prisma as Prisma } from "../src/lib/db/prisma";

type Client = typeof Prisma;
type SeedUser = { id: string; email: string; role: string };
type Zone = "CRYSTAL_REACH" | "VERDANT_BASIN" | "EMBER_WASTES" | "FROSTPEAK" | "SUNKEN_DELTA" | "NOVA_PRIME" | "OBSIDIAN_COAST" | "SKYPORT_ISLES";

const HOUR = 3_600_000;

const RESIDENTS: ReadonlyArray<{ first: string; last: string; zone: Zone; bio: string }> = [
  { first: "Maëlle", last: "Rasoanaivo", zone: "VERDANT_BASIN", bio: "Maraîchère aux serres nord. Bénévole à la banque alimentaire." },
  { first: "Idriss", last: "Okafor", zone: "NOVA_PRIME", bio: "Technicien du réseau solaire. Répare aussi les vélos le samedi." },
  { first: "Soa", last: "Andrianina", zone: "SUNKEN_DELTA", bio: "Pêcheuse à Coral Harbor, trois enfants à l'école du Delta." },
  { first: "Léon", last: "Varga", zone: "CRYSTAL_REACH", bio: "Professeur de sciences aux écoles de Crystal Reach." },
  { first: "Naya", last: "Ibekwe", zone: "SKYPORT_ISLES", bio: "Contrôleuse au spatioport. Arrivée il y a deux ans." },
  { first: "Tiana", last: "Rakotobe", zone: "OBSIDIAN_COAST", bio: "Gardien du phare d'Obsidian et photographe du dimanche." },
  { first: "Émile", last: "Santoro", zone: "EMBER_WASTES", bio: "Soudeur à la centrale d'Ember. Président du club d'échecs." },
  { first: "Kalinda", last: "Mbeki", zone: "FROSTPEAK", bio: "Infirmière à l'abri de Frostpeak." },
  { first: "Hery", last: "Ramanantsoa", zone: "NOVA_PRIME", bio: "Boulanger place du Haut Conseil. Ouvert dès 5 h." },
  { first: "Zoé", last: "Lindqvist", zone: "VERDANT_BASIN", bio: "Nouvelle habitante, ingénieure en recyclage de l'eau." },
  { first: "Malik", last: "Diallo", zone: "SUNKEN_DELTA", bio: "Animateur de l'atelier de réparation solidaire." },
  { first: "Vola", last: "Randria", zone: "CRYSTAL_REACH", bio: "Retraitée, mémoire vivante des premiers modules." },
];

const GROUPS = [
  { slug: "entraide-sunken-delta", name: "Entraide Sunken Delta", description: "Coups de main entre voisins du Delta : garde d'enfants, courses, sacs de sable quand l'eau monte.", owner: 2, members: [10, 5, 0, 8] },
  { slug: "jardiniers-de-verdant-basin", name: "Jardiniers de Verdant Basin", description: "Semences, boutures et conseils pour les parcelles partagées des serres.", owner: 0, members: [9, 1, 11, 3] },
  { slug: "nouveaux-arrivants", name: "Nouveaux arrivants", description: "Vous venez d'arriver à Terra Nova ? Posez vos questions ici, les anciens répondent.", owner: 11, members: [9, 4, 7, 6, 2] },
] as const;

/** author: index in RESIDENTS; group: index in GROUPS or null. */
const POSTS: ReadonlyArray<{ author: number; hoursAgo: number; group: number | null; title: string; body: string; tags: string[]; comments: ReadonlyArray<{ by: number; text: string }> }> = [
  { author: 8, hoursAgo: 2, group: null, title: "Pain chaud malgré la coupure d'eau", body: "La boulangerie de la place du Haut Conseil ouvre demain à 5 h comme d'habitude. Nous avons fait nos réserves d'eau avant 20 h, comme demandé par le Haut Conseil. Venez tôt, il n'y en aura pas pour tout le monde !", tags: ["nova-prime", "commerce"], comments: [{ by: 1, text: "Merci Hery, je passe avant ma prise de poste." }, { by: 11, text: "Deux baguettes de côté pour moi, s'il vous plaît." }] },
  { author: 2, hoursAgo: 3, group: 0, title: "L'eau monte sur les quais : qui a des sacs de sable ?", body: "Le niveau a pris vingt centimètres depuis ce matin à Coral Harbor. L'alerte de la ville demande d'éviter les sous-niveaux. Il nous faut des sacs de sable pour l'entrée de l'école du Delta. Rendez-vous à 17 h devant le hangar 7.", tags: ["sunken-delta", "entraide"], comments: [{ by: 10, text: "L'atelier en a une trentaine, je les apporte." }, { by: 5, text: "Je viens avec la remorque du phare." }, { by: 2, text: "Merci à tous les deux. On s'organise sur place." }] },
  { author: 1, hoursAgo: 5, group: null, title: "Panne électrique au nord : où en est-on ?", body: "Pour les voisins de Verdant Basin et d'Ember Wastes : les équipes sont sur le poste de la centrale depuis ce matin. Le retour du courant est prévu dans la soirée. Les abris de quartier restent alimentés pour recharger vos téléphones. Suivez l'alerte dans Bubble, elle est mise à jour par la ville.", tags: ["énergie", "nord"], comments: [{ by: 6, text: "Confirmé côté Ember, l'abri est ouvert et il y a du café." }, { by: 0, text: "Les serres tiennent sur batterie jusqu'à minuit." }] },
  { author: 9, hoursAgo: 8, group: 2, title: "Première semaine à Terra Nova : mes repères", body: "Arrivée lundi. Ce qui m'a aidée : la page « Par où commencer » de Bubble, l'association Passerelle à côté du registre civil, et la navette N2 pour les serres. Ma carte de résident est arrivée en trois jours. Si vous arrivez aussi, écrivez-moi !", tags: ["arrivée", "conseils"], comments: [{ by: 11, text: "Bienvenue Zoé ! Passez au belvédère un soir, la vue vaut le détour." }, { by: 4, text: "Pour le spatioport, prenez la N1 avant 7 h, il y a moins de monde." }] },
  { author: 0, hoursAgo: 12, group: 1, title: "Distribution de plants de tomates samedi", body: "Les serres nord ont trop de plants cette saison. Distribution gratuite samedi de 9 h à 13 h à la halle Greenroot, en même temps que la banque alimentaire. Apportez un contenant.", tags: ["serres", "jardin"], comments: [{ by: 9, text: "J'en prendrai six pour la parcelle 14." }, { by: 3, text: "Mes élèves viendront en planter au jardin de l'école." }] },
  { author: 3, hoursAgo: 20, group: null, title: "Sortie scolaire à l'observatoire : merci aux transports", body: "Quarante élèves de Crystal Reach ont observé les deux lunes hier soir. Merci au câble C5 d'avoir prolongé le service d'une heure. Les photos des enfants seront exposées au registre civil la semaine prochaine.", tags: ["école", "crystal-reach"], comments: [{ by: 11, text: "Quelle chance ils ont. De mon temps on montait à pied." }] },
  { author: 5, hoursAgo: 26, group: null, title: "Le phare d'Obsidian en travaux", body: "La lanterne est remplacée cette semaine. Le feu de secours fonctionne, pas d'inquiétude pour les pêcheurs. La visite du dimanche est reportée au mois prochain.", tags: ["obsidian-coast"], comments: [{ by: 2, text: "Bien noté pour les sorties de nuit, merci Tiana." }] },
  { author: 7, hoursAgo: 30, group: null, title: "Canicule : pensez à vos voisins âgés", body: "Avec la vague de chaleur au nord, nous recevons beaucoup de personnes déshydratées. Un geste simple : frappez chez vos voisins âgés une fois par jour et proposez un verre d'eau. En cas de malaise, appelez le centre de santé sans attendre.", tags: ["santé", "chaleur"], comments: [{ by: 6, text: "On fait le tour de l'allée ce soir avec le club." }, { by: 0, text: "Message relayé aux serres." }] },
  { author: 10, hoursAgo: 40, group: 0, title: "Atelier réparation : 23 objets sauvés ce mois-ci", body: "Grille-pain, vélos, deux combinaisons de sortie et même une radio. L'atelier est ouvert du mercredi au samedi, hangar 7. Les pièces de récupération sont gratuites. Venez avec vos objets, repartez avec le sourire.", tags: ["réparation", "sunken-delta"], comments: [{ by: 1, text: "Je peux tenir le stand vélos samedi." }] },
  { author: 4, hoursAgo: 52, group: null, title: "Nouveaux horaires au spatioport", body: "À partir de lundi, le contrôle des arrivées ouvre à 5 h. La navette N1 part du registre civil toutes les dix minutes. Les nouveaux arrivants trouvent l'accueil Passerelle dès la sortie.", tags: ["skyport", "transports"], comments: [] },
  { author: 6, hoursAgo: 70, group: null, title: "Tournoi d'échecs du secteur est", body: "Inscriptions ouvertes jusqu'à vendredi à l'abri d'Ember. Tous les niveaux, enfants bienvenus. Le vainqueur gagne un panier des serres.", tags: ["loisirs", "ember-wastes"], comments: [{ by: 3, text: "Trois de mes élèves s'inscrivent !" }] },
  { author: 11, hoursAgo: 96, group: 2, title: "Ce que j'aurais aimé savoir en arrivant", body: "1. Choisissez votre quartier dans votre profil : les alertes vous concernent alors vraiment.\n2. Une demande à la ville se suit dans votre espace, inutile de la renvoyer.\n3. Les abris de quartier sont ouverts à tous en cas d'alerte.\n4. Le marché central est moins cher après 16 h.", tags: ["conseils", "arrivée"], comments: [{ by: 9, text: "Le point 2 m'a évité bien des soucis, merci Vola." }, { by: 4, text: "J'ajoute : gardez votre référence TN, elle sert de preuve." }] },
];

const CHAT: ReadonlyArray<{ by: number; minutesAgo: number; text: string }> = [
  { by: 8, minutesAgo: 190, text: "Bonjour à tous ! Quelqu'un sait si le marché central ouvre malgré la coupure d'eau ?" },
  { by: 1, minutesAgo: 184, text: "Oui, ouvert normalement. Seule la fontaine de la place est fermée." },
  { by: 2, minutesAgo: 120, text: "Attention sur les quais du Delta, l'eau a encore monté. Passez par le pont des Marées." },
  { by: 10, minutesAgo: 112, text: "Le tram T3 est interrompu sur ce tronçon. Prenez le bus B4 par Coral Harbor." },
  { by: 9, minutesAgo: 61, text: "Merci pour l'info ! La carte de Bubble montre bien les quartiers en alerte." },
  { by: 7, minutesAgo: 34, text: "Rappel santé : buvez de l'eau, il fait très chaud au nord aujourd'hui." },
  { by: 6, minutesAgo: 12, text: "L'abri d'Ember est alimenté, vous pouvez venir recharger vos téléphones." },
];

const OPINIONS: ReadonlyArray<{ reference: string; by: number; service: string; rating: number; comment: string; reply: string | null }> = [
  { reference: "AV-104211", by: 9, service: "etat-civil", rating: 5, comment: "Carte de résident reçue en trois jours. L'agent a tout expliqué simplement.", reply: "Merci pour votre retour, et bienvenue à Terra Nova." },
  { reference: "AV-104212", by: 2, service: "eau-oxygene", rating: 2, comment: "Deux jours sans réponse pendant la fuite. J'aurais aimé être prévenue plus tôt.", reply: "Vous avez raison : nous prévenons désormais chaque quartier touché dès l'ouverture d'un incident." },
  { reference: "AV-104213", by: 3, service: "transports", rating: 4, comment: "Le câble C5 est ponctuel. Il manque un abri à l'arrêt des écoles.", reply: null },
  { reference: "AV-104214", by: 6, service: "energie", rating: 3, comment: "Panne longue, mais les équipes ont tenu informés les habitants à l'abri.", reply: null },
  { reference: "AV-104215", by: 0, service: "banque-alimentaire-des-serres", rating: 5, comment: "Bénévoles formidables. La distribution du samedi est très bien organisée.", reply: null },
  { reference: "AV-104216", by: 11, service: "sante", rating: 4, comment: "Reçue vite pendant la canicule. Un peu d'attente pour les ordonnances.", reply: "Merci. Un second guichet ouvre cette semaine pour les ordonnances." },
];

export async function seedCommunity(prisma: Client, users: readonly SeedUser[]): Promise<void> {
  // Nobody knows this password: these accounts exist to be read, not signed into.
  const sealed = await hashPassword(randomBytes(32).toString("base64url"));
  const residents: { id: string }[] = [];
  let createdResidents = 0;
  for (const person of RESIDENTS) {
    const username = `${person.first}.${person.last}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z.]/g, "");
    const email = `${username}@habitants.terranova.example`;
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      residents.push(existing);
      continue;
    }
    const id = randomUUID();
    await prisma.user.create({
      data: {
        id,
        email,
        name: `${person.first} ${person.last}`,
        firstName: person.first,
        lastName: person.last,
        username,
        displayUsername: username,
        role: "USER",
        emailVerified: true,
        bio: person.bio,
        cityZone: person.zone,
        accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: sealed } },
      },
    });
    await prisma.notificationPreference.upsert({ where: { userId: id }, create: { userId: id }, update: {} });
    residents.push({ id });
    createdResidents += 1;
  }
  const at = (index: number): string => residents[index % residents.length]!.id;

  // Who follows whom: the test accounts are part of the city too.
  const follows: [string, string][] = [];
  residents.forEach((resident, index) => {
    follows.push([resident.id, at(index + 1)], [resident.id, at(index + 4)]);
  });
  for (const user of users) {
    follows.push([user.id, at(0)], [user.id, at(2)], [user.id, at(8)], [at(9), user.id], [at(11), user.id], [at(1), user.id]);
  }
  for (const [followerId, followingId] of follows) {
    if (followerId === followingId) continue;
    await prisma.follow.upsert({ where: { followerId_followingId: { followerId, followingId } }, create: { followerId, followingId }, update: {} });
  }

  const groupIds: string[] = [];
  const resident = users.find((user) => user.role === "USER");
  for (const group of GROUPS) {
    const members = [...new Set([at(group.owner), ...group.members.map(at), ...(resident ? [resident.id] : [])])];
    const row = await prisma.group.upsert({
      where: { slug: group.slug },
      create: { slug: group.slug, name: group.name, description: group.description, ownerId: at(group.owner), memberCount: members.length },
      update: {},
    });
    groupIds.push(row.id);
    for (const userId of members) {
      await prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: row.id, userId } },
        create: { groupId: row.id, userId, role: userId === at(group.owner) ? "OWNER" : "MEMBER" },
        update: {},
      });
    }
  }

  let createdPosts = 0;
  for (const post of POSTS) {
    const userId = at(post.author);
    if (await prisma.post.findFirst({ where: { title: post.title, userId }, select: { id: true } })) continue;
    const createdAt = new Date(Date.now() - post.hoursAgo * HOUR);
    const row = await prisma.post.create({
      data: { userId, title: post.title, body: post.body, tags: post.tags, published: true, createdAt, groupId: post.group === null ? null : (groupIds[post.group] ?? null), commentCount: post.comments.length },
    });
    for (const [index, comment] of post.comments.entries()) {
      await prisma.comment.create({ data: { postId: row.id, userId: at(comment.by), body: comment.text, createdAt: new Date(createdAt.getTime() + (index + 1) * 11 * 60_000) } });
    }
    createdPosts += 1;
  }

  // The general conversation, only when nobody from the city has spoken yet.
  const room = await prisma.room.findUnique({ where: { id: "global" }, select: { id: true } });
  if (room && (await prisma.message.count({ where: { roomId: room.id, senderId: { in: residents.map((entry) => entry.id) } } })) === 0) {
    for (const line of CHAT) {
      await prisma.message.create({ data: { roomId: room.id, senderId: at(line.by), content: line.text, createdAt: new Date(Date.now() - line.minutesAgo * 60_000) } });
    }
  }

  let createdOpinions = 0;
  const agent = users.find((user) => user.role === "AGENT");
  for (const opinion of OPINIONS) {
    if (await prisma.serviceFeedback.findUnique({ where: { reference: opinion.reference }, select: { id: true } })) continue;
    const service = await prisma.municipalService.findUnique({ where: { slug: opinion.service }, select: { id: true } });
    if (!service) continue;
    await prisma.serviceFeedback.create({
      data: {
        reference: opinion.reference,
        userId: at(opinion.by),
        serviceId: service.id,
        rating: opinion.rating,
        comment: opinion.comment,
        ...(opinion.reply && agent ? { status: "ANSWERED" as const, reply: opinion.reply, repliedById: agent.id, repliedAt: new Date(), readAt: new Date() } : {}),
      },
    });
    createdOpinions += 1;
  }
  console.log(`  community: ${createdResidents} residents, ${createdPosts} posts, ${createdOpinions} opinions, ${GROUPS.length} groups`);
}
