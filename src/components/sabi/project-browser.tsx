import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BRAND_EMBED, OPEN_STATUSES, useSavedProjectIds } from "@/lib/data";
import { CATEGORIES, type Workspace } from "@/lib/sabi";
import { ProjectCard, EmptyState } from "@/components/sabi/cards";
import { Button, Input, PageLoader, Select } from "@/components/sabi/primitives";
import { ErrorNote } from "@/components/sabi/page";
import { SaveProjectButton } from "@/components/sabi/proposals";

function cleanSearch(v: string) {
  return v
    .replace(/[,()%*\\]/g, " ")
    .trim()
    .slice(0, 60);
}

export function ProjectBrowser({
  initialCategory,
  workspace,
}: {
  initialCategory?: string | undefined;
  workspace?: Workspace | undefined;
}) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState(initialCategory ?? "");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [within, setWithin] = useState("");
  const [remote, setRemote] = useState(false);
  const [sort, setSort] = useState("newest");
  const [savedOnly, setSavedOnly] = useState(false);
  const isCreative = workspace?.type === "creative";
  const { data: saved } = useSavedProjectIds(isCreative ? workspace!.id : null);

  const search = cleanSearch(q);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["browse-projects", category, search, within],
    queryFn: async () => {
      let qy = supabase
        .from("projects")
        .select(`*, ${BRAND_EMBED}`)
        .in("status", [...OPEN_STATUSES]);
      if (category) qy = qy.eq("category", category);
      if (search) qy = qy.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
      if (within) {
        const d = new Date();
        d.setDate(d.getDate() + Number(within));
        qy = qy.lte("deadline", d.toISOString().slice(0, 10));
      }
      const { data, error } = await qy.order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const lo = min ? Number(min) : null;
    const hi = max ? Number(max) : null;
    const list = (data ?? []).filter((p) => {
      const top = p.budget_max ?? p.budget_min ?? 0;
      const bottom = p.budget_min ?? p.budget_max ?? 0;
      if (lo != null && top < lo) return false;
      if (hi != null && bottom > hi) return false;
      if (remote && !p.is_remote) return false;
      if (savedOnly && !saved?.has(p.id)) return false;
      return true;
    });
    if (sort === "budget")
      list.sort(
        (a, b) => (b.budget_max ?? b.budget_min ?? 0) - (a.budget_max ?? a.budget_min ?? 0),
      );
    if (sort === "deadline")
      list.sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"));
    return list;
  }, [data, min, max, remote, sort, savedOnly, saved]);

  const filtered = !!(q || category || min || max || within || remote || savedOnly);

  return (
    <div>
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-card md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search projects"
            className="pl-10"
            placeholder="Search projects"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select
          aria-label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.name}>{c.name}</option>
          ))}
        </Select>
        <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Newest</option>
          <option value="budget">Highest budget</option>
          <option value="deadline">Deadline soonest</option>
        </Select>
        <Input
          aria-label="Minimum budget"
          type="number"
          min={0}
          placeholder="Min budget (₦)"
          value={min}
          onChange={(e) => setMin(e.target.value)}
        />
        <Input
          aria-label="Maximum budget"
          type="number"
          min={0}
          placeholder="Max budget (₦)"
          value={max}
          onChange={(e) => setMax(e.target.value)}
        />
        <Select aria-label="Deadline" value={within} onChange={(e) => setWithin(e.target.value)}>
          <option value="">Any deadline</option>
          <option value="7">Within 7 days</option>
          <option value="14">Within 14 days</option>
          <option value="30">Within 30 days</option>
        </Select>
        <div className="flex items-center gap-4 text-sm font-semibold">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} />{" "}
            Remote
          </label>
          {isCreative && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={savedOnly}
                onChange={(e) => setSavedOnly(e.target.checked)}
              />{" "}
              Saved
            </label>
          )}
        </div>
      </div>

      <div className="mt-6">
        {isLoading ? (
          <PageLoader />
        ) : error ? (
          <ErrorNote error={error} retry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={filtered ? "No projects match your filters" : "No open projects yet"}
            description={
              filtered
                ? "Try widening your budget, deadline or category."
                : "New briefs appear here as soon as brands publish them."
            }
            action={
              filtered ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQ("");
                    setCategory("");
                    setMin("");
                    setMax("");
                    setWithin("");
                    setRemote(false);
                    setSavedOnly(false);
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              {rows.length} open project{rows.length === 1 ? "" : "s"}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map((p) => (
                <div key={p.id} className="flex flex-col gap-2">
                  <ProjectCard project={p} brandName={p.brand?.name} />
                  {workspace && isCreative && (
                    <SaveProjectButton projectId={p.id} workspace={workspace} />
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
