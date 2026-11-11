import { createFileRoute } from "@tanstack/react-router";
import { PublicHeader, PublicFooter } from "@/components/sabi/public-chrome";
import { Directory } from "@/components/sabi/directory";

export const Route = createFileRoute("/brands")({
  head: () => ({
    meta: [
      { title: "Brands — Sabi" },
      { name: "description", content: "Discover brands hiring creative talent." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div className="min-h-screen">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 pt-8">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Brands</h1>
        <p className="mb-6 mt-1 text-sm text-muted-foreground">
          Discover brands hiring creative talent.
        </p>
        <Directory type="brand" />
      </main>
      <PublicFooter />
    </div>
  );
}
