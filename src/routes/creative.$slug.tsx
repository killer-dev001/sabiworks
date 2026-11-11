import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, ExternalLink, MapPin, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useReviewsFor, usePortfolio } from "@/lib/data";
import { useCurrentWorkspace } from "@/lib/hooks";
import { formatNaira, timeAgo } from "@/lib/format";
import { PublicHeader, PublicFooter } from "@/components/sabi/public-chrome";
import { Badge, Button, Card, PageLoader } from "@/components/sabi/primitives";
import { EmptyState } from "@/components/sabi/cards";
import { Avatar, ErrorNote } from "@/components/sabi/page";
import { ReportButton } from "@/components/sabi/proposals";
import type { Workspace } from "@/lib/sabi";

export const Route = createFileRoute("/creative/$slug")({
  head: () => ({
    meta: [
      { title: "Creative profile — Sabi" },
      {
        name: "description",
        content: "View a creative's portfolio, services and reviews on Sabi.",
      },
    ],
  }),
  component: CreativeProfile,
});

export function useWorkspaceBySlug(slug: string, type: "creative" | "brand") {
  return useQuery({
    queryKey: ["workspace-slug", slug, type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspaces")
        .select("*")
        .eq("slug", slug)
        .eq("type", type)
        .maybeSingle();
      if (error) throw error;
      return data as Workspace | null;
    },
  });
}

export function ReviewList({ workspaceId }: { workspaceId: string }) {
  const { data } = useReviewsFor(workspaceId);
  if (!data || data.length === 0)
    return <p className="text-sm text-muted-foreground">No reviews yet.</p>;
  return (
    <div className="space-y-3">
      {data.map((r) => (
        <Card key={r.id} className="p-4">
          <div className="flex items-center gap-3">
            <Avatar
              src={r.reviewer?.avatar_url ?? r.reviewer?.logo_url}
              name={r.reviewer?.name ?? "?"}
              className="h-9 w-9 text-xs"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{r.reviewer?.name}</p>
              <p className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-bold">
              <Star className="h-4 w-4 fill-gold text-gold" />
              {r.rating}
            </span>
          </div>
          {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
          {(r.communication || r.quality || r.reliability) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {[
                r.communication && `Communication ${r.communication}/5`,
                r.quality && `Quality ${r.quality}/5`,
                r.reliability && `Reliability ${r.reliability}/5`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}

function CreativeProfile() {
  const { slug } = Route.useParams();
  const { data: ws, isLoading, error, refetch } = useWorkspaceBySlug(slug, "creative");
  const { userId } = useCurrentWorkspace();
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
            title="Creative not found"
            description="This profile doesn't exist or isn't public."
            action={
              <Button asChild variant="outline">
                <Link to="/creatives">Find talent</Link>
              </Button>
            }
          />
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
                <Avatar src={ws.avatar_url} name={ws.name} className="h-24 w-24 text-3xl" />
                <div className="min-w-0 flex-1">
                  <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight">
                    {ws.name}
                    {ws.verified && (
                      <BadgeCheck className="h-6 w-6 text-primary" aria-label="Verified" />
                    )}
                  </h1>
                  {ws.tagline && <p className="mt-1 text-sm text-muted-foreground">{ws.tagline}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-1 font-bold">
                      <Star className="h-4 w-4 fill-gold text-gold" />
                      {ws.rating.toFixed(1)}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({ws.reviews_count} reviews)
                      </span>
                    </span>
                    {ws.location && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-4 w-4 text-ember" />
                        {ws.location}
                      </span>
                    )}
                    <Badge tone={ws.availability.startsWith("Available") ? "green" : "orange"}>
                      {ws.availability}
                    </Badge>
                  </div>
                </div>
                {ws.starting_price != null && (
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-muted-foreground">Starting from</p>
                    <p className="font-display text-2xl font-extrabold">
                      {formatNaira(ws.starting_price)}
                    </p>
                  </div>
                )}
              </div>
            </Card>
            <div className="mt-8 grid gap-8 md:grid-cols-[1fr_300px]">
              <div className="space-y-8">
                {ws.description && (
                  <section>
                    <h2 className="font-display text-lg font-bold">About</h2>
                    <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                      {ws.description}
                    </p>
                  </section>
                )}
                <section>
                  <h2 className="mb-3 font-display text-lg font-bold">Portfolio</h2>
                  <PortfolioGrid workspaceId={ws.id} />
                </section>
                <section>
                  <h2 className="mb-3 font-display text-lg font-bold">Reviews</h2>
                  <ReviewList workspaceId={ws.id} />
                </section>
              </div>
              <aside className="space-y-5">
                {ws.skills.length > 0 && (
                  <Card className="p-4">
                    <h3 className="text-sm font-bold">Skills</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ws.skills.map((s) => (
                        <Badge key={s} tone="green">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                )}
                {ws.services.length > 0 && (
                  <Card className="p-4">
                    <h3 className="text-sm font-bold">Services</h3>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                      {ws.services.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </Card>
                )}
                {userId && (
                  <ReportButton
                    targetType="workspace"
                    targetId={ws.id}
                    label="Report this profile"
                  />
                )}
              </aside>
            </div>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
}

export function PortfolioGrid({ workspaceId }: { workspaceId: string }) {
  const { data } = usePortfolio(workspaceId);
  if (!data || data.length === 0)
    return <p className="text-sm text-muted-foreground">No portfolio items yet.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {data.map((item) => (
        <Card key={item.id} className="overflow-hidden">
          {item.media_url && (
            <div className="aspect-[4/3] overflow-hidden bg-muted">
              <img
                src={item.media_url}
                alt={item.title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="p-3">
            <p className="text-sm font-bold">{item.title}</p>
            {item.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                {item.description}
              </p>
            )}
            {item.external_url && (
              <a
                href={item.external_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ember hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> View work
              </a>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
