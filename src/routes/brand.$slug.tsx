import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/lib/hooks";
import { PublicHeader, PublicFooter } from "@/components/sabi/public-chrome";
import { Badge, Button, Card, PageLoader } from "@/components/sabi/primitives";
import { EmptyState, ProjectCard } from "@/components/sabi/cards";
import { Avatar, ErrorNote } from "@/components/sabi/page";
import { ReportButton } from "@/components/sabi/proposals";
import { ReviewList, useWorkspaceBySlug } from "./creative.$slug";

export const Route = createFileRoute("/brand/$slug")({
  head: () => ({
    meta: [
      { title: "Brand profile — Sabi" },
      { name: "description", content: "See a brand's open projects and reviews on Sabi." },
    ],
  }),
  component: BrandProfile,
});

function BrandProfile() {
  const { slug } = Route.useParams();
  const { data: ws, isLoading, error, refetch } = useWorkspaceBySlug(slug, "brand");
  const { userId } = useCurrentWorkspace();
  const projects = useQuery({
    queryKey: ["brand-open-projects", ws?.id],
    enabled: !!ws,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("brand_workspace_id", ws!.id)
        .in("status", ["published", "in_discussion"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 pt-8">
        {isLoading ? (
          <PageLoader />
        ) : error ? (
          <ErrorNote error={error} retry={() => refetch()} />
        ) : !ws ? (
          <EmptyState
            title="Brand not found"
            description="This profile doesn't exist or isn't public."
            action={
              <Button asChild variant="outline">
                <Link to="/brands">Browse brands</Link>
              </Button>
            }
          />
        ) : (
          <>
            <Card className="overflow-hidden">
              {ws.cover_url && (
                <div className="aspect-[16/5] overflow-hidden">
                  <img src={ws.cover_url} alt="" className="h-full w-full object-cover" />
                </div>
              )}
              <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
                <Avatar
                  src={ws.logo_url ?? ws.avatar_url}
                  name={ws.name}
                  className="h-20 w-20 text-2xl"
                />
                <div className="min-w-0 flex-1">
                  <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight">
                    {ws.name}
                    {ws.verified && (
                      <BadgeCheck className="h-6 w-6 text-primary" aria-label="Verified" />
                    )}
                  </h1>
                  {ws.tagline && <p className="mt-1 text-sm text-muted-foreground">{ws.tagline}</p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                    {ws.industry && <Badge tone="green">{ws.industry}</Badge>}
                    {ws.location && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-4 w-4 text-ember" />
                        {ws.location}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 font-bold">
                      <Star className="h-4 w-4 fill-gold text-gold" />
                      {ws.rating.toFixed(1)}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({ws.reviews_count})
                      </span>
                    </span>
                    {ws.website_url && (
                      <a
                        href={ws.website_url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="font-semibold text-ember hover:underline"
                      >
                        Website
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Card>
            {ws.description && (
              <section className="mt-8">
                <h2 className="font-display text-lg font-bold">About</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{ws.description}</p>
              </section>
            )}
            <section className="mt-8">
              <h2 className="mb-3 font-display text-lg font-bold">Open projects</h2>
              {projects.isLoading ? (
                <PageLoader />
              ) : (projects.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">No open projects right now.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.data!.map((p) => (
                    <ProjectCard key={p.id} project={p} />
                  ))}
                </div>
              )}
            </section>
            <section className="mt-8">
              <h2 className="mb-3 font-display text-lg font-bold">Reviews</h2>
              <ReviewList workspaceId={ws.id} />
            </section>
            {userId && (
              <div className="mt-6">
                <ReportButton targetType="workspace" targetId={ws.id} label="Report this brand" />
              </div>
            )}
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}
