import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Workspace } from "@/lib/sabi";
import { ACTIVE_WORKSPACE_KEY } from "@/lib/sabi";

export function useSession() {
  const [state, setState] = useState<{ userId: string | null; ready: boolean }>({
    userId: null,
    ready: false,
  });

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setState({ userId: data.session?.user.id ?? null, ready: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setState({ userId: session?.user.id ?? null, ready: true });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function useIsAdmin(userId: string | null) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId!)
        .eq("role", "admin");
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });
}

export function useMyWorkspaces(userId: string | null) {
  return useQuery({
    queryKey: ["workspaces", "mine", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("owner_id", userId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Workspace[];
    },
  });
}

export function useActiveWorkspace(workspaces: Workspace[] | undefined) {
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setActiveIdState(localStorage.getItem(ACTIVE_WORKSPACE_KEY));
    setHydrated(true);
  }, []);

  const active =
    (hydrated && workspaces?.find((w) => w.id === activeId)) ||
    workspaces?.find((w) => w.type === "creative") ||
    workspaces?.[0];

  const setActive = (id: string) => {
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
    setActiveIdState(id);
  };

  return { active, setActive, hydrated };
}

export function usePublicWorkspaces(type: "creative" | "brand") {
  return useQuery({
    queryKey: ["workspaces", "public", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("type", type)
        .eq("published", true)
        .order("rating", { ascending: false })
        .limit(24);
      if (error) throw error;
      return (data ?? []) as Workspace[];
    },
  });
}

export function usePublicProjects() {
  return useQuery({
    queryKey: ["projects", "public"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "*, brand:workspaces!projects_brand_workspace_id_fkey(id, name, slug, logo_url, industry, location, is_demo)",
        )
        .neq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(48);
      if (error) throw error;
      return data;
    },
  });
}

/** Signed-in user + their active workspace, usable on public pages outside the app shell. */
export function useCurrentWorkspace() {
  const { userId, ready } = useSession();
  const { data: workspaces, isLoading } = useMyWorkspaces(userId);
  const { active } = useActiveWorkspace(workspaces);
  return {
    userId,
    ready,
    workspace: active ?? null,
    workspaces: workspaces ?? [],
    loading: !ready || (!!userId && isLoading),
  };
}
