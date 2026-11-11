import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { INDUSTRIES, LOCATIONS, CATEGORIES, type Workspace } from "@/lib/sabi";
import { BrandCard, CreativeCard, EmptyState } from "@/components/sabi/cards";
import { Input, PageLoader, Select } from "@/components/sabi/primitives";
import { ErrorNote } from "@/components/sabi/page";

export function Directory({ type }: { type: "brand" | "creative" }) {
  const [q, setQ] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [sort, setSort] = useState("rating");
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["directory", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("type", type)
        .eq("published", true)
        .order("rating", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Workspace[];
    },
  });
  const options = type === "brand" ? INDUSTRIES : CATEGORIES.map((c) => c.name);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = (data ?? []).filter(
      (w) =>
        (!industry || w.industry === industry) &&
        (!location || w.location === location) &&
        (!term ||
          [w.name, w.tagline, w.description, ...(w.skills ?? []), ...(w.services ?? [])].some((s) =>
            s?.toLowerCase().includes(term),
          )),
    );
    if (sort === "newest") list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (sort === "price")
      list.sort((a, b) => (a.starting_price ?? Infinity) - (b.starting_price ?? Infinity));
    return list;
  }, [data, q, industry, location, sort]);

  return (
    <div>
      <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-card md:grid-cols-4">
        <div className="relative md:col-span-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search"
            className="pl-10"
            placeholder={type === "brand" ? "Search brands" : "Search by name or skill"}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select
          aria-label={type === "brand" ? "Industry" : "Specialty"}
          value={industry}
          onChange={(e) => setIndustry(e.target.value)}
        >
          <option value="">{type === "brand" ? "All industries" : "All specialties"}</option>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Select>
        <Select
          aria-label="Location"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        >
          <option value="">All locations</option>
          {LOCATIONS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </Select>
        <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="rating">Top rated</option>
          <option value="newest">Newest</option>
          {type === "creative" && <option value="price">Lowest starting price</option>}
        </Select>
      </div>
      <div className="mt-6">
        {isLoading ? (
          <PageLoader />
        ) : error ? (
          <ErrorNote error={error} retry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nothing matches yet"
            description="Try a different search or clear your filters."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rows.map((w) =>
              type === "brand" ? (
                <BrandCard key={w.id} brand={w} />
              ) : (
                <CreativeCard key={w.id} creative={w} />
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
