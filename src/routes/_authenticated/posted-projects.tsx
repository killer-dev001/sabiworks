import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/components/sabi/app-shell";
import { useAction } from "@/lib/actions";
import { useBrandProjects } from "@/lib/data";
import { budgetLabel, timeAgo } from "@/lib/format";
import { Button, Card, PageLoader } from "@/components/sabi/primitives";
import { EmptyState } from "@/components/sabi/cards";
import {
  Confirm,
  ErrorNote,
  PageHeader,
  RequireWorkspaceType,
  StatusBadge,
} from "@/components/sabi/page";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/posted-projects")({
  head: () => ({ meta: [{ title: "Posted projects — Sabi" }] }),
  component: Page,
});

const FILTERS = [
  { key: "all", label: "All", match: () => true },
  { key: "draft", label: "Drafts", match: (s: string) => s === "draft" },
  { key: "open", label: "Open", match: (s: string) => ["published", "in_discussion"].includes(s) },
  {
    key: "active",
    label: "In progress",
    match: (s: string) => ["hired", "in_progress", "in_review", "revision_requested"].includes(s),
  },
  { key: "done", label: "Completed", match: (s: string) => s === "completed" },
  { key: "closed", label: "Closed", match: (s: string) => s === "cancelled" },
];

function Page() {
  const ws = useWorkspaceContext();
  return (
    <>
      <PageHeader
        title="Posted projects"
        subtitle="Drafts, open briefs and work in progress."
        actions={
          <Button asChild size="sm" variant="ember">
            <Link to="/post-project">+ Post a project</Link>
          </Button>
        }
      />
      <RequireWorkspaceType type="brand">
        <List brandId={ws.id} />
      </RequireWorkspaceType>
    </>
  );
}

function List({ brandId }: { brandId: string }) {
  const { data, isLoading, error, refetch } = useBrandProjects(brandId);
  const { run, isBusy } = useAction();
  const [filter, setFilter] = useState("all");
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorNote error={error} retry={() => refetch()} />;
  const f = FILTERS.find((x) => x.key === filter)!;
  const rows = (data ?? []).filter((p) => f.match(p.status));
  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((x) => (
          <button
            key={x.key}
            onClick={() => setFilter(x.key)}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold",
              filter === x.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-secondary",
            )}
          >
            {x.label} ({(data ?? []).filter((p) => x.match(p.status)).length})
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title={filter === "all" ? "No projects yet" : "Nothing here"}
          description={
            filter === "all"
              ? "Post your first brief and start receiving proposals."
              : "No projects match this filter."
          }
          action={
            filter === "all" ? (
              <Button asChild variant="ember">
                <Link to="/post-project">Post a project</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link
                  to="/project/$id"
                  params={{ id: p.id }}
                  className="block truncate font-display font-bold hover:underline"
                >
                  {p.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {p.category} · {budgetLabel(p.budget_type, p.budget_min, p.budget_max)} ·{" "}
                  {timeAgo(p.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={p.status} />
                {["draft", "published", "in_discussion"].includes(p.status) && (
                  <Button asChild size="sm" variant="outline">
                    <Link to="/post-project" search={{ edit: p.id }}>
                      Edit
                    </Link>
                  </Button>
                )}
                {p.status === "draft" && (
                  <Button
                    size="sm"
                    disabled={isBusy(p.id)}
                    onClick={() =>
                      run(
                        p.id,
                        () =>
                          supabase.rpc("set_project_status", {
                            p_project_id: p.id,
                            p_status: "published",
                          }),
                        "Project published.",
                      )
                    }
                  >
                    Publish
                  </Button>
                )}
                {["published", "in_discussion"].includes(p.status) && (
                  <Confirm
                    title="Close this listing?"
                    description="Creatives won't be able to send new proposals. You can reopen it later."
                    confirmLabel="Close listing"
                    destructive
                    onConfirm={() =>
                      run(
                        p.id,
                        () =>
                          supabase.rpc("set_project_status", {
                            p_project_id: p.id,
                            p_status: "cancelled",
                          }),
                        "Listing closed.",
                      )
                    }
                  >
                    <Button size="sm" variant="ghost">
                      Close
                    </Button>
                  </Confirm>
                )}
                {p.status === "cancelled" && !p.hired_creative_workspace_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy(p.id)}
                    onClick={() =>
                      run(
                        p.id,
                        () =>
                          supabase.rpc("set_project_status", {
                            p_project_id: p.id,
                            p_status: "published",
                          }),
                        "Listing reopened.",
                      )
                    }
                  >
                    Reopen
                  </Button>
                )}
                {p.status === "draft" && (
                  <Confirm
                    title="Delete this draft?"
                    description="This can't be undone."
                    confirmLabel="Delete"
                    destructive
                    onConfirm={() =>
                      run(
                        p.id,
                        () => supabase.from("projects").delete().eq("id", p.id),
                        "Draft deleted.",
                      )
                    }
                  >
                    <Button size="sm" variant="ghost">
                      Delete
                    </Button>
                  </Confirm>
                )}
                {p.hired_creative_workspace_id && (
                  <Button asChild size="sm">
                    <Link to="/work/$id" params={{ id: p.id }}>
                      Workspace
                    </Link>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
