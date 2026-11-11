import { useMemo, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Flag,
  Loader2,
  MessageSquare,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAction } from "@/lib/actions";
import {
  useMyProposalFor,
  useProjectProposals,
  usePortfolio,
  useSavedProjectIds,
} from "@/lib/data";
import { DELIVERY_TIMES, type Project, type Proposal, type Workspace } from "@/lib/sabi";
import { formatNaira, timeAgo } from "@/lib/format";
import { fieldErrors, proposalSchema } from "@/lib/validation";
import { errMessage } from "@/lib/errors";
import {
  Badge,
  Button,
  Card,
  Input,
  PageLoader,
  Select,
  Textarea,
} from "@/components/sabi/primitives";
import { Avatar, Confirm, ErrorNote, Field, StatusBadge } from "@/components/sabi/page";
import { EmptyState } from "@/components/sabi/cards";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- Report */

const REPORT_REASONS = [
  "Spam or scam",
  "Fake profile or project",
  "Inappropriate content",
  "Harassment",
  "Payment problem",
  "Other",
];

export function ReportButton({
  targetType,
  targetId,
  label = "Report",
}: {
  targetType: "workspace" | "project" | "proposal" | "message" | "review";
  targetId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]!);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const { error } = await supabase.from("reports").insert({
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details.trim() || null,
    });
    setBusy(false);
    if (error) {
      toast.error(errMessage(error));
      return;
    }
    toast.success("Thanks — our team will review your report.");
    setOpen(false);
    setDetails("");
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Flag className="h-3.5 w-3.5" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report a concern</DialogTitle>
            <DialogDescription>
              Tell us what's wrong. Reports are private and reviewed by the Sabi team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Reason" htmlFor="report-reason">
              <Select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REPORT_REASONS.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </Select>
            </Field>
            <Field label="Details (optional)" htmlFor="report-details">
              <Textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={2000}
                placeholder="What happened?"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------------------------------------------------------------- Save */

export function SaveProjectButton({
  projectId,
  workspace,
}: {
  projectId: string;
  workspace: Workspace;
}) {
  const qc = useQueryClient();
  const { data: saved } = useSavedProjectIds(workspace.type === "creative" ? workspace.id : null);
  const [busy, setBusy] = useState(false);
  if (workspace.type !== "creative") return null;
  const isSaved = saved?.has(projectId) ?? false;

  async function toggle() {
    setBusy(true);
    const { error } = isSaved
      ? await supabase
          .from("saved_projects")
          .delete()
          .eq("creative_workspace_id", workspace.id)
          .eq("project_id", projectId)
      : await supabase
          .from("saved_projects")
          .insert({ creative_workspace_id: workspace.id, project_id: projectId });
    setBusy(false);
    if (error) toast.error(errMessage(error));
    else {
      toast.success(isSaved ? "Removed from saved projects." : "Project saved.");
      qc.invalidateQueries({ queryKey: ["saved-projects"] });
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={toggle}
      disabled={busy}
      aria-pressed={isSaved}
    >
      {isSaved ? (
        <BookmarkCheck className="h-4 w-4 text-ember" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
      {isSaved ? "Saved" : "Save"}
    </Button>
  );
}

/* ---------------------------------------------------------------- Proposal form (creative) */

export function ProposalForm({ project, workspace }: { project: Project; workspace: Workspace }) {
  const { data: existing, isLoading } = useMyProposalFor(project.id, workspace.id);
  const { data: portfolio } = usePortfolio(workspace.id);
  const { run, isBusy } = useAction();
  const [editing, setEditing] = useState(false);

  if (isLoading) return <PageLoader />;

  const closedForProposals =
    !["published", "in_discussion"].includes(project.status) ||
    (project.proposal_deadline != null &&
      new Date(project.proposal_deadline) < new Date(new Date().toDateString()));

  if (existing && !editing) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-base font-bold">Your proposal</h3>
          <StatusBadge kind="proposal" status={existing.status} />
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Price</dt>
            <dd className="font-bold">{formatNaira(existing.price)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Delivery</dt>
            <dd className="font-bold">{existing.delivery_time ?? "—"}</dd>
          </div>
        </dl>
        {existing.cover_message && (
          <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">
            {existing.cover_message}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Sent {timeAgo(existing.created_at)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {existing.status === "submitted" && (
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit proposal
            </Button>
          )}
          {["submitted", "shortlisted"].includes(existing.status) && (
            <Confirm
              title="Withdraw this proposal?"
              description="The brand will no longer see it as active. You can re-submit while the project is open."
              confirmLabel="Withdraw"
              destructive
              onConfirm={() =>
                run(
                  "withdraw",
                  () => supabase.rpc("withdraw_proposal", { p_proposal_id: existing.id }),
                  "Proposal withdrawn.",
                )
              }
            >
              <Button size="sm" variant="ghost" disabled={isBusy("withdraw")}>
                Withdraw
              </Button>
            </Confirm>
          )}
          {existing.status === "withdrawn" && !closedForProposals && (
            <Button
              size="sm"
              onClick={() =>
                run(
                  "resubmit",
                  () => supabase.rpc("resubmit_proposal", { p_proposal_id: existing.id }),
                  "Proposal re-submitted.",
                )
              }
              disabled={isBusy("resubmit")}
            >
              Re-submit proposal
            </Button>
          )}
          {existing.status === "accepted" && (
            <Button asChild size="sm">
              <Link to="/work/$id" params={{ id: project.id }}>
                Open project workspace
              </Link>
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (closedForProposals && !existing) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        This project isn't accepting proposals right now.
      </Card>
    );
  }

  return (
    <ProposalFields
      key={existing?.id ?? "new"}
      project={project}
      workspace={workspace}
      existing={existing ?? null}
      portfolioLinks={(portfolio ?? []).map((p) => p.external_url).filter((u): u is string => !!u)}
      onDone={() => setEditing(false)}
      onCancel={existing ? () => setEditing(false) : undefined}
    />
  );
}

function ProposalFields({
  project,
  workspace,
  existing,
  portfolioLinks,
  onDone,
  onCancel,
}: {
  project: Project;
  workspace: Workspace;
  existing: Proposal | null;
  portfolioLinks: string[];
  onDone: () => void;
  onCancel: (() => void) | undefined;
}) {
  const { run, isBusy } = useAction();
  const [price, setPrice] = useState(existing ? String(existing.price) : "");
  const [delivery, setDelivery] = useState(existing?.delivery_time ?? "");
  const [cover, setCover] = useState(existing?.cover_message ?? "");
  const [approach, setApproach] = useState(existing?.approach ?? "");
  const [milestones, setMilestones] = useState(existing?.milestones ?? "");
  const [links, setLinks] = useState((existing?.portfolio_links ?? []).join("\n"));
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = proposalSchema.safeParse({
      price: price === "" ? Number.NaN : Number(price),
      delivery_time: delivery,
      cover_message: cover,
      approach,
      milestones: milestones.trim() || null,
      portfolio_links: links
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      toast.error("Please fix the highlighted fields.");
      return;
    }
    setErrors({});
    const v = parsed.data;
    const ok = await run(
      "save",
      () =>
        existing
          ? supabase
              .from("proposals")
              .update({
                price: v.price,
                delivery_time: v.delivery_time,
                cover_message: v.cover_message,
                approach: v.approach,
                milestones: v.milestones,
                portfolio_links: v.portfolio_links,
              })
              .eq("id", existing.id)
          : supabase.from("proposals").insert({
              project_id: project.id,
              creative_workspace_id: workspace.id,
              price: v.price,
              delivery_time: v.delivery_time,
              cover_message: v.cover_message,
              approach: v.approach,
              milestones: v.milestones,
              portfolio_links: v.portfolio_links,
            }),
      existing ? "Proposal updated." : "Proposal sent. The brand has been notified.",
    );
    if (ok) onDone();
  }

  return (
    <Card className="p-5">
      <h3 className="font-display text-lg font-bold">
        {existing ? "Edit your proposal" : "Send a proposal"}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Budget:{" "}
        {project.budget_type === "fixed"
          ? formatNaira(project.budget_min)
          : `${formatNaira(project.budget_min)} – ${formatNaira(project.budget_max)}`}
      </p>
      <form onSubmit={submit} className="mt-4 space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your price (₦)" htmlFor="pp-price" error={errors["price"]}>
            <Input
              id="pp-price"
              inputMode="numeric"
              type="number"
              min={1}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="95000"
            />
          </Field>
          <Field label="Delivery time" htmlFor="pp-delivery" error={errors["delivery_time"]}>
            <Select id="pp-delivery" value={delivery} onChange={(e) => setDelivery(e.target.value)}>
              <option value="">Select…</option>
              {DELIVERY_TIMES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Cover message"
          htmlFor="pp-cover"
          error={errors["cover_message"]}
          hint="Show you understand the brief and why you're a good fit."
        >
          <Textarea
            id="pp-cover"
            value={cover}
            onChange={(e) => setCover(e.target.value)}
            maxLength={3000}
          />
        </Field>
        <Field
          label="Your approach"
          htmlFor="pp-approach"
          error={errors["approach"]}
          hint="How will you deliver the work?"
        >
          <Textarea
            id="pp-approach"
            value={approach}
            onChange={(e) => setApproach(e.target.value)}
            maxLength={5000}
          />
        </Field>
        <Field label="Milestones (optional)" htmlFor="pp-milestones" error={errors["milestones"]}>
          <Textarea
            id="pp-milestones"
            className="min-h-16"
            value={milestones}
            onChange={(e) => setMilestones(e.target.value)}
            placeholder="e.g. Day 3: concepts · Day 7: first edit · Day 10: final files"
            maxLength={3000}
          />
        </Field>
        <Field
          label="Portfolio links (one per line, up to 6)"
          htmlFor="pp-links"
          error={
            errors["portfolio_links"] ??
            Object.entries(errors).find(([k]) => k.startsWith("portfolio_links."))?.[1]
          }
        >
          <Textarea
            id="pp-links"
            className="min-h-20"
            value={links}
            onChange={(e) => setLinks(e.target.value)}
            placeholder="https://…"
          />
          {portfolioLinks.length > 0 && (
            <button
              type="button"
              className="mt-1 text-xs font-semibold text-ember hover:underline"
              onClick={() =>
                setLinks(
                  Array.from(
                    new Set([
                      ...links
                        .split("\n")
                        .map((l) => l.trim())
                        .filter(Boolean),
                      ...portfolioLinks,
                    ]),
                  )
                    .slice(0, 6)
                    .join("\n"),
                )
              }
            >
              + Add links from my profile portfolio
            </button>
          )}
        </Field>
        <div className="flex gap-2">
          <Button type="submit" className="flex-1" disabled={isBusy("save")}>
            {isBusy("save") && <Loader2 className="h-4 w-4 animate-spin" />}
            {existing ? "Save changes" : "Send proposal"}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

/* ---------------------------------------------------------------- Proposals panel (brand) */

type SortKey = "newest" | "price" | "fastest" | "rating";

export function ProposalsPanel({ project }: { project: Project }) {
  const { data, isLoading, error, refetch } = useProjectProposals(project.id, true);
  const { run, isBusy } = useAction();
  const router = useRouter();
  const [view, setView] = useState<"cards" | "compare">("cards");
  const [sort, setSort] = useState<SortKey>("newest");
  const [hiring, setHiring] = useState<string | null>(null);

  const open = ["published", "in_discussion"].includes(project.status);
  const rows = useMemo(() => {
    const list = [...(data ?? [])].filter((p) => p.status !== "withdrawn");
    const speed = (t: string | null) => {
      const i = DELIVERY_TIMES.indexOf(t ?? "");
      return i === -1 ? 99 : i;
    };
    list.sort((a, b) =>
      sort === "price"
        ? a.price - b.price
        : sort === "fastest"
          ? speed(a.delivery_time) - speed(b.delivery_time)
          : sort === "rating"
            ? (b.creative?.rating ?? 0) - (a.creative?.rating ?? 0)
            : +new Date(b.created_at) - +new Date(a.created_at),
    );
    return list;
  }, [data, sort]);

  if (isLoading) return <PageLoader />;
  if (error) return <ErrorNote error={error} retry={() => refetch()} />;
  if (rows.length === 0)
    return (
      <EmptyState
        title="No proposals yet"
        description="Creatives who are interested will send proposals here. You'll get a notification for each one."
      />
    );

  const hiringRow = rows.find((r) => r.id === hiring) ?? null;

  function message(creativeId: string) {
    router.history.push(`/messages?project=${project.id}&creative=${creativeId}`);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-full bg-muted p-1 text-xs font-bold">
          {(["cards", "compare"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-full px-4 py-1.5 capitalize",
                view === v ? "bg-card shadow-sm" : "text-muted-foreground",
              )}
            >
              {v === "cards" ? "Detailed" : "Compare"}
            </button>
          ))}
        </div>
        <div className="w-44">
          <Select
            aria-label="Sort proposals"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="newest">Newest first</option>
            <option value="price">Lowest price</option>
            <option value="fastest">Fastest delivery</option>
            <option value="rating">Top rated</option>
          </Select>
        </div>
      </div>

      {view === "compare" ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Creative</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Delivery</th>
                <th className="px-4 py-3 font-semibold">Rating</th>
                <th className="px-4 py-3 font-semibold">Links</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-t border-border/70">
                  <td className="px-4 py-3">
                    <Link
                      to="/creative/$slug"
                      params={{ slug: p.creative?.slug ?? "" }}
                      className="flex items-center gap-2 font-semibold hover:underline"
                    >
                      <Avatar
                        src={p.creative?.avatar_url}
                        name={p.creative?.name ?? "?"}
                        className="h-8 w-8 text-xs"
                      />
                      {p.creative?.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-bold">{formatNaira(p.price)}</td>
                  <td className="px-4 py-3">{p.delivery_time ?? "—"}</td>
                  <td className="px-4 py-3">
                    {(p.creative?.rating ?? 0).toFixed(1)}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({p.creative?.reviews_count ?? 0})
                    </span>
                  </td>
                  <td className="px-4 py-3">{p.portfolio_links.length}</td>
                  <td className="px-4 py-3">
                    <StatusBadge kind="proposal" status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {open &&
                      ["submitted", "shortlisted"].includes(p.status) &&
                      !project.is_demo && (
                        <Button size="sm" onClick={() => setHiring(p.id)}>
                          Hire
                        </Button>
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((p) => (
            <Card key={p.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link
                  to="/creative/$slug"
                  params={{ slug: p.creative?.slug ?? "" }}
                  className="flex items-center gap-3"
                >
                  <Avatar
                    src={p.creative?.avatar_url}
                    name={p.creative?.name ?? "?"}
                    className="h-12 w-12"
                  />
                  <span>
                    <span className="flex items-center gap-1 font-display font-bold hover:underline">
                      {p.creative?.name}
                      {p.creative?.verified && (
                        <BadgeCheck className="h-4 w-4 text-primary" aria-label="Verified" />
                      )}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-gold text-gold" />{" "}
                      {(p.creative?.rating ?? 0).toFixed(1)} ({p.creative?.reviews_count ?? 0}) ·{" "}
                      {p.creative?.location ?? "—"}
                    </span>
                  </span>
                </Link>
                <div className="text-right">
                  <p className="font-display text-xl font-extrabold">{formatNaira(p.price)}</p>
                  <p className="text-xs text-muted-foreground">{p.delivery_time ?? "—"}</p>
                </div>
              </div>
              <div className="mt-2">
                <StatusBadge kind="proposal" status={p.status} />
              </div>
              {p.cover_message && (
                <p className="mt-3 whitespace-pre-line text-sm">{p.cover_message}</p>
              )}
              {p.approach && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-muted-foreground">Approach</p>
                  <p className="whitespace-pre-line text-sm">{p.approach}</p>
                </div>
              )}
              {p.milestones && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-muted-foreground">Milestones</p>
                  <p className="whitespace-pre-line text-sm">{p.milestones}</p>
                </div>
              )}
              {p.portfolio_links.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.portfolio_links.map((l) => (
                    <a
                      key={l}
                      href={l}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold hover:bg-secondary/70"
                    >
                      <ExternalLink className="h-3 w-3" />{" "}
                      {new URL(l).hostname.replace(/^www\./, "")}
                    </a>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {open && ["submitted", "shortlisted"].includes(p.status) && (
                  <>
                    {!project.is_demo && (
                      <Button size="sm" onClick={() => setHiring(p.id)}>
                        Hire
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy(`sl-${p.id}`)}
                      onClick={() =>
                        run(
                          `sl-${p.id}`,
                          () =>
                            supabase.rpc("set_proposal_status", {
                              p_proposal_id: p.id,
                              p_status: p.status === "shortlisted" ? "submitted" : "shortlisted",
                            }),
                          p.status === "shortlisted" ? "Removed from shortlist." : "Shortlisted.",
                        )
                      }
                    >
                      {p.status === "shortlisted" ? "Remove from shortlist" : "Shortlist"}
                    </Button>
                    <Confirm
                      title="Decline this proposal?"
                      description="The creative will be notified that you didn't select their proposal."
                      confirmLabel="Decline"
                      destructive
                      onConfirm={() =>
                        run(
                          `dc-${p.id}`,
                          () =>
                            supabase.rpc("set_proposal_status", {
                              p_proposal_id: p.id,
                              p_status: "declined",
                            }),
                          "Proposal declined.",
                        )
                      }
                    >
                      <Button size="sm" variant="ghost">
                        Decline
                      </Button>
                    </Confirm>
                  </>
                )}
                {open && p.status === "declined" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      run(
                        `re-${p.id}`,
                        () =>
                          supabase.rpc("set_proposal_status", {
                            p_proposal_id: p.id,
                            p_status: "submitted",
                          }),
                        "Proposal restored.",
                      )
                    }
                  >
                    Restore
                  </Button>
                )}
                {!project.is_demo && (
                  <Button size="sm" variant="soft" onClick={() => message(p.creative_workspace_id)}>
                    <MessageSquare className="h-3.5 w-3.5" /> Ask a question
                  </Button>
                )}
                <ReportButton targetType="proposal" targetId={p.id} />
              </div>
            </Card>
          ))}
        </div>
      )}

      {hiringRow && (
        <HireDialog project={project} proposal={hiringRow} onClose={() => setHiring(null)} />
      )}
    </div>
  );
}

function HireDialog({
  project,
  proposal,
  onClose,
}: {
  project: Project;
  proposal: Proposal & { creative: { name: string } | null };
  onClose: () => void;
}) {
  const { run, isBusy } = useAction();
  const router = useRouter();
  const [price, setPrice] = useState(String(proposal.price));
  const [deadline, setDeadline] = useState(project.deadline ?? "");
  const [scope, setScope] = useState(project.deliverables.map((d) => `• ${d}`).join("\n"));
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0) return setError("Enter a valid agreed price.");
    if (!deadline) return setError("Choose the agreed deadline.");
    if (new Date(deadline) < new Date(new Date().toDateString()))
      return setError("The agreed deadline can't be in the past.");
    setError(null);
    const ok = await run(
      "hire",
      () =>
        supabase.rpc("hire_creative", {
          p_proposal_id: proposal.id,
          p_agreed_price: n,
          p_agreed_deadline: deadline,
          p_scope: scope,
        }),
      `You hired ${proposal.creative?.name ?? "this creative"}.`,
    );
    if (ok) {
      onClose();
      router.history.push(`/work/${project.id}`);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hire {proposal.creative?.name}</DialogTitle>
          <DialogDescription>
            Confirm the scope, price and deadline you've agreed. Other open proposals will be
            declined.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Agreed price (₦)" htmlFor="hire-price">
              <Input
                id="hire-price"
                type="number"
                min={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
            <Field label="Agreed deadline" htmlFor="hire-deadline">
              <Input
                id="hire-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Agreed scope"
            htmlFor="hire-scope"
            hint="This is saved with the project and visible to both of you."
          >
            <Textarea
              id="hire-scope"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              maxLength={4000}
            />
          </Field>
          <p className="rounded-xl bg-gold-soft/50 p-3 text-xs text-muted-foreground">
            Payments are recorded in Sabi and arranged directly between you and the creative during
            the pilot. Sabi does not hold funds or provide escrow.
          </p>
          {error && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={isBusy("hire")}>
            {isBusy("hire") && <Loader2 className="h-4 w-4 animate-spin" />} Confirm hire
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { Badge };
