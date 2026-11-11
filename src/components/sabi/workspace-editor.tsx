import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAction } from "@/lib/actions";
import { usePortfolio } from "@/lib/data";
import { CATEGORIES, INDUSTRIES, LOCATIONS, type Workspace } from "@/lib/sabi";
import { fieldErrors, portfolioSchema, workspaceSchema } from "@/lib/validation";
import { Button, Card, Input, Select, Textarea } from "@/components/sabi/primitives";
import { Confirm, Field, ImageUpload, SectionCard, TagInput } from "@/components/sabi/page";

const AVAILABILITY = ["Available now", "Limited availability", "Booked", "Not available"];

export function WorkspaceEditor({ ws }: { ws: Workspace }) {
  const { run, isBusy } = useAction();
  const isBrand = ws.type === "brand";
  const [f, setF] = useState({
    name: ws.name,
    tagline: ws.tagline ?? "",
    description: ws.description ?? "",
    industry: ws.industry ?? "",
    location: ws.location ?? "",
    website_url: ws.website_url ?? "",
    skills: ws.skills,
    services: ws.services,
    starting_price: ws.starting_price?.toString() ?? "",
    availability: ws.availability,
    avatar_url: ws.avatar_url,
    logo_url: ws.logo_url,
    cover_url: ws.cover_url,
    published: ws.published,
    open_to_projects: ws.open_to_projects,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = workspaceSchema.safeParse({
      name: f.name,
      tagline: f.tagline || null,
      description: f.description || null,
      industry: f.industry || null,
      location: f.location || null,
      website_url: f.website_url || null,
      skills: f.skills,
      services: f.services,
      starting_price: f.starting_price === "" ? null : Number(f.starting_price),
      availability: f.availability,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    const v = parsed.data;
    await run(
      "save",
      () =>
        supabase
          .from("workspaces")
          .update({
            name: v.name,
            tagline: v.tagline,
            description: v.description,
            industry: v.industry,
            location: v.location,
            website_url: v.website_url,
            skills: v.skills,
            services: v.services,
            starting_price: v.starting_price,
            availability: v.availability,
            avatar_url: f.avatar_url,
            logo_url: f.logo_url,
            cover_url: f.cover_url,
            published: f.published,
            open_to_projects: f.open_to_projects,
          })
          .eq("id", ws.id),
      "Profile saved.",
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} noValidate>
        <SectionCard
          title={isBrand ? "Brand profile" : "Creative profile"}
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={isBrand ? "/brand/$slug" : "/creative/$slug"} params={{ slug: ws.slug }}>
                View public page
              </Link>
            </Button>
          }
        >
          <div className="space-y-5">
            {isBrand ? (
              <>
                <ImageUpload
                  label="Brand logo"
                  shape="round"
                  value={f.logo_url}
                  onChange={(u) => set("logo_url", u)}
                  workspaceId={ws.id}
                  folder="logo"
                />
                <ImageUpload
                  label="Cover image"
                  shape="wide"
                  value={f.cover_url}
                  onChange={(u) => set("cover_url", u)}
                  workspaceId={ws.id}
                  folder="cover"
                />
              </>
            ) : (
              <ImageUpload
                label="Profile photo"
                shape="round"
                value={f.avatar_url}
                onChange={(u) => set("avatar_url", u)}
                workspaceId={ws.id}
                folder="avatar"
              />
            )}
            <Field
              label={isBrand ? "Brand name" : "Display name"}
              htmlFor="we-name"
              error={errors["name"]}
            >
              <Input
                id="we-name"
                value={f.name}
                maxLength={80}
                onChange={(e) => set("name", e.target.value)}
              />
            </Field>
            <Field
              label={isBrand ? "Tagline" : "Headline"}
              htmlFor="we-tag"
              error={errors["tagline"]}
            >
              <Input
                id="we-tag"
                value={f.tagline}
                maxLength={200}
                onChange={(e) => set("tagline", e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={isBrand ? "Industry" : "Specialty"} htmlFor="we-ind">
                <Select
                  id="we-ind"
                  value={f.industry}
                  onChange={(e) => set("industry", e.target.value)}
                >
                  <option value="">Select…</option>
                  {(isBrand ? INDUSTRIES : CATEGORIES.map((c) => c.name)).map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Location" htmlFor="we-loc">
                <Select
                  id="we-loc"
                  value={f.location}
                  onChange={(e) => set("location", e.target.value)}
                >
                  <option value="">Select…</option>
                  {LOCATIONS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field
              label={isBrand ? "About your brand" : "About you"}
              htmlFor="we-desc"
              error={errors["description"]}
            >
              <Textarea
                id="we-desc"
                className="min-h-32"
                value={f.description}
                maxLength={3000}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
            {isBrand ? (
              <Field label="Website" htmlFor="we-web" error={errors["website_url"]}>
                <Input
                  id="we-web"
                  type="url"
                  placeholder="https://"
                  value={f.website_url}
                  onChange={(e) => set("website_url", e.target.value)}
                />
              </Field>
            ) : (
              <>
                <Field label="Skills" htmlFor="we-skills">
                  <TagInput
                    id="we-skills"
                    value={f.skills}
                    onChange={(v) => set("skills", v)}
                    placeholder="e.g. Photography"
                  />
                </Field>
                <Field label="Services" htmlFor="we-services">
                  <TagInput
                    id="we-services"
                    value={f.services}
                    onChange={(v) => set("services", v)}
                    placeholder="e.g. Brand shoots"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Starting price (₦)"
                    htmlFor="we-price"
                    error={errors["starting_price"]}
                  >
                    <Input
                      id="we-price"
                      type="number"
                      min={0}
                      value={f.starting_price}
                      onChange={(e) => set("starting_price", e.target.value)}
                    />
                  </Field>
                  <Field label="Availability" htmlFor="we-avail">
                    <Select
                      id="we-avail"
                      value={
                        AVAILABILITY.includes(f.availability) ? f.availability : "Available now"
                      }
                      onChange={(e) => set("availability", e.target.value)}
                    >
                      {AVAILABILITY.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </>
            )}
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                className="mt-1"
                type="checkbox"
                checked={f.published}
                onChange={(e) => set("published", e.target.checked)}
              />
              <span>
                <span className="font-semibold">Show my profile publicly</span>
                <span className="block text-xs text-muted-foreground">
                  Turn off to hide it from search and the directory.
                </span>
              </span>
            </label>
            <Button type="submit" disabled={isBusy("save")}>
              {isBusy("save") && <Loader2 className="h-4 w-4 animate-spin" />}Save changes
            </Button>
          </div>
        </SectionCard>
      </form>
      {!isBrand && <PortfolioManager ws={ws} />}
    </div>
  );
}

function PortfolioManager({ ws }: { ws: Workspace }) {
  const { data } = usePortfolio(ws.id);
  const { run, isBusy } = useAction();
  const [f, setF] = useState({
    title: "",
    description: "",
    external_url: "",
    media_url: null as string | null,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const parsed = portfolioSchema.safeParse({
      title: f.title,
      description: f.description || null,
      external_url: f.external_url || null,
      media_url: f.media_url,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    const ok = await run(
      "add",
      () => supabase.from("portfolio_items").insert({ workspace_id: ws.id, ...parsed.data }),
      "Added to your portfolio.",
    );
    if (ok) setF({ title: "", description: "", external_url: "", media_url: null });
  }

  return (
    <SectionCard title="Portfolio">
      {(data ?? []).length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data!.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              {item.media_url && (
                <div className="aspect-[4/3] bg-muted">
                  <img
                    src={item.media_url}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="flex items-start justify-between gap-2 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{item.title}</p>
                  {item.external_url && (
                    <p className="truncate text-xs text-muted-foreground">{item.external_url}</p>
                  )}
                </div>
                <Confirm
                  title="Remove this item?"
                  description="It will disappear from your public portfolio."
                  confirmLabel="Remove"
                  destructive
                  onConfirm={() =>
                    run(
                      `del-${item.id}`,
                      () => supabase.from("portfolio_items").delete().eq("id", item.id),
                      "Removed.",
                    )
                  }
                >
                  <button
                    aria-label={`Remove ${item.title}`}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </Confirm>
              </div>
            </Card>
          ))}
        </div>
      )}
      <form onSubmit={add} className="space-y-4" noValidate>
        <p className="text-sm font-bold">Add a work sample</p>
        <ImageUpload
          label="Image (optional if you add a link)"
          shape="wide"
          value={f.media_url}
          onChange={(u) => setF({ ...f, media_url: u })}
          workspaceId={ws.id}
          folder="portfolio"
        />
        <Field label="Title" htmlFor="pf-title" error={errors["title"]}>
          <Input
            id="pf-title"
            value={f.title}
            maxLength={120}
            onChange={(e) => setF({ ...f, title: e.target.value })}
          />
        </Field>
        <Field label="Link (optional)" htmlFor="pf-url" error={errors["external_url"]}>
          <Input
            id="pf-url"
            placeholder="https://"
            value={f.external_url}
            onChange={(e) => setF({ ...f, external_url: e.target.value })}
          />
        </Field>
        <Field label="Description (optional)" htmlFor="pf-desc">
          <Textarea
            id="pf-desc"
            className="min-h-16"
            maxLength={1000}
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
          />
        </Field>
        <Button type="submit" variant="outline" disabled={isBusy("add")}>
          {isBusy("add") && <Loader2 className="h-4 w-4 animate-spin" />}Add to portfolio
        </Button>
      </form>
    </SectionCard>
  );
}
