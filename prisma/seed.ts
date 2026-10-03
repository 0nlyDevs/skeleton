/**
 * Seed — test accounts per role and realistic demo data.
 *
 * The test password comes from `SEED_PASSWORD` (set it in `.env` locally and
 * in the host's environment), so it never lives in the repository. Legacy
 * `@webcup.demo` accounts from earlier seeds are removed.
 *
 * Idempotent: every step is an upsert or a guarded create, so running the seed
 * twice neither duplicates nor destroys. An account that already exists keeps
 * its name and username; only its role, verification and password are set.
 */

import { hashPassword } from "../src/lib/auth/password";
import { encryptField } from "../src/lib/crypto/field-encryption";
// The shared client, not a fresh one: Prisma 7 needs a driver adapter to
// construct it, and `lib/db/prisma.ts` is the single place that knows how to
// turn DATABASE_URL into driver pool options.
import { prisma } from "../src/lib/db/prisma";

import { seedCityAlerts } from "./seed-city-alerts";
import { seedTerraNova } from "./seed-terra-nova";

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "";
if (SEED_PASSWORD.length < 10) {
  throw new Error("Set SEED_PASSWORD (at least 10 characters) before seeding.");
}

const ACCOUNTS = [
  { email: "cocobrowniees@gmail.com", username: "coco.admin", firstName: "Coco", lastName: "Brownies", birthDate: "1998-03-14", role: "ADMIN" as const, bio: "Administration de la plateforme Terra Nova." },
  { email: "hei.colombe@gmail.com", username: "colombe.mod", firstName: "Colombe", lastName: "Hei", birthDate: "2001-07-09", role: "MODERATOR" as const, bio: "Équipe municipale — demandes des habitants et annonces." },
  { email: "hei.tafita.2@gmail.com", username: "tafita", firstName: "Tafita", lastName: "Hei", birthDate: "2002-11-02", role: "MODERATOR" as const, bio: "Équipe municipale — demandes des habitants et annonces." },
  { email: "hei.harena.2@gmail.com", username: "harena", firstName: "Harena", lastName: "Hei", birthDate: "2003-05-27", role: "MODERATOR" as const, bio: "Équipe municipale — demandes des habitants et annonces." },
  { email: "colomberakotonjanahary@gmail.com", username: "colombe.rakoto", firstName: "Colombe", lastName: "Rakotonjanahary", birthDate: "2000-02-18", role: "USER" as const, bio: "Module B-12, secteur B." },
  { email: "hei.jonathan.3@gmail.com", username: "jonathan.admin", firstName: "Jonathan", lastName: "Hei", birthDate: "2001-09-30", role: "ADMIN" as const, bio: "Administration de la plateforme Terra Nova." },
].map((account) => ({ ...account, name: `${account.firstName} ${account.lastName}` }));

const GLOBAL_ROOM = "global";

const POSTS: ReadonlyArray<{
  author: number;
  title: string;
  body: string;
  tags: string[];
  published: boolean;
}> = [
  {
    author: 0,
    title: "Bienvenue sur le socle Webcup",
    body:
      "Ce socle réunit l'authentification, les rôles, les publications, la messagerie temps réel, les notifications et l'assistant IA.\n\nChaque domaine vit dans son propre module : schéma, dépôt, service, DTO, routes. Copiez un module pour créer une entité métier en quelques minutes.",
    tags: ["webcup", "skeleton"],
    published: true,
  },
  {
    author: 0,
    title: "Comment fonctionne la modération",
    body:
      "Un signalement crée une entrée dans la file de modération. Un modérateur peut retirer le contenu (suppression douce, réversible) ou écarter le signalement.\n\nChaque décision est inscrite au journal d'audit avec son auteur.",
    tags: ["moderation", "audit"],
    published: true,
  },
  {
    author: 1,
    title: "Le temps réel et son filet de sécurité",
    body:
      "La messagerie passe par Socket.IO, monté sur le même serveur HTTP que Next.js. Si l'hébergeur filtre les WebSocket, l'interface bascule automatiquement sur le polling HTTP.\n\nL'indicateur en haut à droite montre le transport actif.",
    tags: ["realtime", "socketio"],
    published: true,
  },
  {
    author: 1,
    title: "Brouillon : plan pour la finale",
    body: "Notes internes sur la répartition des rôles pendant l'épreuve. Ce brouillon n'est visible que de son auteur et de l'équipe Staff.",
    tags: ["draft"],
    published: false,
  },
  {
    author: 2,
    title: "Mon premier article",
    body:
      "Un article de démonstration publié par un compte standard.\n\nEssayez de l'ouvrir avec un autre compte : la modification et la suppression sont refusées par le serveur, pas seulement cachées dans l'interface.",
    tags: ["demo", "crud"],
    published: true,
  },
  {
    author: 2,
    title: "Brouillon personnel",
    body: "Ce brouillon ne doit apparaître que pour Aline. Si vous le voyez avec un autre compte, c'est un bug d'access control.",
    tags: [],
    published: false,
  },
  {
    author: 3,
    title: "Tester la sécurité entre comptes",
    body:
      "Connectez-vous avec un compte utilisateur puis essayez d'éditer cette publication : l'API répond 404, jamais 403, pour ne pas révéler l'existence des ressources d'autrui.",
    tags: ["security", "idor"],
    published: true,
  },
  {
    author: 3,
    title: "L'assistant IA en pratique",
    body:
      "L'assistant résume les publications et propose des étiquettes. La clé d'API ne quitte jamais le serveur et chaque appel est limité par utilisateur.",
    tags: ["ai", "openrouter"],
    published: true,
  },
];

const MESSAGES: ReadonlyArray<{ author: number; content: string }> = [
  { author: 0, content: "Bienvenue dans la messagerie du socle Webcup ! Les messages sont persistés en base." },
  { author: 2, content: "Bonjour — l'indicateur temps réel est vert, le socket est bien connecté." },
  { author: 3, content: "Testons aussi le mode dégradé : coupez le réseau et rechargez, le polling prend le relais." },
];

function profileOf(account: (typeof ACCOUNTS)[number]) {
  return {
    username: account.username,
    displayUsername: account.username,
    firstName: account.firstName,
    lastName: account.lastName,
    birthDate: null,
    birthDateEncrypted: encryptField(account.birthDate),
  };
}

async function upsertUser(account: (typeof ACCOUNTS)[number], passwordHash: string) {
  // BetterAuth generates user ids itself; here we must supply one, because the
  // schema mirrors BetterAuth's table where `id` has no default.
  const existing = await prisma.user.findUnique({ where: { email: account.email } });

  if (existing) {
    await prisma.account.updateMany({
      where: { userId: existing.id, providerId: "credential" },
      // `accountId` is not decoration: BetterAuth's email/password sign-in
      // requires `accountId === user.id` for the credential provider and
      // reports "Invalid email or password" otherwise. Rows seeded before that
      // was true are repaired here rather than left for someone to debug.
      data: { password: passwordHash, accountId: existing.id },
    });
    // An OAuth-only account gets a password too, so every role can be tested.
    if ((await prisma.account.count({ where: { userId: existing.id, providerId: "credential" } })) === 0) {
      await prisma.account.create({
        data: { id: crypto.randomUUID(), userId: existing.id, accountId: existing.id, providerId: "credential", password: passwordHash },
      });
    }
    return prisma.user.update({
      where: { id: existing.id },
      data: { role: account.role, emailVerified: true },
    });
  }

  const id = crypto.randomUUID();

  return prisma.user.create({
    data: {
      id,
      email: account.email,
      name: account.name,
      role: account.role,
      emailVerified: true,
      bio: account.bio,
      ...profileOf(account),
      accounts: {
        create: {
          id: crypto.randomUUID(),
          // Must match the user id — see the note above.
          accountId: id,
          providerId: "credential",
          password: passwordHash,
        },
      },
    },
  });
}

async function main() {
  console.log("Seeding test accounts and demo data…");

  const legacy = await prisma.user.deleteMany({ where: { email: { endsWith: "@webcup.demo" } } });
  if (legacy.count > 0) console.log(`  removed ${legacy.count} legacy demo account(s)`);

  const passwordHash = await hashPassword(SEED_PASSWORD);

  const users = [];
  for (const account of ACCOUNTS) {
    const user = await upsertUser(account, passwordHash);
    users.push(user);
    console.log(`  account: ${account.email} (${account.role})`);
  }

  // Notification preferences exist for every account — the signup hook creates
  // them, but seeding must not depend on having gone through signup.
  for (const user of users) {
    await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
  }

  // Global room.
  const room = await prisma.room.upsert({
    where: { id: GLOBAL_ROOM },
    create: { id: GLOBAL_ROOM, name: "Général", type: "GLOBAL" },
    update: { name: "Général" },
  });

  // Posts.
  const createdPostIds: string[] = [];
  for (const [index, post] of POSTS.entries()) {
    const existing = await prisma.post.findFirst({
      where: { title: post.title, userId: users[post.author].id },
      select: { id: true },
    });

    const row =
      existing ??
      (await prisma.post.create({
        data: {
          userId: users[post.author].id,
          title: post.title,
          body: post.body,
          tags: post.tags,
          published: post.published,
        },
      }));

    createdPostIds.push(row.id);
    void index;
  }
  console.log(`  posts: ${createdPostIds.length}`);

  // Messages.
  const messageCount = await prisma.message.count({ where: { roomId: room.id } });
  if (messageCount === 0) {
    for (const message of MESSAGES) {
      await prisma.message.create({
        data: {
          roomId: room.id,
          senderId: users[message.author].id,
          content: message.content,
        },
      });
    }
    console.log(`  messages: ${MESSAGES.length}`);
  }

  // Notifications for the standard user.
  const notificationCount = await prisma.notification.count({ where: { userId: users[2].id } });
  if (notificationCount === 0) {
    await prisma.notification.createMany({
      data: [
        {
          userId: users[2].id,
          type: "SYSTEM",
          title: "Bienvenue sur Webcup Base",
          body: "Explorez le tableau de bord, les publications et la messagerie.",
          link: "/dashboard",
          read: false,
        },
        {
          userId: users[2].id,
          type: "NEW_MESSAGE",
          title: "Nouveau message dans Général",
          body: "Un message vous attend dans le salon général.",
          link: "/chat",
          read: false,
        },
        {
          userId: users[2].id,
          type: "ROLE_CHANGED",
          title: "Rôle confirmé",
          body: "Votre compte de démonstration est un compte standard.",
          link: "/settings/profile",
          read: true,
        },
      ],
    });
    console.log("  notifications: 3");
  }

  // One open report so the moderation queue has something to show.
  const reportCount = await prisma.report.count({ where: { status: "OPEN" } });
  if (reportCount === 0) {
    const reportablePost = createdPostIds[4];
    if (reportablePost) {
      await prisma.report.create({
        data: {
          reporterId: users[3].id,
          targetType: "POST",
          targetId: reportablePost,
          reason: "Signalement de démonstration : contenu à évaluer par la modération.",
          status: "OPEN",
        },
      });
      console.log("  report: 1 open");
    }
  }

  // Feature flags the admin panel can toggle out of the box.
  await prisma.featureFlag.upsert({
    where: { key: "ai.assistant" },
    create: { key: "ai.assistant", enabled: true, description: "Assistant IA (proxy OpenRouter côté serveur)." },
    update: {},
  });
  await prisma.featureFlag.upsert({
    where: { key: "chat.realtime" },
    create: { key: "chat.realtime", enabled: true, description: "Messagerie temps réel (Socket.IO + replis polling)." },
    update: {},
  });
  console.log("  feature flags: 2");

  await seedTerraNova(prisma, users);
  await seedCityAlerts(prisma, users);

  console.log("\nTest accounts (password: SEED_PASSWORD):");
  for (const account of ACCOUNTS) {
    console.log(`  ${account.role.padEnd(9)} ${account.email}`);
  }

  console.log("\nSeed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
