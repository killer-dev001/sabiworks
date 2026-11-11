import { useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import {
  Bell,
  Briefcase,
  FileText,
  FolderKanban,
  Home,
  Inbox,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveWorkspace, useIsAdmin, useMyWorkspaces, useSession } from "@/lib/hooks";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { timeAgo } from "@/lib/format";
import { SabiLogo } from "@/components/sabi/logo";
import { Button, PageLoader } from "@/components/sabi/primitives";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/lib/sabi";

const CREATIVE_NAV = [
  { label: "Home", to: "/dashboard", icon: Home },
  { label: "My Profile", to: "/profile", icon: Users },
  { label: "Available Projects", to: "/available-projects", icon: FolderKanban },
  { label: "My Proposals", to: "/my-proposals", icon: FileText },
  { label: "Messages", to: "/messages", icon: Inbox },
  { label: "Earnings", to: "/earnings", icon: Wallet },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

const BRAND_NAV = [
  { label: "Home", to: "/dashboard", icon: Home },
  { label: "My Brand", to: "/my-brand", icon: Users },
  { label: "Posted Projects", to: "/posted-projects", icon: FolderKanban },
  { label: "Proposals Received", to: "/proposals-received", icon: FileText },
  { label: "Hired Creatives", to: "/hired-creatives", icon: Briefcase },
  { label: "Messages", to: "/messages", icon: Inbox },
  { label: "Payments", to: "/payments", icon: Wallet },
  { label: "Settings", to: "/settings", icon: Settings },
] as const;

function NavLink({
  item,
  active,
  onClick,
}: {
  item: { label: string; to: string; icon: typeof Home };
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      to={item.to}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-foreground/75 hover:bg-secondary",
      )}
    >
      <item.icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

function WorkspaceSwitcher({
  workspaces,
  active,
  onPick,
}: {
  workspaces: Workspace[];
  active: Workspace | undefined;
  onPick: (id: string) => void;
}) {
  const [mode, setMode] = useState<"creative" | "brand">(active?.type ?? "creative");
  const list = workspaces.filter((w) => w.type === mode);

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <p className="px-1 pb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Switch Workspace
      </p>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {(["creative", "brand"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setMode(t)}
            className={cn(
              "rounded-lg px-2 py-1.5 text-xs font-bold capitalize transition-colors",
              mode === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mt-2 space-y-1">
        {list.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            No {mode} workspace yet.{" "}
            <Link to="/workspace" className="font-semibold text-ember underline">
              Create one
            </Link>
          </p>
        )}
        {list.map((w) => (
          <button
            key={w.id}
            onClick={() => onPick(w.id)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-sm transition-colors",
              active?.id === w.id ? "bg-secondary font-bold" : "hover:bg-secondary/60",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest-soft text-xs font-bold text-secondary-foreground">
              {w.avatar_url ? (
                <img
                  src={w.avatar_url}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                w.name.slice(0, 1)
              )}
            </span>
            <span className="truncate">{w.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { userId, ready } = useSession();
  const { data: workspaces, isLoading } = useMyWorkspaces(userId);
  const { active, setActive } = useActiveWorkspace(workspaces);
  const [drawer, setDrawer] = useState(false);
  const navigate = useNavigate();
  const { data: isAdmin } = useIsAdmin(userId);
  const { pathname, searchStr: search } = useLocation();

  if (!ready || (userId && isLoading)) return <PageLoader />;

  if (!userId) {
    return <Navigate to="/auth" search={{ mode: "login", redirect: pathname + search }} replace />;
  }

  if (workspaces && workspaces.length === 0) {
    return <Navigate to="/workspace" replace />;
  }

  const isBrand = active?.type === "brand";
  const baseNav = isBrand ? BRAND_NAV : CREATIVE_NAV;
  const nav = isAdmin ? [...baseNav, { label: "Admin", to: "/admin", icon: ShieldCheck }] : baseNav;

  const sidebar = (
    <div className="flex h-full flex-col gap-4 p-4">
      <Link to="/dashboard" className="px-1">
        <SabiLogo />
      </Link>
      {isBrand && (
        <Button asChild variant="ember" className="w-full">
          <Link to="/post-project">+ Post a Project</Link>
        </Button>
      )}
      <nav className="flex flex-1 flex-col gap-1">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            item={item}
            active={pathname === item.to || pathname.startsWith(item.to + "/")}
            onClick={() => setDrawer(false)}
          />
        ))}
      </nav>
      {workspaces && (
        <WorkspaceSwitcher
          workspaces={workspaces}
          active={active}
          onPick={(id) => {
            setActive(id);
            setDrawer(false);
            navigate({ to: "/dashboard" });
          }}
        />
      )}
      {active && (
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-forest-soft text-xs font-bold text-secondary-foreground">
            {active.avatar_url ? (
              <img
                src={active.avatar_url}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              active.name.slice(0, 1)
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{active.name}</p>
            <p className="text-xs capitalize text-muted-foreground">{active.type}</p>
          </div>
          <button
            className="ml-auto rounded-lg p-2 text-muted-foreground hover:bg-secondary"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-card lg:block">
        {sidebar}
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden">
        <button
          className="rounded-lg p-2 hover:bg-secondary"
          onClick={() => setDrawer(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <SabiLogo />
        <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-forest-soft text-xs font-bold text-secondary-foreground">
          {active?.avatar_url ? (
            <img
              src={active.avatar_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            active?.name.slice(0, 1)
          )}
        </span>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-card shadow-lift">
            <button
              className="absolute right-3 top-3 rounded-lg p-2 hover:bg-secondary"
              onClick={() => setDrawer(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="min-h-screen lg:pl-64">
        <div className="mx-auto max-w-5xl px-4 py-6 lg:px-10 lg:py-8">
          {active && <WorkspaceProvider value={active}>{children}</WorkspaceProvider>}
        </div>
      </main>
    </div>
  );
}

/* Lightweight context so pages can read the active workspace */
import { createContext, useContext } from "react";

const WorkspaceContext = createContext<Workspace | null>(null);

export function WorkspaceProvider({ value, children }: { value: Workspace; children: ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext(): Workspace {
  const ws = useContext(WorkspaceContext);
  if (!ws) throw new Error("useWorkspaceContext must be used inside AppShell");
  return ws;
}

export function BellButton() {
  const { userId } = useSession();
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["notifications", userId],
    enabled: !!userId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
  const unread = (data ?? []).filter((n) => !n.read_at).length;
  const markRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-full p-2 text-muted-foreground hover:bg-secondary"
          aria-label={unread ? `Notifications (${unread} unread)` : "Notifications"}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[10px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-bold">Notifications</p>
          {unread > 0 && (
            <button
              className="text-xs font-semibold text-ember hover:underline"
              onClick={() =>
                markRead.mutate((data ?? []).filter((n) => !n.read_at).map((n) => n.id))
              }
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {(data ?? []).length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              You're all caught up.
            </p>
          )}
          {(data ?? []).map((n) => (
            <button
              key={n.id}
              className={cn(
                "block w-full border-b border-border/60 px-4 py-3 text-left last:border-0 hover:bg-secondary/60",
                !n.read_at && "bg-gold-soft/40",
              )}
              onClick={() => {
                if (!n.read_at) markRead.mutate([n.id]);
                setOpen(false);
                if (n.link) router.history.push(n.link);
              }}
            >
              <p className="text-sm font-semibold">{n.title}</p>
              {n.body && (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
              )}
              <p className="mt-1 text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</p>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
