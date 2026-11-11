import { createFileRoute, Link } from "@tanstack/react-router";
import { useWorkspaceContext } from "@/components/sabi/app-shell";
import { useContracts } from "@/lib/data";
import { formatNaira } from "@/lib/format";
import { Button, Card, PageLoader } from "@/components/sabi/primitives";
import { EmptyState } from "@/components/sabi/cards";
import {
  Avatar,
  ErrorNote,
  PageHeader,
  RequireWorkspaceType,
  StatusBadge,
} from "@/components/sabi/page";

export const Route = createFileRoute("/_authenticated/hired-creatives")({
  head: () => ({ meta: [{ title: "Hired creatives — Sabi" }] }),
  component: Page,
});

function Page() {
  const ws = useWorkspaceContext();
  return (
    <>
      <PageHeader
        title="Hired creatives"
        subtitle="Everyone you've hired and the status of their work."
      />
      <RequireWorkspaceType type="brand">
        <List id={ws.id} />
      </RequireWorkspaceType>
    </>
  );
}

function List({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useContracts("brand", id);
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorNote error={error} retry={() => refetch()} />;
  if ((data ?? []).length === 0)
    return (
      <EmptyState
        title="No one hired yet"
        description="Once you hire a creative from a proposal, they'll show up here."
        action={
          <Button asChild variant="outline">
            <Link to="/proposals-received">Review proposals</Link>
          </Button>
        }
      />
    );
  return (
    <div className="space-y-3">
      {data!.map((c) => (
        <Card key={c.id} className="flex flex-wrap items-center gap-3 p-4">
          <Avatar
            src={c.creative?.avatar_url}
            name={c.creative?.name ?? "?"}
            className="h-12 w-12"
          />
          <div className="min-w-0 flex-1">
            <Link
              to="/creative/$slug"
              params={{ slug: c.creative?.slug ?? "" }}
              className="font-display font-bold hover:underline"
            >
              {c.creative?.name}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {c.project?.title} · {formatNaira(c.agreed_price)}
            </p>
          </div>
          <StatusBadge status={c.project?.status ?? ""} />
          <Button asChild size="sm">
            <Link to="/work/$id" params={{ id: c.project_id }}>
              Open workspace
            </Link>
          </Button>
        </Card>
      ))}
    </div>
  );
}
