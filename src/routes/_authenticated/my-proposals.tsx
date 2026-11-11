import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useWorkspaceContext } from "@/components/sabi/app-shell";
import { useCreativeProposals } from "@/lib/data";
import { formatNaira, timeAgo } from "@/lib/format";
import { Button, Card, PageLoader } from "@/components/sabi/primitives";
import { EmptyState } from "@/components/sabi/cards";
import { ErrorNote, PageHeader, RequireWorkspaceType, StatusBadge } from "@/components/sabi/page";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/my-proposals")({
  head: () => ({ meta: [{ title: "My proposals — Sabi" }] }),
  component: Page,
});

const TABS = ["all", "submitted", "shortlisted", "accepted", "declined", "withdrawn"] as const;

function Page() {
  const ws = useWorkspaceContext();
  return (
    <>
      <PageHeader title="My proposals" subtitle="Track every proposal you've sent." />
      <RequireWorkspaceType type="creative">
        <List id={ws.id} />
      </RequireWorkspaceType>
    </>
  );
}

function List({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useCreativeProposals(id);
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorNote error={error} retry={() => refetch()} />;
  const rows = (data ?? []).filter((p) => tab === "all" || p.status === tab);
  return (
    <>
      <div className="mb-4 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-bold capitalize",
              tab === t
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-secondary",
            )}
          >
            {t} ({(data ?? []).filter((p) => t === "all" || p.status === t).length})
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No proposals here"
          description={
            tab === "all"
              ? "Find a project that fits your skills and send your first proposal."
              : "Nothing with this status yet."
          }
          action={
            tab === "all" ? (
              <Button asChild variant="ember">
                <Link to="/available-projects">Find projects</Link>
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
                  params={{ id: p.project_id }}
                  className="block truncate font-display font-bold hover:underline"
                >
                  {p.project?.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {p.project?.brand?.name} · {formatNaira(p.price)} · sent {timeAgo(p.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge kind="proposal" status={p.status} />
                {p.status === "accepted" && (
                  <Button asChild size="sm">
                    <Link to="/work/$id" params={{ id: p.project_id }}>
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
