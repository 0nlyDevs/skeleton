/**
 * Seed — jury accounts and realistic demo data.
 *
 * The passwords below are **documented test credentials** for the hackathon jury,
 * printed here and in the README on purpose. They are not production secrets; the
 * deployed instance is a contest demo. In a real deployment you would rotate or
 * delete these accounts (README explains how).
 *
 * Idempotent: every step is an upsert or a guarded create, so running the seed
 * twice neither duplicates nor destroys.
 *
 * This file owns the mechanism. The content lives in `./demo-data.ts`, which is
 * the single place to edit when the subject is known — see the note there.
 */

import { hashPassword } from "../src/lib/auth/password";
import { encryptField } from "../src/lib/crypto/field-encryption";
// The shared client, not a fresh one: Prisma 7 needs a driver adapter to
// construct it, and `lib/db/prisma.ts` is the single place that knows how to
// turn DATABASE_URL into driver pool options.
import { prisma } from "../src/lib/db/prisma";

import {
  DEMO_MESSAGES,
  DEMO_NOTIFICATIONS,
  DEMO_POSTS,
  JURY_ACCOUNTS as ACCOUNTS,
  JURY_PASSWORD,
} from "./demo-data";

/** Fixed id, so re-seeding updates the global room instead of adding another. */
const GLOBAL_ROOM = "global";

/** What `upsertUser` gives back, narrowed to the fields the seed reads. */
type SeededUser = { id: string };

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
    return prisma.user.update({
      where: { id: existing.id },
      data: { role: account.role, emailVerified: true, bio: account.bio, ...profileOf(account) },
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
  console.log("Seeding jury accounts and demo data…");

  const passwordHash = await hashPassword(JURY_PASSWORD);

  // Annotated explicitly: `upsertUser` returns the union of `update` and
  // `create`, and TS will not name that union for an inferred `[]` when the
  // account type comes from an imported `as const` tuple.
  const users: SeededUser[] = [];
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
  for (const [index, post] of DEMO_POSTS.entries()) {
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
    for (const message of DEMO_MESSAGES) {
      await prisma.message.create({
        data: {
          roomId: room.id,
          senderId: users[message.author].id,
          // Encrypted, exactly as `messages.repository.ts` writes it. Seeding
          // plaintext here meant the demo messages never exercised the
          // encryption-at-rest path — and a key mismatch would have shown up as
          // empty messages in the one place a juror is guaranteed to look.
          content: encryptField(message.content),
        },
      });
    }
    console.log(`  messages: ${DEMO_MESSAGES.length}`);
  }

  // Notifications for the standard user.
  const notificationCount = await prisma.notification.count({ where: { userId: users[2].id } });
  if (notificationCount === 0) {
    await prisma.notification.createMany({
      // The links used to point at `/dashboard` and `/chat`, neither of which is a
      // route in this app — every seeded notification 404'd on click.
      data: DEMO_NOTIFICATIONS.map((notification) => ({
        userId: users[2].id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        link: notification.link,
        read: notification.read,
      })),
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

  console.log("\nJury credentials (documented in README.md):");
  for (const account of ACCOUNTS) {
    console.log(`  ${account.role.padEnd(9)} ${account.email} / ${JURY_PASSWORD}`);
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
