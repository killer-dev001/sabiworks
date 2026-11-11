import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { useWorkspaceContext } from "@/components/sabi/app-shell";
import { useContracts } from "@/lib/data";
import { formatNaira } from "@/lib/format";
import { Card, PageLoader } from "@/components/sabi/primitives";
import { EmptyState } from "@/components/sabi/cards";
import {
  ErrorNote,
  PageHeader,
  RequireWorkspaceType,
  StatCard,
  StatusBadge,
} from "@/components/sabi/page";

export const Route = createFileRoute("/_authenticated/earnings")({
  head: () => ({ meta: [{ title: "Earnings — Sabi" }] }),
  component: Page,
});

function Page() {
  const ws = useWorkspaceContext();
  return (
    <>
      <PageHeader title="Earnings" subtitle="Payments recorded for your projects." />
      <RequireWorkspaceType type="creative">
        <Inner id={ws.id} />
      </RequireWorkspaceType>
    </>
  );
}

function Inner({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useContracts("creative", id);
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorNote error={error} retry={() => refetch()} />;
  const rows = (data ?? []).filter((c) => !c.cancelled_at);
  const sum = (status: string[]) =>
    rows.reduce(
      (n, c) => n + (status.includes(c.payment?.[0]?.status ?? "") ? c.agreed_price : 0),
      0,
    );
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Confirmed"
          value={formatNaira(sum(["confirmed"]))}
          icon={Wallet}
          hint="Payments you've confirmed receiving"
        />
        <StatCard
          label="Awaiting confirmation"
          value={formatNaira(sum(["reported"]))}
          hint="Reported by the brand"
        />
        <StatCard
          label="Not yet paid"
          value={formatNaira(sum(["pending"]))}
          hint="Agreed but unpaid"
        />
      </div>
      <p className="mt-4 rounded-xl bg-gold-soft/50 p-3 text-xs text-muted-foreground">
        During the pilot, brands pay creatives directly and record the payment in Sabi. Confirm each
        payment once the money reaches you. Sabi doesn't hold funds.
      </p>
      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title="No earnings yet"
            description="Once you're hired, agreed payments are tracked here."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((c) => (
              <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link
                    to="/work/$id"
                    params={{ id: c.project_id }}
                    className="block truncate font-display font-bold hover:underline"
                  >
                    {c.project?.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{c.brand?.name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{formatNaira(c.agreed_price)}</span>
                  <StatusBadge kind="payment" status={c.payment?.[0]?.status ?? "pending"} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
