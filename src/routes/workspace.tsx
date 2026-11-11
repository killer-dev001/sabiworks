import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Briefcase, Loader2, Palette } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyWorkspaces, useSession } from "@/lib/hooks";
import { ACTIVE_WORKSPACE_KEY, CATEGORIES, INDUSTRIES, LOCATIONS } from "@/lib/sabi";
import { slugify, workspaceSchema, fieldErrors } from "@/lib/validation";
import { errMessage } from "@/lib/errors";
import { SabiLogo } from "@/components/sabi/logo";
import { AuthDecor } from "@/components/sabi/public-chrome";
import { Button, Card, Input, PageLoader, Select, Textarea } from "@/components/sabi/primitives";
import { Avatar, Field } from "@/components/sabi/page";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Choose your workspace — Sabi" },
      { name: "description", content: "Set up a creative or brand workspace on Sabi." },
    ],
  }),
  component: WorkspacePage,
});

function WorkspacePage() {
  const { userId, ready } = useSession();
  const { data: workspaces, isLoading } = useMyWorkspaces(userId);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [type, setType] = useState<"creative" | "brand" | null>(null);
  const [form, setForm] = useState({ name: "", industry: "", location: "Lagos", tagline: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (!ready || (userId && isLoading)) return <PageLoader />;
  if (!userId)
    return <Navigate to="/auth" search={{ mode: "login", redirect: "/workspace" }} replace />;

  function activate(id: string) {
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!type || !userId) return;
    const parsed = workspaceSchema
      .pick({ name: true, industry: true, location: true, tagline: true })
      .safeParse({
        name: form.name,
        industry: form.industry || null,
        location: form.location || null,
        tagline: form.tagline || null,
      });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      let lastError: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await supabase.from("workspaces").insert({
          id,
          owner_id: userId,
          type,
          name: parsed.data.name,
          slug: slugify(parsed.data.name),
          industry: parsed.data.industry,
          location: parsed.data.location,
          tagline: parsed.data.tagline,
        });
        if (!error) {
          lastError = null;
          break;
        }
        lastError = error;
        if (error.code !== "23505") break; // only retry slug collisions
      }
      if (lastError) throw lastError;
      activate(id);
      await qc.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success(type === "brand" ? "Brand workspace created." : "Creative workspace created.");
      navigate({ to: type === "brand" ? "/my-brand" : "/profile" });
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const options = [
    {
      key: "creative" as const,
      icon: Palette,
      title: "I'm a Creative",
      body: "Showcase your portfolio, find briefs and send proposals.",
    },
    {
      key: "brand" as const,
      icon: Briefcase,
      title: "I'm a Brand",
      body: "Post projects, compare proposals and hire the right creative.",
    },
  ];

  return (
    <div className="relative flex min-h-screen flex-col items-center bg-background px-4 py-10">
      <AuthDecor />
      <div className="relative z-10 w-full max-w-2xl">
        <Link to="/" className="mb-8 flex justify-center">
          <SabiLogo tagline />
        </Link>
        <h1 className="text-center font-display text-3xl font-extrabold tracking-tight">
          Choose your workspace
        </h1>
        <p className="mx-auto mt-2 max-w-md text-center text-sm text-muted-foreground">
          You can have both a creative and a brand workspace and switch between them any time.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {options.map((o) => (
            <button key={o.key} type="button" onClick={() => setType(o.key)} className="text-left">
              <Card
                className={cn(
                  "h-full p-6 transition-shadow hover:shadow-lift",
                  type === o.key && "ring-2 ring-primary",
                )}
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-forest-soft text-secondary-foreground">
                  <o.icon className="h-6 w-6" />
                </span>
                <h2 className="mt-4 font-display text-lg font-bold">{o.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{o.body}</p>
              </Card>
            </button>
          ))}
        </div>

        {type && (
          <Card className="mt-6 p-6">
            <form onSubmit={create} className="space-y-4" noValidate>
              <Field
                label={type === "brand" ? "Brand name" : "Display name"}
                htmlFor="ws-name"
                error={errors["name"]}
              >
                <Input
                  id="ws-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={type === "brand" ? "The Sunday Table" : "Amara Okonkwo"}
                  maxLength={80}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={type === "brand" ? "Industry" : "What do you do?"}
                  htmlFor="ws-industry"
                >
                  <Select
                    id="ws-industry"
                    value={form.industry}
                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {(type === "brand" ? INDUSTRIES : CATEGORIES.map((c) => c.name)).map((i) => (
                      <option key={i} value={i}>
                        {i}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Location" htmlFor="ws-location">
                  <Select
                    id="ws-location"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                  >
                    {LOCATIONS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Short tagline (optional)" htmlFor="ws-tag" error={errors["tagline"]}>
                <Textarea
                  id="ws-tag"
                  className="min-h-16"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  maxLength={200}
                  placeholder={
                    type === "brand" ? "What does your brand do?" : "How do you help brands?"
                  }
                />
              </Field>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Create {type} workspace
              </Button>
            </form>
          </Card>
        )}

        {(workspaces?.length ?? 0) > 0 && (
          <div className="mt-8">
            <p className="mb-2 text-sm font-bold">Your workspaces</p>
            <div className="grid gap-2">
              {workspaces!.map((w) => (
                <button
                  key={w.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left hover:bg-secondary/50"
                  onClick={() => {
                    activate(w.id);
                    navigate({ to: "/dashboard" });
                  }}
                >
                  <Avatar src={w.avatar_url ?? w.logo_url} name={w.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{w.name}</span>
                    <span className="block text-xs capitalize text-muted-foreground">{w.type}</span>
                  </span>
                  <span className="ml-auto text-xs font-bold text-ember">Open →</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
