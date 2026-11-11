import { createFileRoute, Link } from "@tanstack/react-router";
import { useBrandProjects, useBrandProposals } from "@/lib/data";
import { useWorkspaceContext } from "@/components/sabi/app-shell";
import { PageLoader } from "@/components/sabi/primitives";
import { EmptyState } from "@/components/sabi/cards";
import {
  ErrorNote,
  PageHeader,
  RequireWorkspaceType,
  SectionCard,
  StatusBadge,
} from "@/components/sabi/page";
import { ProposalsPanel } from "@/components/sabi/proposals";
import { Button } from "@/components/sabi/primitives";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/proposals-received")({
  head: () => ({ meta: [{ title: "Proposals received — Sabi" }] }),
  component: Page,
});

function Page() {
  const ws = useWorkspaceContext();
  return (
    <>
      <PageHeader title="Proposals received" subtitle="Compare creatives, shortlist and hire." />
      <RequireWorkspaceType type="brand">
        <Inner brandId={ws.id} />
      </RequireWorkspaceType>
    </>
  );
}

function Inner({ brandId }: { brandId: string }) {
  const projects = useBrandProjects(brandId);
  const ids = (projects.data ?? []).map((p) => p.id);
  const proposals = useBrandProposals(ids);
  const [openId, setOpenId] = useState<string | null>(null);
  if (projects.isLoading || proposals.isLoading) return <PageLoader />;
  if (projects.error) return <ErrorNote error={projects.error} retry={() => projects.refetch()} />;
  const withProposals = (projects.data ?? [])
    .filter((p) => p.status !== "draft")
    .map((p) => ({
      project: p,
      items: (proposals.data ?? []).filter(
        (x) => x.project_id === p.id && x.status !== "withdrawn",
      ),
    }))
    .filter((x) => x.items.length > 0);
  if (withProposals.length === 0)
    return (
      <EmptyState
        title="No proposals yet"
        description="When creatives respond to your projects, their proposals will show up here."
        action={
          <Button asChild variant="outline">
            <Link to="/posted-projects">View your projects</Link>
          </Button>
        }
      />
    );
  return (
    <div className="space-y-4">
      {withProposals.map(({ project, items }) => (
        <SectionCard key={project.id}>
          <button
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => setOpenId(openId === project.id ? null : project.id)}
            aria-expanded={openId === project.id}
          >
            <span className="min-w-0">
              <span className="block truncate font-display text-lg font-bold">{project.title}</span>
              <span className="text-xs text-muted-foreground">
                {items.length} proposal{items.length === 1 ? "" : "s"} ·{" "}
                {items.filter((i) => i.status === "shortlisted").length} shortlisted
              </span>
            </span>
            <StatusBadge status={project.status} />
          </button>
          {openId === project.id && (
            <div className="mt-4">
              <ProposalsPanel project={project} />
            </div>
          )}
        </SectionCard>
      ))}
    </div>
  );
}
