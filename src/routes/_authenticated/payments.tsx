import { createFileRoute, Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { useWorkspaceContext } from "@/components/sabi/app-shell";
import { useContracts } from "@/lib/data";
import { formatNaira } from "@/lib/format";
import { Button, Card, PageLoader } from "@/components/sabi/primitives";
import { EmptyState } from "@/components/sabi/cards";
import {
  ErrorNote,
  PageHeader,
  RequireWorkspaceType,
  StatCard,
  StatusBadge,
} from "@/components/sabi/page";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({ meta: [{ title: "Payments — Sabi" }] }),
  component: Page,
});

function Page() {
  const ws = useWorkspaceContext();
  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Agreed amounts and payment status for hired creatives."
      />
      <RequireWorkspaceType type="brand">
        <Inner id={ws.id} />
      </RequireWorkspaceType>
    </>
  );
}

function Inner({ id }: { id: string }) {
  const { data, isLoading, error, refetch } = useContracts("brand", id);
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorNote error={error} retry={() => refetch()} />;
  const rows = (data ?? []).filter((c) => !c.cancelled_at);
  const total = (s: string[]) =>
    rows.reduce((n, c) => n + (s.includes(c.payment?.[0]?.status ?? "") ? c.agreed_price : 0), 0);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Paid & confirmed"
          value={formatNaira(total(["confirmed"]))}
          icon={Wallet}
        />
        <StatCard
          label="Reported, awaiting confirmation"
          value={formatNaira(total(["reported"]))}
        />
        <StatCard label="Outstanding" value={formatNaira(total(["pending"]))} />
      </div>
      <p className="mt-4 rounded-xl bg-gold-soft/50 p-3 text-xs text-muted-foreground">
        Pilot payments are arranged directly with the creative. Record your transfer reference here
        so both of you have a receipt. Sabi doesn't hold funds or provide escrow.
      </p>
      <div className="mt-6">
        {rows.length === 0 ? (
          <EmptyState
            title="No payments yet"
            description="When you hire a creative, the agreed amount appears here."
          />
        ) : (
          <div className="space-y-3">
            {rows.map((c) => (
              <Card key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-display font-bold">{c.project?.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.creative?.name}
                    {c.payment?.[0]?.provider_reference
                      ? ` · Ref ${c.payment[0].provider_reference}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold">{formatNaira(c.agreed_price)}</span>
                  <StatusBadge kind="payment" status={c.payment?.[0]?.status ?? "pending"} />
                  <Button asChild size="sm" variant="outline">
                    <Link to="/work/$id" params={{ id: c.project_id }}>
                      {c.payment?.[0]?.status === "pending" ? "Record payment" : "View"}
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
