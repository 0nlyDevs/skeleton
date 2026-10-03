/**
 * Demo content — the single swap point for the subject.
 *
 * `seed.ts` owns the *mechanism* (upserts, ordering, idempotence). This file
 * owns the *content*. At H-0 the product gets a subject, and everything the
 * jury reads on a screen should change here without touching the seed logic.
 *
 * Two rules the content below follows, both learned from what it replaced:
 *
 * 1. **No scaffold meta.** The previous posts described the foundation itself
 *    — "this foundation brings together authentication, roles, posts…" — and the
 *    first thing on the feed was a sentence about the code rather than about the
 *    product. It reads as a placeholder to a juror, correctly.
 *
 * 2. **Demonstrate, don't describe.** The posts exist so a juror can *test*
 *    something rather than read that it exists. Each one names a behaviour that
 *    is reachable in the next thirty seconds: drafts stay private, editing
 *    someone else's post is refused at the API, reported content reaches a
 *    moderator. Those are worth keeping through any rewrite — they are the
 *    fastest route to a juror finding the thing you built.
 *
 * Keep the authors spread across all four accounts (`author` is an index into
 * `JURY_ACCOUNTS`), because several checks need two identities to be meaningful.
 */

/** Shared secret for every demo account. Documented in the README on purpose. */
export const JURY_PASSWORD = "Webcup-2026!jury";

/**
 * The four seeded accounts. Three roles, four accounts: `user2` exists so that
 * follow/unfollow, direct messages and per-account visibility can be tested
 * honestly, which a single member account cannot do.
 */
export const JURY_ACCOUNTS = [
  {
    email: "admin@webcup.demo",
    username: "colombe.admin",
    firstName: "Colombe",
    lastName: "Admin",
    birthDate: "1995-04-12",
    name: "Colombe Admin",
    role: "ADMIN" as const,
    bio: "Administratrice de la démonstration. Console d'administration, journal d'audit et drapeaux de fonctionnalités.",
  },
  {
    email: "moderator@webcup.demo",
    username: "faniry.moderator",
    firstName: "Faniry",
    lastName: "Rakoto",
    birthDate: "1993-11-30",
    name: "Faniry Rakoto",
    role: "MODERATOR" as const,
    bio: "Modératrice. File de signalements et retrait de contenu.",
  },
  {
    email: "user@webcup.demo",
    username: "aline.rakoto",
    firstName: "Aline",
    lastName: "Rakoto",
    birthDate: "1998-07-14",
    name: "Aline Rakoto",
    role: "USER" as const,
    bio: "Membre. Publie, commente et discute en messagerie.",
  },
  {
    email: "user2@webcup.demo",
    username: "tojo.mora",
    firstName: "Tojo",
    lastName: "Mora",
    birthDate: "1996-02-23",
    name: "Tojo Mora",
    role: "USER" as const,
    bio: "Second membre, pour tout ce qui suppose deux identités distinctes.",
  },
] as const;

export interface DemoPost {
  /** Index into {@link JURY_ACCOUNTS}. */
  readonly author: number;
  readonly title: string;
  readonly body: string;
  readonly tags: readonly string[];
  readonly published: boolean;
}

/**
 * Feed content. `author` and `published` are chosen so the feed shows a public
 * post, somebody's private draft, and content that is both public and reported.
 */
export const DEMO_POSTS: readonly DemoPost[] = [
  {
    author: 0,
    title: "Bienvenue — commencer par ici",
    body: "Ceci est un compte de démonstration : connectez-vous, publiez, commentez, envoyez un message.\n\nQuatre comptes sont disponibles, dont deux membres distincts, pour pouvoir tester les choses qui ont besoin de deux identités. Le mot de passe partagé est dans le README.",
    tags: ["welcome"],
    published: true,
  },
  {
    author: 0,
    title: "Comment fonctionne la modération",
    body: "Un signalement crée une entrée dans la file de modération. Un modérateur peut retirer le contenu (suppression douce, réversible) ou écarter le signalement.\n\nChaque décision est inscrite au journal d'audit avec son auteur.",
    tags: ["moderation", "audit"],
    published: true,
  },
  {
    author: 1,
    title: "Le temps réel et son filet de sécurité",
    body: "La messagerie passe par Socket.IO, monté sur le même serveur HTTP que Next.js. Si l'hébergeur filtre les WebSocket, l'interface bascule automatiquement sur le polling HTTP.\n\nL'indicateur en haut à droite montre le transport actif.",
    tags: ["realtime"],
    published: true,
  },
  {
    author: 1,
    title: "Brouillon : plan pour la finale",
    body: "Notes internes sur la répartition des rôles pendant l'épreuve. Ce brouillon n'est visible que de son auteur et de l'équipe Staff.",
    tags: [],
    published: false,
  },
  {
    author: 2,
    title: "Mon premier article",
    body: "Un article de démonstration publié par un compte standard.\n\nEssayez de l'ouvrir avec un autre compte : la modification et la suppression sont refusées par le serveur, pas seulement cachées dans l'interface.",
    tags: ["demo"],
    published: true,
  },
  {
    author: 2,
    title: "Brouillon personnel",
    body: "Ce brouillon ne doit apparaître que pour Aline. Si vous le voyez avec un autre compte, c'est un bug d'accès.",
    tags: [],
    published: false,
  },
  {
    author: 3,
    title: "Tester la sécurité entre comptes",
    body: "Connectez-vous avec user@webcup.demo puis essayez de modifier cette publication : l'API répond 404, jamais 403, pour ne pas révéler l'existence des ressources d'autrui.",
    tags: ["security"],
    published: true,
  },
  {
    author: 3,
    title: "L'assistant IA en pratique",
    body: "L'assistant résume les publications et propose des étiquettes. La clé d'API ne quitte jamais le serveur et chaque appel est limité par utilisateur.",
    tags: ["ai"],
    published: true,
  },
];

/**
 * Direct messages. The first names the product generically on purpose: it is the
 * first message a juror opens, and it used to open with the word "socle".
 */
export const DEMO_MESSAGES: ReadonlyArray<{ readonly author: number; readonly content: string }> = [
  { author: 0, content: "Bienvenue ! Les messages sont persistés en base, pas gardés en mémoire." },
  { author: 2, content: "Bonjour — l'indicateur temps réel est vert, le socket est bien connecté." },
  { author: 3, content: "Testons aussi le mode dégradé : coupez le réseau et rechargez, le polling prend le relais." },
];

/** Notifications for the standard member, so the bell is not empty. */
export const DEMO_NOTIFICATIONS = [
  {
    type: "SYSTEM",
    title: "Bienvenue",
    body: "Parcourez le fil, les groupes et la messagerie.",
    link: "/feed",
    read: false,
  },
  {
    type: "NEW_MESSAGE",
    title: "Nouveau message dans Général",
    body: "Un message vous attend dans le salon général.",
    link: "/messages",
    read: false,
  },
  {
    type: "ROLE_CHANGED",
    title: "Rôle confirmé",
    body: "Votre compte de démonstration est un compte standard.",
    link: "/settings/profile",
    read: true,
  },
] as const;