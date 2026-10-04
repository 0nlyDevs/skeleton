/**
 * F65–F68 — sample projects, one vote and a few ideas, so the participation
 * page is alive the first time it opens. Idempotent: each item is created
 * once, by slug or reference.
 */

import type { prisma as Prisma } from "../src/lib/db/prisma";

type Client = typeof Prisma;

const day = (offset: number) => new Date(Date.now() + offset * 24 * 60 * 60_000);

const PROJECTS = [
  {
    slug: "serres-suspendues-de-verdant-basin",
    title: "Serres suspendues de Verdant Basin",
    summary: "Doubler la production de légumes frais de la cité avec trois nouvelles serres suspendues.",
    body: "Trois serres suspendues seront montées au-dessus du marché de Greenroot pour cultiver sans prendre de place au sol. Elles fourniront les cantines des écoles et la banque alimentaire. Les travaux se font par tranches pour que le marché reste ouvert.",
    zone: "VERDANT_BASIN" as const,
    budget: 4_800_000,
    status: "IN_PROGRESS" as const,
    startsOn: day(-60),
    endsOn: day(120),
    progress: 45,
  },
  {
    slug: "navette-nocturne-nova-prime-sunken-delta",
    title: "Navette de nuit entre Nova Prime et Sunken Delta",
    summary: "Une navette toutes les 40 minutes de 22 h à 5 h pour les équipes de nuit et les urgences.",
    body: "Aujourd'hui, la dernière navette part à 22 h. Le projet ajoute une ligne de nuit entre le centre et le delta, avec un arrêt à l'hôpital Asclépios. Les habitants sont invités à dire si les horaires leur conviennent.",
    zone: "SUNKEN_DELTA" as const,
    budget: 1_250_000,
    status: "PLANNED" as const,
    startsOn: day(30),
    endsOn: day(210),
    progress: 0,
  },
  {
    slug: "digue-verte-obsidian-coast",
    title: "Digue verte d'Obsidian Coast",
    summary: "Protéger la côte de la montée des eaux avec une digue plantée.",
    body: "La digue est terminée : elle retient l'eau et accueille un sentier planté. Merci aux habitants qui ont donné leur avis pendant la consultation.",
    zone: "OBSIDIAN_COAST" as const,
    budget: 7_300_000,
    status: "DONE" as const,
    startsOn: day(-400),
    endsOn: day(-20),
    progress: 100,
  },
];

export async function seedParticipation(prisma: Client): Promise<void> {
  let created = 0;
  for (const project of PROJECTS) {
    if (await prisma.cityProject.findUnique({ where: { slug: project.slug }, select: { id: true } })) continue;
    await prisma.cityProject.create({ data: { ...project, consultationOpen: project.status !== "DONE" } });
    created += 1;
  }

  if (!(await prisma.decision.findUnique({ where: { slug: "horaires-du-marche-de-greenroot" }, select: { id: true } }))) {
    await prisma.decision.create({
      data: {
        slug: "horaires-du-marche-de-greenroot",
        question: "Le marché de Greenroot doit-il ouvrir aussi le dimanche matin ?",
        description: "Aujourd'hui le marché est fermé le dimanche. L'ouverture demanderait deux agents de plus. Le Haut Conseil suivra le choix des habitants.",
        opensAt: day(-1),
        closesAt: day(6),
        options: { create: [{ label: "Oui, ouvrir le dimanche matin", position: 0 }, { label: "Non, garder le dimanche fermé", position: 1 }, { label: "Oui, un dimanche sur deux", position: 2 }] },
      },
    });
    created += 1;
  }

  const author = await prisma.user.findUnique({ where: { email: "colomberakotonjanahary@gmail.com" }, select: { id: true } });
  if (author) {
    const ideas = [
      { reference: "ID-000101", title: "Des bancs ombragés le long du canal de Sunken Delta", body: "En été, le chemin du canal est trop chaud à midi. Quelques bancs avec une toile ombragée permettraient de s'arrêter.", zone: "SUNKEN_DELTA" as const },
      { reference: "ID-000102", title: "Une consigne à vélos à la gare maglev", body: "Beaucoup d'habitants viennent à vélo à la gare mais n'osent pas le laisser. Une consigne fermée réglerait le problème.", zone: "NOVA_PRIME" as const },
    ];
    for (const idea of ideas) {
      if (await prisma.idea.findUnique({ where: { reference: idea.reference }, select: { id: true } })) continue;
      await prisma.idea.create({ data: { ...idea, authorId: author.id } });
      created += 1;
    }
  }
  console.log(`  participation: ${created} created`);
}
