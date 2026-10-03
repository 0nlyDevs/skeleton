/**
 * Districts for the test accounts and the city alerts of the demo: a general
 * message to everyone, rising water in the south and a heat wave in the north.
 *
 * Idempotent: a district is only set on an account that has none, and each
 * alert is created once (by slug).
 */

import type { prisma as Prisma } from "../src/lib/db/prisma";

type Client = typeof Prisma;
type SeedUser = { id: string; email: string; role: string };

const DISTRICTS: Readonly<Record<string, "NOVA_PRIME" | "SUNKEN_DELTA" | "EMBER_WASTES" | "SKYPORT_ISLES" | "OBSIDIAN_COAST">> = {
  "cocobrowniees@gmail.com": "NOVA_PRIME",
  "hei.colombe@gmail.com": "NOVA_PRIME",
  "hei.tafita.2@gmail.com": "OBSIDIAN_COAST",
  "hei.harena.2@gmail.com": "EMBER_WASTES",
  "colomberakotonjanahary@gmail.com": "SUNKEN_DELTA",
  "hei.jonathan.3@gmail.com": "SKYPORT_ISLES",
};

const ALERTS = [
  {
    slug: "exercice-d-alerte-generale-samedi",
    title: "Exercice d'alerte générale samedi à 10 h",
    summary: "Les sirènes de toute la cité sonneront samedi à 10 h pendant deux minutes. Il s'agit d'un exercice.",
    body:
      "Samedi à 10 h, les sirènes de tous les quartiers seront testées pendant deux minutes.\n\n• Aucune action n'est nécessaire : ce n'est pas une alerte réelle.\n• Profitez-en pour repérer l'abri le plus proche de votre module.\n• Les personnes sensibles au bruit peuvent fermer les volets acoustiques.",
    scope: "ALL",
    severity: "INFORMATION",
    hoursAgo: 3,
  },
  {
    slug: "montee-des-eaux-dans-le-quartier-sud",
    title: "Montée inhabituelle de l'eau dans le sud",
    summary: "Le niveau de l'eau monte dans Sunken Delta et sur Obsidian Coast. Évitez les berges et les sous-niveaux.",
    body:
      "Une montée inhabituelle du niveau de l'eau est observée dans les quartiers du sud.\n\n• Ne descendez pas dans les sous-niveaux et les parkings.\n• Éloignez-vous des berges, des quais de Coral Harbor et des passerelles du Tidewalk Bazaar.\n• Mettez en hauteur vos objets de valeur et vos documents.\n• Si l'eau entre dans votre module, montez à l'étage et signalez-vous aux services.",
    scope: "SOUTH",
    severity: "WARNING",
    hoursAgo: 1,
  },
  {
    slug: "vague-de-chaleur-extreme-au-nord",
    title: "Vague de chaleur extrême au nord",
    summary: "Températures extrêmes à Verdant Basin et Ember Wastes. Restez à l'intérieur aux heures chaudes et buvez régulièrement.",
    body:
      "Une vague de chaleur extrême touche les quartiers du nord.\n\n• Restez à l'intérieur entre 11 h et 17 h et fermez les protections solaires.\n• Buvez de l'eau régulièrement, sans attendre d'avoir soif.\n• Prenez des nouvelles des personnes âgées, des enfants et des personnes malades autour de vous.\n• En cas de malaise, de confusion ou de forte fièvre, contactez le centre de santé.",
    scope: "NORTH",
    severity: "CRITICAL",
    hoursAgo: 0.5,
  },
] as const;

export async function seedCityAlerts(prisma: Client, users: readonly SeedUser[]): Promise<void> {
  for (const user of users) {
    const district = DISTRICTS[user.email];
    if (district) await prisma.user.updateMany({ where: { id: user.id, cityZone: null }, data: { cityZone: district } });
  }

  const author = users.find((user) => user.role === "ADMIN") ?? users[0];
  if (!author) return;
  let created = 0;
  for (const alert of ALERTS) {
    if (await prisma.announcement.findUnique({ where: { slug: alert.slug }, select: { id: true } })) continue;
    await prisma.announcement.create({
      data: {
        slug: alert.slug,
        title: alert.title,
        summary: alert.summary,
        body: alert.body,
        category: "ALERT",
        alertScope: alert.scope,
        alertSeverity: alert.severity,
        alertStatus: "ACTIVE",
        pinned: true,
        authorId: author.id,
        publishedAt: new Date(Date.now() - alert.hoursAgo * 3_600_000),
      },
    });
    created += 1;
  }
  if (created > 0) console.log(`  city alerts: ${created}`);
}
