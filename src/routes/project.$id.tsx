import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, CalendarClock, MapPin, Paperclip, Wallet } from "lucide-react";
import { useCurrentWorkspace } from "@/lib/hooks";
import { useProject } from "@/lib/data";
import { useAction } from "@/lib/actions";
import { supabase } from "@/integrations/supabase/client";
import { budgetLabel, daysUntil, formatNaira } from "@/lib/format";
import { PublicHeader, PublicFooter } from "@/components/sabi/public-chrome";
import { Badge, Button, Card, PageLoader } from "@/components/sabi/primitives";
import { EmptyState } from "@/components/sabi/cards";
import { Confirm, ErrorNote, StatusBadge } from "@/components/sabi/page";
import {
  ProposalForm,
  ProposalsPanel,
  ReportButton,
  SaveProjectButton,
} from "@/components/sabi/proposals";

export const Route = createFileRoute("/project/$id")({
  head: () => ({
    meta: [
      { title: "Project brief — Sabi" },
      {
        name: "description",
        content: "View the brief, budget and deliverables, then send a proposal.",
      },
    ],
  }),
  component: ProjectPage,
});

function ProjectPage() {
  const { id } = Route.useParams();
  const { data: project, isLoading, error, refetch } = useProject(id);
  const { userId, workspace, loading } = useCurrentWorkspace();
  const { run, isBusy } = useAction();

  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 pt-8">
        {isLoading || loading ? (
          <PageLoader />
        ) : error ? (
          <ErrorNote error={error} retry={() => refetch()} />
        ) : !project ? (
          <EmptyState
            title="Project not found"
            description="It may have been removed, or it's a draft that only its owner can see."
            action={
              <Button asChild variant="outline">
                <Link to="/projects">Browse projects</Link>
              </Button>
            }
          />
        ) : (
          (() => {
            const isOwner = !!userId && project.brand?.owner_id === userId;
            const isHiredCreative =
              !!workspace && workspace.id === project.hired_creative_workspace_id;
            const open = ["published", "in_discussion"].includes(project.status);
            return (
              <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
                <article>
                  {project.image_url && (
                    <div className="aspect-[16/7] overflow-hidden rounded-3xl">
                      <img src={project.image_url} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <Badge tone="gold">{project.category}</Badge>
                    <StatusBadge status={project.status} />
                    {project.is_demo && <Badge tone="muted">Demo project</Badge>}
                  </div>
                  <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">
                    {project.title}
                  </h1>
                  {project.brand && (
                    <Link
                      to="/brand/$slug"
                      params={{ slug: project.brand.slug }}
                      className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
                    >
                      {project.brand.name}{" "}
                      {project.brand.verified && <BadgeCheck className="h-4 w-4 text-primary" />}
                    </Link>
                  )}
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    <span className="inline-flex items-center gap-1.5 font-semibold">
                      <Wallet className="h-4 w-4 text-ember" />
                      {budgetLabel(project.budget_type, project.budget_min, project.budget_max)}
                    </span>
                    {project.deadline && (
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-4 w-4 text-ember" />
                        Deadline{" "}
                        {new Date(project.deadline).toLocaleDateString("en-NG", {
                          dateStyle: "medium",
                        })}{" "}
                        ({daysUntil(project.deadline)})
                      </span>
                    )}
                    {project.proposal_deadline && open && (
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        Proposals close{" "}
                        {new Date(project.proposal_deadline).toLocaleDateString("en-NG", {
                          dateStyle: "medium",
                        })}
                      </span>
                    )}
                    {project.location && (
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-ember" />
                        {project.is_remote ? "Remote" : project.location}
                      </span>
                    )}
                  </div>
                  <section className="mt-8">
                    <h2 className="font-display text-lg font-bold">About this project</h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                      {project.description}
                    </p>
                  </section>
                  {project.deliverables.length > 0 && (
                    <section className="mt-8">
                      <h2 className="font-display text-lg font-bold">Deliverables</h2>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                        {project.deliverables.map((d) => (
                          <li key={d}>{d}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  {(project.skills.length > 0 || project.preferred_experience) && (
                    <section className="mt-8">
                      <h2 className="font-display text-lg font-bold">
                        Preferred skills & experience
                      </h2>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {project.skills.map((s) => (
                          <Badge key={s} tone="green">
                            {s}
                          </Badge>
                        ))}
                      </div>
                      {project.preferred_experience && (
                        <p className="mt-2 text-sm text-foreground/85">
                          {project.preferred_experience}
                        </p>
                      )}
                    </section>
                  )}
                  {project.attachments.length > 0 && (
                    <section className="mt-8">
                      <h2 className="font-display text-lg font-bold">Attachments</h2>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {project.attachments.map((a, i) => (
                          <a
                            key={a}
                            href={a}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold hover:bg-secondary/70"
                          >
                            <Paperclip className="h-3 w-3" /> Reference {i + 1}
                          </a>
                        ))}
                      </div>
                    </section>
                  )}
                  {isOwner && (
                    <section className="mt-10">
                      <h2 className="mb-4 font-display text-xl font-bold">Proposals</h2>
                      <ProposalsPanel project={project} />
                    </section>
                  )}
                </article>

                <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                  {!userId ? (
                    <Card className="p-5">
                      <h3 className="font-display text-lg font-bold">Interested?</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Sign in with a creative workspace to send a proposal.
                      </p>
                      <Button asChild className="mt-4 w-full">
                        <Link
                          to="/auth"
                          search={{ mode: "login", redirect: `/project/${project.id}` }}
                        >
                          Sign in to apply
                        </Link>
                      </Button>
                    </Card>
                  ) : isOwner ? (
                    <Card className="space-y-3 p-5">
                      <h3 className="font-display text-lg font-bold">Manage this project</h3>
                      <p className="text-sm text-muted-foreground">You posted this project.</p>
                      <div className="flex flex-wrap gap-2">
                        {["draft", "published", "in_discussion"].includes(project.status) && (
                          <Button asChild size="sm" variant="outline">
                            <Link to="/post-project" search={{ edit: project.id }}>
                              Edit brief
                            </Link>
                          </Button>
                        )}
                        {project.status === "draft" && (
                          <Button
                            size="sm"
                            disabled={isBusy("pub")}
                            onClick={() =>
                              run(
                                "pub",
                                () =>
                                  supabase.rpc("set_project_status", {
                                    p_project_id: project.id,
                                    p_status: "published",
                                  }),
                                "Project published.",
                              )
                            }
                          >
                            Publish
                          </Button>
                        )}
                        {open && (
                          <Confirm
                            title="Close this listing?"
                            description="It will stop appearing in search and creatives can't send new proposals. You can reopen it later."
                            confirmLabel="Close listing"
                            destructive
                            onConfirm={() =>
                              run(
                                "close",
                                () =>
                                  supabase.rpc("set_project_status", {
                                    p_project_id: project.id,
                                    p_status: "cancelled",
                                  }),
                                "Listing closed.",
                              )
                            }
                          >
                            <Button size="sm" variant="ghost">
                              Close listing
                            </Button>
                          </Confirm>
                        )}
                        {project.status === "cancelled" && !project.hired_creative_workspace_id && (
                          <Button
                            size="sm"
                            disabled={isBusy("reopen")}
                            onClick={() =>
                              run(
                                "reopen",
                                () =>
                                  supabase.rpc("set_project_status", {
                                    p_project_id: project.id,
                                    p_status: "published",
                                  }),
                                "Listing reopened.",
                              )
                            }
                          >
                            Reopen
                          </Button>
                        )}
                        {project.hired_creative_workspace_id && (
                          <Button asChild size="sm">
                            <Link to="/work/$id" params={{ id: project.id }}>
                              Open workspace
                            </Link>
                          </Button>
                        )}
                      </div>
                    </Card>
                  ) : isHiredCreative ? (
                    <Card className="p-5">
                      <h3 className="font-display text-lg font-bold">
                        You're hired for this project
                      </h3>
                      <Button asChild className="mt-4 w-full">
                        <Link to="/work/$id" params={{ id: project.id }}>
                          Open project workspace
                        </Link>
                      </Button>
                    </Card>
                  ) : workspace?.type === "creative" ? (
                    <>
                      <ProposalForm project={project} workspace={workspace} />
                      <div className="flex gap-2">
                        <SaveProjectButton projectId={project.id} workspace={workspace} />
                      </div>
                    </>
                  ) : (
                    <Card className="p-5">
                      <h3 className="font-display text-lg font-bold">Apply as a creative</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        You're in a brand workspace. Switch to (or create) a creative workspace to
                        send proposals.
                      </p>
                      <Button asChild variant="outline" className="mt-4 w-full">
                        <Link to="/workspace">Choose workspace</Link>
                      </Button>
                    </Card>
                  )}
                  {userId && !isOwner && (
                    <ReportButton
                      targetType="project"
                      targetId={project.id}
                      label="Report this project"
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {project.budget_type === "fixed" ? "Fixed budget" : "Budget range"} · Posted{" "}
                    {new Date(project.created_at).toLocaleDateString("en-NG", {
                      dateStyle: "medium",
                    })}
                    {project.budget_min ? ` · from ${formatNaira(project.budget_min)}` : ""}
                  </p>
                </aside>
              </div>
            );
          })()
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
