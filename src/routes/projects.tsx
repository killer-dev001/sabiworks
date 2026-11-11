import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PublicHeader, PublicFooter } from "@/components/sabi/public-chrome";
import { ProjectBrowser } from "@/components/sabi/project-browser";

export const Route = createFileRoute("/projects")({
  validateSearch: z.object({ category: z.string().optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: "Browse creative projects — Sabi" },
      {
        name: "description",
        content:
          "Find open briefs from African brands: design, photography, video, social media and writing.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const { category } = Route.useSearch();
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 pt-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Browse projects</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          Open briefs from brands looking for creative talent.
        </p>
        <ProjectBrowser initialCategory={category} />
      </main>
      <PublicFooter />
    </div>
  );
}
