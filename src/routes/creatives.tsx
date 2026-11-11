import { createFileRoute } from "@tanstack/react-router";
import { PublicHeader, PublicFooter } from "@/components/sabi/public-chrome";
import { Directory } from "@/components/sabi/directory";

export const Route = createFileRoute("/creatives")({
  head: () => ({
    meta: [
      { title: "Find talent — Sabi" },
      {
        name: "description",
        content:
          "Browse designers, photographers, videographers, writers and social media managers.",
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 pt-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Find talent</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          Browse designers, photographers, videographers, writers and social media managers.
        </p>
        <Directory type="creative" />
      </main>
      <PublicFooter />
    </div>
  );
}
