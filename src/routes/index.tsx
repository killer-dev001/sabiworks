import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  CalendarCheck2,
  FileSearch,
  Handshake,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { usePublicProjects, usePublicWorkspaces } from "@/lib/hooks";
import { CATEGORIES } from "@/lib/sabi";
import { PublicHeader, PublicFooter } from "@/components/sabi/public-chrome";
import { BrandCard, CreativeCard, ProjectCard, EmptyState } from "@/components/sabi/cards";
import { Button, Card, PageLoader, Badge } from "@/components/sabi/primitives";
import { CATEGORY_ICONS, LeafShape, QuarterArc } from "@/components/sabi/decor";
import heroAsset from "@/assets/hero-creative.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sabi — Discover African creativity. Find your people." },
      {
        name: "description",
        content:
          "Sabi connects businesses with talented African creatives for quality content, design, video and more. Post briefs, compare proposals and hire.",
      },
      { property: "og:title", content: "Sabi — Discover African creativity. Find your people." },
      {
        property: "og:description",
        content: "Where African talent meets brands that believe in it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function SectionHeading({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      {action}
    </div>
  );
}

function Index() {
  const brands = usePublicWorkspaces("brand");
  const creatives = usePublicWorkspaces("creative");
  const projects = usePublicProjects();

  const loading = brands.isLoading || creatives.isLoading;

  return (
    <div className="min-h-screen">
      <PublicHeader />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-6">
        <div className="grid items-stretch gap-4 md:grid-cols-[1.05fr_1fr]">
          <div className="grain-panel flex flex-col justify-center rounded-3xl bg-forest-deep p-8 text-cream md:p-12">
            <QuarterArc className="absolute right-0 top-0 h-40 w-40 text-ember/20" />
            <LeafShape className="absolute -left-6 bottom-8 h-24 w-24 rotate-12 text-forest-soft/10" />
            <h1 className="max-w-md font-display text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
              Discover African creativity. Find your people.
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-cream/80 md:text-base">
              Sabi connects businesses with talented creatives for quality content, design, video
              and more.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild variant="ember" size="lg">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Get started <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="cream" size="lg">
                <Link to="/projects">Explore projects</Link>
              </Button>
            </div>
          </div>
          <div className="relative min-h-72 overflow-hidden rounded-3xl">
            <LeafShape className="absolute -right-8 -top-8 z-0 h-40 w-40 text-ember" />
            <LeafShape className="absolute -bottom-10 -left-8 z-0 h-28 w-28 text-gold" />
            <img
              src={heroAsset.url}
              alt="African creative professional with a camera"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Popular categories */}
      <section className="mx-auto max-w-6xl px-4 pt-14">
        <SectionHeading title="Popular categories" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.icon] ?? Sparkles;
            return (
              <Link
                key={cat.name}
                to="/projects"
                search={{ category: cat.name }}
                className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-2 py-5 shadow-card transition-shadow hover:shadow-lift"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest-soft text-secondary-foreground transition-colors group-hover:bg-gold-soft">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-xs font-semibold">{cat.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured brands */}
      <section className="mx-auto max-w-6xl px-4 pt-14">
        <SectionHeading
          title="Featured brands"
          action={
            <Link to="/brands" className="text-sm font-bold text-ember hover:underline">
              View all →
            </Link>
          }
        />
        {loading ? (
          <PageLoader />
        ) : (brands.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No brands yet"
            description="New brands appear here as soon as they publish their profiles."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {brands.data?.slice(0, 4).map((b) => (
              <BrandCard key={b.id} brand={b} />
            ))}
          </div>
        )}
      </section>

      {/* Featured creatives */}
      <section className="mx-auto max-w-6xl px-4 pt-14">
        <SectionHeading
          title="Featured creatives"
          action={
            <Link to="/creatives" className="text-sm font-bold text-ember hover:underline">
              View all →
            </Link>
          }
        />
        {loading ? (
          <PageLoader />
        ) : (creatives.data?.length ?? 0) === 0 ? (
          <EmptyState
            title="No creatives yet"
            description="New creatives appear here as soon as they publish their profiles."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {creatives.data?.slice(0, 4).map((c) => (
              <CreativeCard key={c.id} creative={c} />
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-20">
        <SectionHeading title="How Sabi works" />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: FileSearch,
              title: "Discover or post a brief",
              body: "Brands publish project briefs with clear deliverables and budgets. Creatives browse opportunities matched to their skills.",
            },
            {
              icon: Handshake,
              title: "Compare & connect",
              body: "Creatives send proposals with their price and approach. Brands compare portfolios, reviews and quotes side by side.",
            },
            {
              icon: CalendarCheck2,
              title: "Hire & build together",
              body: "Agree terms, work in one place, review deliverables and grow a reputation that unlocks the next opportunity.",
            },
          ].map((step, i) => (
            <Card key={step.title} className="relative p-6">
              <span className="absolute right-5 top-4 font-display text-4xl font-extrabold text-forest-soft">
                {i + 1}
              </span>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ember text-primary-foreground">
                <step.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Trust & safety */}
      <section className="mx-auto max-w-6xl px-4 pt-16">
        <div className="grain-panel rounded-3xl bg-forest-deep p-8 text-cream md:p-12">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <Badge tone="gold" className="bg-gold/20 text-gold">
                <ShieldCheck className="h-3.5 w-3.5" /> Trust &amp; safety
              </Badge>
              <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight">
                Built on trust, made for African talent.
              </h2>
              <p className="mt-3 text-sm text-cream/80">
                Sabi keeps every project transparent: clear briefs, agreed terms and profiles you
                can verify before you commit.
              </p>
            </div>
            <ul className="grid gap-3 text-sm">
              {[
                { icon: BadgeCheck, text: "Verified brand and creative profiles" },
                { icon: FileSearch, text: "Clear budgets, deliverables and deadlines" },
                { icon: Sparkles, text: "Sample content is always labelled as demo" },
                { icon: ShieldCheck, text: "Secure sign-in and private conversations" },
              ].map((item) => (
                <li
                  key={item.text}
                  className="flex items-center gap-3 rounded-2xl bg-cream/5 px-4 py-3"
                >
                  <item.icon className="h-5 w-5 shrink-0 text-gold" />
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
