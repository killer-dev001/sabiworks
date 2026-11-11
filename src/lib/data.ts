import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const OPEN_STATUSES = ["published", "in_discussion"] as const;
export const ACTIVE_WORK_STATUSES = [
  "hired",
  "in_progress",
  "in_review",
  "revision_requested",
] as const;

export const BRAND_EMBED =
  "brand:workspaces!projects_brand_workspace_id_fkey(id,name,slug,logo_url,cover_url,industry,location,is_demo,verified,rating,reviews_count,owner_id)";
export const CREATIVE_EMBED =
  "creative:workspaces!proposals_creative_workspace_id_fkey(id,name,slug,avatar_url,industry,location,rating,reviews_count,verified,starting_price,skills,owner_id,is_demo)";

/** Refresh everything that could have changed after a mutation. */
export function useRefreshAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`*, ${BRAND_EMBED}`)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useBrandProjects(workspaceId: string) {
  return useQuery({
    queryKey: ["brand-projects", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("brand_workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Proposals sent to a brand's projects (never the user's own creative proposals). */
export function useBrandProposals(projectIds: string[]) {
  return useQuery({
    queryKey: ["brand-proposals", projectIds],
    enabled: projectIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select(`*, ${CREATIVE_EMBED}`)
        .in("project_id", projectIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProjectProposals(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["project-proposals", projectId],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select(`*, ${CREATIVE_EMBED}`)
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreativeProposals(workspaceId: string) {
  return useQuery({
    queryKey: ["creative-proposals", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select(`*, project:projects!proposals_project_id_fkey(*, ${BRAND_EMBED})`)
        .eq("creative_workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyProposalFor(projectId: string, workspaceId: string | null) {
  return useQuery({
    queryKey: ["my-proposal", projectId, workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("project_id", projectId)
        .eq("creative_workspace_id", workspaceId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

const CONTRACT_SELECT =
  "*, project:projects!project_contracts_project_id_fkey(id,title,category,status,image_url,deadline), brand:workspaces!project_contracts_brand_workspace_id_fkey(id,name,slug,logo_url,owner_id), creative:workspaces!project_contracts_creative_workspace_id_fkey(id,name,slug,avatar_url,owner_id), payment:payments(*)";

export function useContracts(side: "brand" | "creative", workspaceId: string) {
  return useQuery({
    queryKey: ["contracts", side, workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_contracts")
        .select(CONTRACT_SELECT)
        .eq(side === "brand" ? "brand_workspace_id" : "creative_workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useContractForProject(projectId: string) {
  return useQuery({
    queryKey: ["contract", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_contracts")
        .select(CONTRACT_SELECT)
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSavedProjectIds(workspaceId: string | null) {
  return useQuery({
    queryKey: ["saved-projects", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_projects")
        .select("project_id")
        .eq("creative_workspace_id", workspaceId!);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.project_id));
    },
  });
}

export function useReviewsFor(workspaceId: string) {
  return useQuery({
    queryKey: ["reviews", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(
          "*, reviewer:workspaces!reviews_reviewer_workspace_id_fkey(id,name,slug,avatar_url,logo_url)",
        )
        .eq("reviewee_workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePortfolio(workspaceId: string) {
  return useQuery({
    queryKey: ["portfolio", workspaceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_items")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
