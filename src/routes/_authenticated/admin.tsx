import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/lib/hooks";
import { useAction } from "@/lib/actions";
import { formatNaira, timeAgo } from "@/lib/format";
import { Badge, Button, Card, Input, PageLoader, Select } from "@/components/sabi/primitives";
import { EmptyState } from "@/components/sabi/cards";
import { Confirm, ErrorNote, PageHeader, StatusBadge } from "@/components/sabi/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Sabi" }] }),
  component: AdminPage,
});

// The UI check below is only a convenience. Every admin query is filtered by RLS and
// every admin action is re-checked inside its database function.
function AdminPage() {
  const { userId } = useSession();
  const { data: isAdmin, isLoading } = useIsAdmin(userId);
  if (isLoading) return <PageLoader />;
  if (!isAdmin)
    return <EmptyState title="Admins only" description="You don't have access to this page." />;
  return (
    <>
      <PageHeader title="Admin" subtitle="Moderation, listings and payment records." />
      <Tabs defaultValue="reports">
        <TabsList className="mb-4 h-auto flex-wrap justify-start">
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="workspaces">Workspaces</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>
        <TabsContent value="reports">
          <Reports />
        </TabsContent>
        <TabsContent value="workspaces">
          <Workspaces />
        </TabsContent>
        <TabsContent value="projects">
          <Projects />
        </TabsContent>
        <TabsContent value="payments">
          <Payments />
        </TabsContent>
      </Tabs>
    </>
  );
}

function useAdminList<T>(
  key: string,
  load: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
) {
  return useQuery({
    queryKey: ["admin", key],
    queryFn: async () => {
      const { data, error } = await load();
      if (error) throw error;
      return data ?? [];
    },
  });
}

function Reports() {
  const { data, isLoading, error, refetch } = useAdminList("reports", () =>
    supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(100),
  );
  const { run, isBusy } = useAction();
  const [notes, setNotes] = useState<Record<string, string>>({});
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorNote error={error} retry={() => refetch()} />;
  if (!data?.length)
    return <EmptyState title="No reports" description="Reports from users appear here." />;
  return (
    <div className="space-y-3">
      {data.map((r) => (
        <Card key={r.id} className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">
              {r.reason}{" "}
              <span className="font-normal text-muted-foreground">· {r.target_type}</span>
            </p>
            <Badge
              tone={r.status === "open" ? "coral" : r.status === "reviewing" ? "gold" : "green"}
            >
              {r.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {timeAgo(r.created_at)} · target {r.target_id}
          </p>
          {r.details && <p className="mt-2 text-sm">{r.details}</p>}
          {r.admin_note && (
            <p className="mt-2 rounded-xl bg-secondary p-2 text-xs">Note: {r.admin_note}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              aria-label="Admin note"
              className="h-9 max-w-xs"
              placeholder="Outcome note"
              value={notes[r.id] ?? ""}
              onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
            />
            {(["reviewing", "resolved", "dismissed"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant="outline"
                disabled={isBusy(r.id + s) || r.status === s}
                onClick={() =>
                  run(
                    r.id + s,
                    () =>
                      supabase.rpc("admin_resolve_report", {
                        p_report_id: r.id,
                        p_status: s,
                        p_note: notes[r.id] ?? "",
                      }),
                    `Marked ${s}.`,
                  )
                }
              >
                {s}
              </Button>
            ))}
            {r.target_type === "workspace" && (
              <Confirm
                title="Suspend this workspace?"
                description="It will disappear from public pages and the owner is notified."
                confirmLabel="Suspend"
                destructive
                onConfirm={() =>
                  run(
                    r.id + "sus",
                    () =>
                      supabase.rpc("admin_set_workspace_suspended", {
                        p_workspace_id: r.target_id,
                        p_suspended: true,
                      }),
                    "Workspace suspended.",
                  )
                }
              >
                <Button size="sm" variant="ghost">
                  Suspend target
                </Button>
              </Confirm>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Workspaces() {
  const { data, isLoading, error, refetch } = useAdminList("workspaces", () =>
    supabase
      .from("workspaces")
      .select("*")
      .eq("is_demo", false)
      .order("created_at", { ascending: false })
      .limit(200),
  );
  const { run, isBusy } = useAction();
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorNote error={error} retry={() => refetch()} />;
  if (!data?.length)
    return (
      <EmptyState title="No workspaces yet" description="Real (non-demo) workspaces appear here." />
    );
  return (
    <div className="space-y-2">
      {data.map((w) => (
        <Card key={w.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="truncate font-bold">
              {w.name}{" "}
              <span className="text-xs font-normal capitalize text-muted-foreground">
                ({w.type})
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {w.location ?? "—"} · {timeAgo(w.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {w.suspended && <Badge tone="coral">Suspended</Badge>}
            <Button
              size="sm"
              variant="outline"
              disabled={isBusy(w.id)}
              onClick={() =>
                run(
                  w.id,
                  () =>
                    supabase.rpc("admin_set_workspace_suspended", {
                      p_workspace_id: w.id,
                      p_suspended: !w.suspended,
                    }),
                  w.suspended ? "Restored." : "Suspended.",
                )
              }
            >
              {w.suspended ? "Restore" : "Suspend"}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Projects() {
  const { data, isLoading, error, refetch } = useAdminList("projects", () =>
    supabase
      .from("projects")
      .select("*")
      .eq("is_demo", false)
      .order("created_at", { ascending: false })
      .limit(200),
  );
  const { run, isBusy } = useAction();
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorNote error={error} retry={() => refetch()} />;
  if (!data?.length)
    return (
      <EmptyState title="No projects yet" description="Real (non-demo) projects appear here." />
    );
  return (
    <div className="space-y-2">
      {data.map((p) => (
        <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="truncate font-bold">{p.title}</p>
            <p className="text-xs text-muted-foreground">
              {p.category} · {timeAgo(p.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={p.status} />
            {p.status !== "cancelled" && p.status !== "completed" && (
              <Confirm
                title="Close this project?"
                description="Sets it to cancelled. Use for inappropriate listings or resolved disputes."
                confirmLabel="Close project"
                destructive
                onConfirm={() =>
                  run(
                    p.id,
                    () =>
                      supabase.rpc("set_project_status", {
                        p_project_id: p.id,
                        p_status: "cancelled",
                      }),
                    "Project closed.",
                  )
                }
              >
                <Button size="sm" variant="outline" disabled={isBusy(p.id)}>
                  Close
                </Button>
              </Confirm>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function Payments() {
  const { data, isLoading, error, refetch } = useAdminList("payments", () =>
    supabase
      .from("payments")
      .select("*, project:projects!payments_project_id_fkey(title)")
      .order("created_at", { ascending: false })
      .limit(200),
  );
  const { run } = useAction();
  if (isLoading) return <PageLoader />;
  if (error) return <ErrorNote error={error} retry={() => refetch()} />;
  if (!data?.length)
    return (
      <EmptyState
        title="No payments"
        description="Payment records appear when creatives are hired."
      />
    );
  return (
    <div className="space-y-2">
      {data.map((p) => (
        <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="min-w-0">
            <p className="truncate font-bold">{p.project?.title}</p>
            <p className="text-xs text-muted-foreground">
              {formatNaira(p.amount)} · {p.provider}
              {p.provider_reference ? ` · ${p.provider_reference}` : ""}
            </p>
          </div>
          <div className="w-44">
            <Select
              aria-label="Payment status"
              value={p.status}
              onChange={(e) =>
                run(
                  p.id,
                  () =>
                    supabase.rpc("admin_set_payment_status", {
                      p_project_id: p.project_id,
                      p_status: e.target.value,
                      p_note: "",
                    }),
                  "Payment status updated.",
                )
              }
            >
              {["pending", "reported", "confirmed", "failed", "refunded"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
        </Card>
      ))}
    </div>
  );
}
