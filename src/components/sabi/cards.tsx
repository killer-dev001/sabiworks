import { Link } from "@tanstack/react-router";
import type { Project, Workspace } from "@/lib/sabi";
import { budgetLabel, daysUntil, formatNaira } from "@/lib/format";
import { Badge, Button, Card } from "@/components/sabi/primitives";
import { Briefcase, CalendarClock, MapPin, RatingStars } from "@/components/sabi/decor";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandCard({ brand }: { brand: Workspace }) {
  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-lift">
      <div className="aspect-[4/3] w-full overflow-hidden">
        {brand.cover_url ? (
          <img
            src={brand.cover_url}
            alt={brand.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-secondary" />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-display text-base font-bold">{brand.name}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{brand.industry}</p>
        <div className="mt-3 flex items-center justify-between">
          <RatingStars rating={brand.rating} />
          <Button asChild size="sm">
            <Link to="/brand/$slug" params={{ slug: brand.slug }}>
              View profile
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function CreativeCard({ creative }: { creative: Workspace }) {
  return (
    <Card className="group overflow-hidden transition-shadow hover:shadow-lift">
      <div className="flex items-center gap-4 p-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-secondary">
          {creative.avatar_url ? (
            <img
              src={creative.avatar_url}
              alt={creative.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-bold">{creative.name}</h3>
          <p className="truncate text-xs text-muted-foreground">
            {creative.services?.[0] ?? creative.industry}
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold">
            <Star className="h-3.5 w-3.5 fill-gold text-gold" />
            {creative.rating.toFixed(1)}
            <span className="font-normal text-muted-foreground">({creative.reviews_count})</span>
          </p>
        </div>
      </div>
      <div className="px-4 pb-4">
        <Button asChild size="sm" className="w-full">
          <Link to="/creative/$slug" params={{ slug: creative.slug }}>
            View profile
          </Link>
        </Button>
      </div>
    </Card>
  );
}

export function ProjectCard({ project, brandName }: { project: Project; brandName?: string }) {
  const deliverableCount = project.deliverables?.length ?? 0;
  return (
    <Card className="group flex flex-col overflow-hidden transition-shadow hover:shadow-lift">
      <div className="relative aspect-[16/9] w-full overflow-hidden">
        {project.image_url ? (
          <img
            src={project.image_url}
            alt={project.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-secondary" />
        )}
        <Badge tone="gold" className="absolute left-3 top-3 bg-card/90 backdrop-blur">
          {project.category}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col p-4">
        {brandName && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {brandName}
          </p>
        )}
        <h3 className="mt-0.5 font-display text-base font-bold">{project.title}</h3>
        <div className="mt-2 grid gap-1.5 text-xs text-muted-foreground">
          {project.is_demo && deliverableCount > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-ember" />
              {deliverableCount} deliverables
            </span>
          )}
          {project.location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-ember" />
              {project.is_remote ? "Remote" : project.location}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
            ₦&nbsp;
            {budgetLabel(project.budget_type, project.budget_min, project.budget_max)}
          </span>
          {project.deadline && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 text-ember" />
              Deadline {daysUntil(project.deadline)}
            </span>
          )}
        </div>
        <div className="mt-4 flex-1" />
        <Button asChild size="sm" className="w-full">
          <Link to="/project/$id" params={{ id: project.id }}>
            View details
          </Link>
        </Button>
      </div>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-border bg-card/60 py-16 text-center",
        className,
      )}
    >
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function PriceTag({ project }: { project: Project }) {
  return (
    <span className="font-semibold text-foreground">
      {formatNaira(project.budget_min)}
      {project.budget_type === "range" ? ` – ${formatNaira(project.budget_max)}` : ""}
    </span>
  );
}
