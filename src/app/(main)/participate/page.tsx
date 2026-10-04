import type { Metadata } from "next";

import { IdeaBoard } from "@/components/participation/idea-board";
import { DecisionCard } from "@/components/participation/decision-card";
import { ProjectCard } from "@/components/participation/project-card";
import { EmptyState } from "@/components/feedback/empty-state";
import Link from "@/components/ui/link";
import { isStaff } from "@/lib/auth/guards";
import { getAuthContext } from "@/lib/auth/session";
import { getServerDictionary } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { listDecisions, listIdeas, listProjects } from "@/modules/participation/participation.service";

export const metadata: Metadata = { title: "Participer" };

const TABS = ["projects", "votes", "ideas"] as const;

/**
 * F65–F68 — take part in the city: read its projects and say what you think,
 * vote on decisions, propose and support ideas. One page, three tabs, one
 * question each: "what is planned?", "what do we decide?", "what could be better?".
 */
export default async function ParticipatePage({ searchParams }: { readonly searchParams: Promise<{ tab?: string }> }) {
  const raw = (await searchParams).tab;
  const tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as (typeof TABS)[number]) : "projects";
  const [{ t }, context] = await Promise.all([getServerDictionary(), getAuthContext()]);
  const viewer = context?.user ?? null;

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-5">
      <header className="flex flex-col gap-1 px-1">
        <h1 className="text-3xl font-semibold tracking-tight">{t("tn.participate.title")}</h1>
        <p className="text-[0.9375rem] text-muted-foreground">{t("tn.participate.subtitle")}</p>
      </header>

      <nav aria-label={t("tn.participate.title")} className="flex flex-wrap gap-2">
        {TABS.map((id) => (
          <Link
            key={id}
            href={`/participate?tab=${id}`}
            aria-current={tab === id ? "page" : undefined}
            className={cn("rounded-full px-5 py-2.5 text-[0.9375rem] font-semibold", tab === id ? "bg-foreground text-background" : "bg-card hover:bg-accent")}
          >
            {t(`tn.participate.tab.${id}` as never)}
          </Link>
        ))}
      </nav>

      {tab === "projects" ? <Projects signedIn={viewer !== null} viewer={viewer} /> : null}
      {tab === "votes" ? <Votes signedIn={viewer !== null} viewer={viewer} /> : null}
      {tab === "ideas" ? <Ideas signedIn={viewer !== null} staff={viewer !== null && isStaff(viewer)} viewer={viewer} /> : null}
    </div>
  );
}

type Viewer = Awaited<ReturnType<typeof getAuthContext>> extends infer C ? (C extends { user: infer U } ? U : null) | null : null;

async function Projects({ signedIn, viewer }: { readonly signedIn: boolean; readonly viewer: Viewer }) {
  const [{ t }, projects] = await Promise.all([getServerDictionary(), listProjects(viewer)]);
  if (projects.length === 0) return <EmptyState title={t("tn.participate.projects_empty_title")} description={t("tn.participate.projects_empty_body")} />;
  return (
    <div className="flex flex-col gap-4">
      {projects.map((project) => (
        <ProjectCard key={project.slug} project={project} signedIn={signedIn} />
      ))}
    </div>
  );
}

async function Votes({ signedIn, viewer }: { readonly signedIn: boolean; readonly viewer: Viewer }) {
  const [{ t }, decisions] = await Promise.all([getServerDictionary(), listDecisions(viewer)]);
  if (decisions.length === 0) return <EmptyState title={t("tn.participate.votes_empty_title")} description={t("tn.participate.votes_empty_body")} />;
  return (
    <div className="flex flex-col gap-4">
      {decisions.map((decision) => (
        <DecisionCard key={decision.slug} decision={decision} signedIn={signedIn} />
      ))}
    </div>
  );
}

async function Ideas({ signedIn, staff, viewer }: { readonly signedIn: boolean; readonly staff: boolean; readonly viewer: Viewer }) {
  const ideas = await listIdeas({ sort: "supported" }, viewer);
  return <IdeaBoard initial={ideas} signedIn={signedIn} staff={staff} />;
}
