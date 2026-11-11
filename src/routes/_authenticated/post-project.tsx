import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceContext } from "@/components/sabi/app-shell";
import { useAction } from "@/lib/actions";
import { useProject } from "@/lib/data";
import { CATEGORIES, LOCATIONS } from "@/lib/sabi";
import { budgetLabel } from "@/lib/format";
import { fieldErrors, projectSchema } from "@/lib/validation";
import { Button, Card, Input, PageLoader, Select, Textarea } from "@/components/sabi/primitives";
import {
  Field,
  ImageUpload,
  PageHeader,
  RequireWorkspaceType,
  TagInput,
} from "@/components/sabi/page";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/post-project")({
  validateSearch: z.object({ edit: z.string().uuid().optional().catch(undefined) }),
  head: () => ({ meta: [{ title: "Post a project — Sabi" }] }),
  component: PostProject,
});

const STEPS = ["Details", "Deliverables", "Budget & timeline", "Review & publish"] as const;
const STEP_FIELDS: Record<number, string[]> = {
  0: ["title", "category", "description", "location", "skills", "preferred_experience"],
  1: ["deliverables"],
  2: ["budget_type", "budget_min", "budget_max", "deadline", "proposal_deadline"],
};

function PostProject() {
  const ws = useWorkspaceContext();
  return (
    <>
      <PageHeader
        title="Post a project"
        subtitle="Describe what you need and let creatives come to you."
      />
      <RequireWorkspaceType type="brand">
        <Wizard brandId={ws.id} defaultLocation={ws.location ?? "Lagos"} />
      </RequireWorkspaceType>
    </>
  );
}

function Wizard({ brandId, defaultLocation }: { brandId: string; defaultLocation: string }) {
  const { edit } = Route.useSearch();
  const router = useRouter();
  const { data: existing, isLoading } = useProject(edit ?? "00000000-0000-0000-0000-000000000000");
  const { run, isBusy } = useAction();
  const [projectId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(!edit);
  const [f, setF] = useState({
    title: "",
    category: "",
    description: "",
    location: defaultLocation,
    is_remote: false,
    skills: [] as string[],
    preferred_experience: "",
    deliverables: [] as string[],
    image_url: null as string | null,
    budget_type: "range" as "fixed" | "range",
    budget_min: "",
    budget_max: "",
    deadline: "",
    proposal_deadline: "",
  });

  useEffect(() => {
    if (edit && existing && !loaded) {
      setF({
        title: existing.title,
        category: existing.category,
        description: existing.description,
        location: existing.location ?? defaultLocation,
        is_remote: existing.is_remote,
        skills: existing.skills,
        preferred_experience: existing.preferred_experience ?? "",
        deliverables: existing.deliverables,
        image_url: existing.image_url,
        budget_type: existing.budget_type as "fixed" | "range",
        budget_min: existing.budget_min?.toString() ?? "",
        budget_max: existing.budget_max?.toString() ?? "",
        deadline: existing.deadline ?? "",
        proposal_deadline: existing.proposal_deadline ?? "",
      });
      setLoaded(true);
    }
  }, [edit, existing, loaded, defaultLocation]);

  if (edit && isLoading) return <PageLoader />;
  if (edit && !existing)
    return <p className="text-sm text-muted-foreground">We couldn't find that project.</p>;
  if (edit && existing && existing.brand_workspace_id !== brandId)
    return (
      <p className="text-sm text-muted-foreground">
        This project belongs to a different workspace. Switch workspace to edit it.
      </p>
    );
  if (edit && existing && !["draft", "published", "in_discussion"].includes(existing.status))
    return (
      <p className="text-sm text-muted-foreground">
        This project can no longer be edited because work has started.
      </p>
    );

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  function parse() {
    return projectSchema.safeParse({
      title: f.title,
      category: f.category,
      description: f.description,
      deliverables: f.deliverables,
      budget_type: f.budget_type,
      budget_min: f.budget_min === "" ? Number.NaN : Number(f.budget_min),
      budget_max: f.budget_type === "range" && f.budget_max !== "" ? Number(f.budget_max) : null,
      deadline: f.deadline,
      proposal_deadline: f.proposal_deadline || null,
      location: f.location || null,
      is_remote: f.is_remote,
      skills: f.skills,
      preferred_experience: f.preferred_experience.trim() || null,
    });
  }

  function validateStep(s: number): boolean {
    const r = parse();
    if (r.success) {
      setErrors({});
      return true;
    }
    const all = fieldErrors(r.error);
    const mine = Object.fromEntries(
      Object.entries(all).filter(([k]) =>
        STEP_FIELDS[s]?.some((p) => k === p || k.startsWith(p + ".")),
      ),
    );
    setErrors(mine);
    return Object.keys(mine).length === 0;
  }

  function payload(v: z.infer<typeof projectSchema>) {
    return {
      title: v.title,
      category: v.category,
      description: v.description,
      deliverables: v.deliverables,
      budget_type: v.budget_type,
      budget_min: v.budget_min,
      budget_max: v.budget_type === "range" ? v.budget_max : null,
      deadline: v.deadline,
      proposal_deadline: v.proposal_deadline,
      location: v.location,
      is_remote: v.is_remote,
      skills: v.skills,
      preferred_experience: v.preferred_experience,
      image_url: f.image_url,
    };
  }

  async function save(publish: boolean) {
    if (publish) {
      const r = parse();
      if (!r.success) {
        const all = fieldErrors(r.error);
        setErrors(all);
        const firstBad = [0, 1, 2].find((s) =>
          Object.keys(all).some((k) =>
            STEP_FIELDS[s]?.some((p) => k === p || k.startsWith(p + ".")),
          ),
        );
        if (firstBad !== undefined) setStep(firstBad);
        toast.error("Please complete the highlighted fields before publishing.");
        return;
      }
      const v = payload(r.data);
      const id = edit ?? projectId;
      const ok = await run(
        "save",
        async () => {
          const w = edit
            ? await supabase.from("projects").update(v).eq("id", id)
            : await supabase.from("projects").insert({ id, brand_workspace_id: brandId, ...v });
          if (w.error) return w;
          if (!edit || existing?.status === "draft")
            return supabase.rpc("set_project_status", { p_project_id: id, p_status: "published" });
          return w;
        },
        edit && existing?.status !== "draft" ? "Project updated." : "Your project is live.",
      );
      if (ok) router.history.push(`/project/${id}`);
      return;
    }
    // Draft: only a title is needed.
    if (f.title.trim().length < 3) {
      setErrors({ title: "Add a title (3+ characters) to save a draft." });
      setStep(0);
      return;
    }
    const id = edit ?? projectId;
    const draft = {
      title: f.title.trim(),
      category: f.category || "Other",
      description: f.description.trim(),
      deliverables: f.deliverables,
      budget_type: f.budget_type,
      budget_min: f.budget_min ? Number(f.budget_min) : null,
      budget_max: f.budget_type === "range" && f.budget_max ? Number(f.budget_max) : null,
      deadline: f.deadline || null,
      proposal_deadline: f.proposal_deadline || null,
      location: f.location || null,
      is_remote: f.is_remote,
      skills: f.skills,
      preferred_experience: f.preferred_experience.trim() || null,
      image_url: f.image_url,
    };
    const ok = await run(
      "draft",
      () =>
        edit
          ? supabase.from("projects").update(draft).eq("id", id)
          : supabase.from("projects").insert({ id, brand_workspace_id: brandId, ...draft }),
      "Draft saved.",
    );
    if (ok) router.history.push("/posted-projects");
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-6 flex gap-2 overflow-x-auto" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={cn(
              "flex flex-1 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-xs font-bold",
              i === step
                ? "bg-primary text-primary-foreground"
                : i < step
                  ? "bg-forest-soft text-secondary-foreground"
                  : "bg-muted text-muted-foreground",
            )}
            aria-current={i === step ? "step" : undefined}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-card/30 text-[11px]">
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <Card className="space-y-5 p-6">
        {step === 0 && (
          <>
            <Field label="Project title" htmlFor="pj-title" error={errors["title"]}>
              <Input
                id="pj-title"
                value={f.title}
                onChange={(e) => set("title", e.target.value)}
                maxLength={140}
                placeholder="Create 12 Instagram posts for our restaurant"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" htmlFor="pj-cat" error={errors["category"]}>
                <Select
                  id="pj-cat"
                  value={f.category}
                  onChange={(e) => set("category", e.target.value)}
                >
                  <option value="">Select…</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.name}>{c.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Location" htmlFor="pj-loc" error={errors["location"]}>
                <Select
                  id="pj-loc"
                  value={f.location}
                  onChange={(e) => set("location", e.target.value)}
                >
                  {LOCATIONS.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={f.is_remote}
                onChange={(e) => set("is_remote", e.target.checked)}
              />{" "}
              Creatives can work remotely
            </label>
            <Field
              label="Description"
              htmlFor="pj-desc"
              error={errors["description"]}
              hint="What do you need, who is it for, and what should it feel like?"
            >
              <Textarea
                id="pj-desc"
                className="min-h-40"
                value={f.description}
                onChange={(e) => set("description", e.target.value)}
                maxLength={6000}
              />
            </Field>
            <Field label="Skills wanted (optional)" htmlFor="pj-skills">
              <TagInput
                id="pj-skills"
                value={f.skills}
                onChange={(v) => set("skills", v)}
                max={15}
                placeholder="e.g. Videography"
              />
            </Field>
            <Field
              label="Preferred experience (optional)"
              htmlFor="pj-exp"
              error={errors["preferred_experience"]}
            >
              <Input
                id="pj-exp"
                value={f.preferred_experience}
                onChange={(e) => set("preferred_experience", e.target.value)}
                maxLength={500}
                placeholder="e.g. Has worked with restaurants"
              />
            </Field>
          </>
        )}
        {step === 1 && (
          <>
            <Field
              label="Deliverables"
              htmlFor="pj-del"
              error={errors["deliverables"]}
              hint="List each item the creative must produce. Press Enter to add."
            >
              <TagInput
                id="pj-del"
                value={f.deliverables}
                onChange={(v) => set("deliverables", v)}
                max={25}
                placeholder="e.g. 8 static posts"
              />
            </Field>
            <ImageUpload
              label="Reference image (optional)"
              value={f.image_url}
              onChange={(u) => set("image_url", u)}
              workspaceId={brandId}
              folder="projects"
              shape="wide"
            />
          </>
        )}
        {step === 2 && (
          <>
            <div className="flex rounded-full bg-muted p-1 text-sm font-bold sm:w-72">
              {(["range", "fixed"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("budget_type", t)}
                  className={cn(
                    "flex-1 rounded-full px-4 py-2",
                    f.budget_type === t ? "bg-card shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {t === "range" ? "Budget range" : "Fixed budget"}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={f.budget_type === "fixed" ? "Budget (₦)" : "Minimum (₦)"}
                htmlFor="pj-min"
                error={errors["budget_min"]}
              >
                <Input
                  id="pj-min"
                  type="number"
                  min={1}
                  value={f.budget_min}
                  onChange={(e) => set("budget_min", e.target.value)}
                  placeholder="100000"
                />
              </Field>
              {f.budget_type === "range" && (
                <Field label="Maximum (₦)" htmlFor="pj-max" error={errors["budget_max"]}>
                  <Input
                    id="pj-max"
                    type="number"
                    min={1}
                    value={f.budget_max}
                    onChange={(e) => set("budget_max", e.target.value)}
                    placeholder="150000"
                  />
                </Field>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Project deadline" htmlFor="pj-deadline" error={errors["deadline"]}>
                <Input
                  id="pj-deadline"
                  type="date"
                  min={today}
                  value={f.deadline}
                  onChange={(e) => set("deadline", e.target.value)}
                />
              </Field>
              <Field
                label="Proposals close (optional)"
                htmlFor="pj-pdeadline"
                error={errors["proposal_deadline"]}
              >
                <Input
                  id="pj-pdeadline"
                  type="date"
                  min={today}
                  value={f.proposal_deadline}
                  onChange={(e) => set("proposal_deadline", e.target.value)}
                />
              </Field>
            </div>
          </>
        )}
        {step === 3 && (
          <div className="space-y-4 text-sm">
            <h2 className="font-display text-xl font-bold">{f.title || "Untitled project"}</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Category</dt>
                <dd className="font-semibold">{f.category || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Location</dt>
                <dd className="font-semibold">{f.is_remote ? "Remote" : f.location}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Budget</dt>
                <dd className="font-semibold">
                  {budgetLabel(
                    f.budget_type,
                    f.budget_min ? Number(f.budget_min) : null,
                    f.budget_max ? Number(f.budget_max) : null,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Deadline</dt>
                <dd className="font-semibold">{f.deadline || "—"}</dd>
              </div>
            </dl>
            <p className="whitespace-pre-line text-foreground/85">{f.description}</p>
            <ul className="list-disc space-y-1 pl-5">
              {f.deliverables.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            {Object.keys(errors).length > 0 && (
              <p role="alert" className="font-semibold text-destructive">
                Some required details are missing. Go back to complete them.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-5">
          <Button
            type="button"
            variant="ghost"
            disabled={step === 0}
            onClick={() => setStep(step - 1)}
          >
            Back
          </Button>
          <div className="flex gap-2">
            {(!edit || existing?.status === "draft") && (
              <Button
                type="button"
                variant="outline"
                disabled={isBusy("draft")}
                onClick={() => save(false)}
              >
                {isBusy("draft") && <Loader2 className="h-4 w-4 animate-spin" />}Save draft
              </Button>
            )}
            {step < 3 ? (
              <Button type="button" onClick={() => validateStep(step) && setStep(step + 1)}>
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                variant="ember"
                disabled={isBusy("save")}
                onClick={() => save(true)}
              >
                {isBusy("save") && <Loader2 className="h-4 w-4 animate-spin" />}
                {edit && existing?.status !== "draft" ? "Save changes" : "Publish project"}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
