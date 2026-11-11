import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, FileText, FolderKanban, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/components/sabi/app-shell";
import {
  ACTIVE_WORK_STATUSES,
  BRAND_EMBED,
  OPEN_STATUSES,
  useBrandProjects,
  useBrandProposals,
  useContracts,
  useCreativeProposals,
} from "@/lib/data";
import { formatNaira, timeAgo } from "@/lib/format";
import { Button, Card, PageLoader } from "@/components/sabi/primitives";
import { EmptyState, ProjectCard } from "@/components/sabi/cards";
import { Avatar, PageHeader, SectionCard, StatCard, StatusBadge } from "@/components/sabi/page";
import type { Workspace } from "@/lib/sabi";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Sabi" }] }),
  component: Dashboard,
});

function Dashboard() {
  const ws = useWorkspaceContext();
  return ws.type === "brand" ? <BrandDashboard ws={ws} /> : <CreativeDashboard ws={ws} />;
}

function CreativeDashboard({ ws }: { ws: Workspace }) {
  const proposals = useCreativeProposals(ws.id);
  const contracts = useContracts("creative", ws.id);
  const recommended = useQuery({
    queryKey: ["recommended", ws.id, ws.industry],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`*, ${BRAND_EMBED}`)
        .in("status", [...OPEN_STATUSES])
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      const mine = new Set(
        [ws.industry, ...ws.skills].filter(Boolean).map((s) => s!.toLowerCase()),
      );
      const score = (p: NonNullable<typeof data>[number]) =>
        (mine.has(p.category.toLowerCase()) ? 2 : 0) +
        p.skills.filter((s) => mine.has(s.toLowerCase())).length;
      return [...(data ?? [])].sort((a, b) => score(b) - score(a)).slice(0, 3);
    },
  });
  if (proposals.isLoading || contracts.isLoading) return <PageLoader />;
  const props = proposals.data ?? [];
  const cons = contracts.data ?? [];
  const active = cons.filter((c) =>
    (ACTIVE_WORK_STATUSES as readonly string[]).includes(c.project?.status ?? ""),
  );
  const earned = cons.reduce(
    (n, c) => n + (c.payment?.[0]?.status === "confirmed" ? c.agreed_price : 0),
    0,
  );
  return (
    <>
      <PageHeader
        title={`Welcome back, ${ws.name.split(" ")[0]}`}
        subtitle="Here's what's happening with your creative work."
        actions={
          <Button asChild variant="ember" size="sm">
            <Link to="/available-projects">Find projects</Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Proposals sent" value={props.length} icon={FileText} />
        <StatCard
          label="Shortlisted"
          value={props.filter((p) => p.status === "shortlisted").length}
          icon={FolderKanban}
        />
        <StatCard label="Active projects" value={active.length} icon={Briefcase} />
        <StatCard label="Confirmed earnings" value={formatNaira(earned)} icon={Wallet} />
      </div>
      {(!ws.description || !ws.avatar_url) && (
        <Card className="mt-5 flex flex-wrap items-center justify-between gap-3 bg-gold-soft/40 p-4">
          <p className="text-sm font-semibold">
            Complete your profile so brands can trust your proposals.
          </p>
          <Button asChild size="sm">
            <Link to="/profile">Complete profile</Link>
          </Button>
        </Card>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Active work"
          action={
            <Link to="/my-proposals" className="text-xs font-bold text-ember hover:underline">
              All proposals
            </Link>
          }
        >
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active projects yet. Once a brand hires you it will appear here.
            </p>
          ) : (
            <ul className="space-y-3">
              {active.map((c) => (
                <li key={c.id}>
                  <Link
                    to="/work/$id"
                    params={{ id: c.project_id }}
                    className="flex items-center gap-3 rounded-xl p-2 hover:bg-secondary/60"
                  >
                    <Avatar src={c.brand?.logo_url} name={c.brand?.name ?? "?"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{c.project?.title}</span>
                      <span className="block text-xs text-muted-foreground">{c.brand?.name}</span>
                    </span>
                    <StatusBadge status={c.project?.status ?? ""} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard title="Recent proposals">
          {props.length === 0 ? (
            <p className="text-sm text-muted-foreground">You haven't sent any proposals yet.</p>
          ) : (
            <ul className="space-y-3">
              {props.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link
                    to="/project/$id"
                    params={{ id: p.project_id }}
                    className="flex items-center justify-between gap-3 rounded-xl p-2 hover:bg-secondary/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{p.project?.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatNaira(p.price)} · {timeAgo(p.created_at)}
                      </span>
                    </span>
                    <StatusBadge kind="proposal" status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
      <h2 className="mb-3 mt-8 font-display text-xl font-bold">Projects for you</h2>
      {(recommended.data?.length ?? 0) === 0 ? (
        <EmptyState
          title="No open projects right now"
          description="Check back soon, new briefs are published every day."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recommended.data!.map((p) => (
            <ProjectCard key={p.id} project={p} brandName={p.brand?.name} />
          ))}
        </div>
      )}
    </>
  );
}

function BrandDashboard({ ws }: { ws: Workspace }) {
  const projects = useBrandProjects(ws.id);
  const ids = (projects.data ?? []).map((p) => p.id);
  const proposals = useBrandProposals(ids);
  if (projects.isLoading) return <PageLoader />;
  const list = projects.data ?? [];
  const titleOf = (id: string) => list.find((p) => p.id === id)?.title ?? "Project";
  const pending = (proposals.data ?? []).filter((p) =>
    ["submitted", "shortlisted"].includes(p.status),
  );
  return (
    <>
      <PageHeader
        title={`Welcome back, ${ws.name}`}
        subtitle="Manage your projects and the creatives working on them."
        actions={
          <Button asChild variant="ember" size="sm">
            <Link to="/post-project">+ Post a project</Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Open projects"
          value={list.filter((p) => (OPEN_STATUSES as readonly string[]).includes(p.status)).length}
          icon={FolderKanban}
        />
        <StatCard label="Proposals to review" value={pending.length} icon={FileText} />
        <StatCard
          label="In progress"
          value={
            list.filter((p) => (ACTIVE_WORK_STATUSES as readonly string[]).includes(p.status))
              .length
          }
          icon={Briefcase}
        />
        <StatCard
          label="Completed"
          value={list.filter((p) => p.status === "completed").length}
          icon={Wallet}
        />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Proposals to review"
          action={
            <Link to="/proposals-received" className="text-xs font-bold text-ember hover:underline">
              View all
            </Link>
          }
        >
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No pending proposals. They'll appear here as creatives respond.
            </p>
          ) : (
            <ul className="space-y-3">
              {pending.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link
                    to="/project/$id"
                    params={{ id: p.project_id }}
                    className="flex items-center gap-3 rounded-xl p-2 hover:bg-secondary/60"
                  >
                    <Avatar src={p.creative?.avatar_url} name={p.creative?.name ?? "?"} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{p.creative?.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {titleOf(p.project_id)} · {formatNaira(p.price)}
                      </span>
                    </span>
                    <StatusBadge kind="proposal" status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        <SectionCard
          title="Your projects"
          action={
            <Link to="/posted-projects" className="text-xs font-bold text-ember hover:underline">
              Manage
            </Link>
          }
        >
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">You haven't posted a project yet.</p>
          ) : (
            <ul className="space-y-3">
              {list.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link
                    to="/project/$id"
                    params={{ id: p.id }}
                    className="flex items-center justify-between gap-3 rounded-xl p-2 hover:bg-secondary/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{p.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {timeAgo(p.created_at)}
                      </span>
                    </span>
                    <StatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </>
  );
}
