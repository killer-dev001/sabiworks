import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ExternalLink, FileDown, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/hooks";
import { useAction } from "@/lib/actions";
import { useContractForProject, useProject } from "@/lib/data";
import { formatNaira, timeAgo } from "@/lib/format";
import { errMessage } from "@/lib/errors";
import { fieldErrors, reviewSchema } from "@/lib/validation";
import { signedDeliverableUrl, uploadDeliverableFile, validateDeliverable } from "@/lib/storage";
import { Badge, Button, Card, Input, PageLoader, Textarea } from "@/components/sabi/primitives";
import { EmptyState } from "@/components/sabi/cards";
import {
  Confirm,
  ErrorNote,
  Field,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/sabi/page";
import { MessageThread } from "@/components/sabi/messages";
import { ReportButton } from "@/components/sabi/proposals";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/work/$id")({
  head: () => ({ meta: [{ title: "Project workspace — Sabi" }] }),
  component: WorkspacePage,
});

const STAGES = [
  { key: "hired", label: "Awarded" },
  { key: "in_progress", label: "In progress" },
  { key: "in_review", label: "In review" },
  { key: "completed", label: "Completed" },
];

function WorkspacePage() {
  const { id } = Route.useParams();
  const { userId } = useSession();
  const project = useProject(id);
  const contract = useContractForProject(id);
  if (project.isLoading || contract.isLoading) return <PageLoader />;
  if (project.error || contract.error)
    return (
      <ErrorNote
        error={project.error ?? contract.error}
        retry={() => {
          project.refetch();
          contract.refetch();
        }}
      />
    );
  const p = project.data;
  const c = contract.data;
  if (!p || !c || !userId)
    return (
      <EmptyState
        title="Workspace not available"
        description="Either this project hasn't been awarded yet, or you aren't one of its two participants."
        action={
          <Button asChild variant="outline">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        }
      />
    );
  const side: "brand" | "creative" | null =
    c.brand?.owner_id === userId ? "brand" : c.creative?.owner_id === userId ? "creative" : null;
  if (!side)
    return (
      <EmptyState
        title="No access"
        description="Only the brand and the hired creative can open this workspace."
      />
    );

  const status = p.status;
  const stageIdx =
    status === "revision_requested"
      ? 1
      : Math.max(
          0,
          STAGES.findIndex((s) => s.key === status),
        );
  const cancelled = status === "cancelled";
  const payment = c.payment?.[0] ?? null;

  return (
    <>
      <PageHeader
        title={p.title}
        subtitle={`${c.brand?.name} × ${c.creative?.name}`}
        actions={<StatusBadge status={status} />}
      />
      {cancelled ? (
        <Card className="mb-6 bg-coral/10 p-4 text-sm font-semibold">
          This project was cancelled. If something went wrong, use "Report an issue" below.
        </Card>
      ) : (
        <ol className="mb-6 grid grid-cols-4 gap-2" aria-label="Project progress">
          {STAGES.map((s, i) => (
            <li
              key={s.key}
              className={cn(
                "rounded-xl px-2 py-2 text-center text-xs font-bold",
                i < stageIdx || status === "completed"
                  ? "bg-forest-soft text-secondary-foreground"
                  : i === stageIdx
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {i < stageIdx || status === "completed" ? (
                <Check className="mr-1 inline h-3 w-3" />
              ) : null}
              {status === "revision_requested" && i === 1 ? "Revision requested" : s.label}
            </li>
          ))}
        </ol>
      )}
      <Tabs defaultValue="overview">
        <TabsList className="mb-4 h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="messages">Messages</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="review">Review</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Overview project={p} contract={c} side={side} />
        </TabsContent>
        <TabsContent value="deliverables">
          <Deliverables project={p} side={side} />
        </TabsContent>
        <TabsContent value="messages">
          <Card className="flex h-[60vh] min-h-96 flex-col overflow-hidden">
            <MessageThread
              projectId={p.id}
              creativeWorkspaceId={c.creative_workspace_id}
              userId={userId}
              className="flex-1"
            />
          </Card>
        </TabsContent>
        <TabsContent value="payment">
          <PaymentTab project={p} contract={c} payment={payment} side={side} />
        </TabsContent>
        <TabsContent value="activity">
          <Activity projectId={p.id} />
        </TabsContent>
        <TabsContent value="review">
          <ReviewTab project={p} contract={c} side={side} />
        </TabsContent>
      </Tabs>
      <div className="mt-8">
        <ReportButton targetType="project" targetId={p.id} label="Report an issue" />
      </div>
    </>
  );
}

type P = NonNullable<ReturnType<typeof useProject>["data"]>;
type C = NonNullable<ReturnType<typeof useContractForProject>["data"]>;

function Overview({
  project,
  contract,
  side,
}: {
  project: P;
  contract: C;
  side: "brand" | "creative";
}) {
  const { run, isBusy } = useAction();
  const [revOpen, setRevOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const s = project.status;
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <SectionCard title="Agreed terms">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Price</dt>
            <dd className="font-display text-xl font-extrabold">
              {formatNaira(contract.agreed_price)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Deadline</dt>
            <dd className="font-bold">
              {contract.agreed_deadline
                ? new Date(contract.agreed_deadline).toLocaleDateString("en-NG", {
                    dateStyle: "medium",
                  })
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Awarded</dt>
            <dd className="font-bold">{timeAgo(contract.created_at)}</dd>
          </div>
        </dl>
        {contract.scope && (
          <>
            <h3 className="mt-5 text-sm font-bold">Scope</h3>
            <p className="mt-1 whitespace-pre-line text-sm">{contract.scope}</p>
          </>
        )}
        <Link
          to="/project/$id"
          params={{ id: project.id }}
          className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-ember hover:underline"
        >
          <ExternalLink className="h-3 w-3" /> Original brief
        </Link>
      </SectionCard>
      <SectionCard title="Next step">
        <div className="space-y-3 text-sm">
          {s === "hired" && side === "creative" && (
            <>
              <p>You've been awarded this project. Start work when you're ready.</p>
              <Button
                className="w-full"
                disabled={isBusy("start")}
                onClick={() =>
                  run(
                    "start",
                    () =>
                      supabase.rpc("set_project_status", {
                        p_project_id: project.id,
                        p_status: "in_progress",
                      }),
                    "Work started.",
                  )
                }
              >
                Start work
              </Button>
            </>
          )}
          {s === "hired" && side === "brand" && (
            <p>
              Waiting for {contract.creative?.name} to start work. You can message them in the
              Messages tab.
            </p>
          )}
          {(s === "in_progress" || s === "revision_requested") && side === "creative" && (
            <p>
              {s === "revision_requested"
                ? "The brand asked for changes. Check the feedback, then submit updated work in the Deliverables tab."
                : "Submit your work in the Deliverables tab when it's ready for review."}
            </p>
          )}
          {(s === "in_progress" || s === "revision_requested") && side === "brand" && (
            <p>
              {contract.creative?.name} is working on this. You'll be notified when work is
              submitted.
            </p>
          )}
          {s === "in_review" && side === "brand" && (
            <>
              <p>
                Work has been submitted. Review the Deliverables tab, then approve or ask for
                changes.
              </p>
              <Confirm
                title="Approve and complete this project?"
                description="This marks the project as completed and unlocks reviews for both of you."
                confirmLabel="Approve & complete"
                onConfirm={() =>
                  run(
                    "approve",
                    () => supabase.rpc("approve_project", { p_project_id: project.id }),
                    "Project completed.",
                  )
                }
              >
                <Button className="w-full" disabled={isBusy("approve")}>
                  Approve work
                </Button>
              </Confirm>
              <Button variant="outline" className="w-full" onClick={() => setRevOpen(true)}>
                Request a revision
              </Button>
            </>
          )}
          {s === "in_review" && side === "creative" && (
            <p>Submitted. Waiting for the brand to review your work.</p>
          )}
          {s === "completed" && (
            <p>
              This project is complete. Don't forget to leave a review and settle payment in the
              Payment tab.
            </p>
          )}
          {s === "hired" && (
            <Confirm
              title="Cancel this project?"
              description="Because work hasn't started, the award is cancelled and the other party is notified. After work starts, cancellations go through our support team."
              confirmLabel="Cancel project"
              destructive
              onConfirm={() =>
                run(
                  "cancel",
                  () =>
                    supabase.rpc("set_project_status", {
                      p_project_id: project.id,
                      p_status: "cancelled",
                    }),
                  "Project cancelled.",
                )
              }
            >
              <Button variant="ghost" className="w-full">
                Cancel project
              </Button>
            </Confirm>
          )}
          {["in_progress", "in_review", "revision_requested"].includes(s) && (
            <p className="text-xs text-muted-foreground">
              Need to cancel or dispute? Use "Report an issue" and the Sabi team will step in.
            </p>
          )}
        </div>
      </SectionCard>
      <Dialog open={revOpen} onOpenChange={setRevOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request a revision</DialogTitle>
            <DialogDescription>
              Tell {contract.creative?.name} exactly what to change.
            </DialogDescription>
          </DialogHeader>
          <Field label="Feedback" htmlFor="rev-fb">
            <Textarea
              id="rev-fb"
              value={feedback}
              maxLength={2000}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isBusy("rev") || feedback.trim().length < 3}
              onClick={async () => {
                if (
                  await run(
                    "rev",
                    () =>
                      supabase.rpc("request_revision", {
                        p_project_id: project.id,
                        p_feedback: feedback,
                      }),
                    "Revision requested.",
                  )
                ) {
                  setRevOpen(false);
                  setFeedback("");
                }
              }}
            >
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Deliverables({ project, side }: { project: P; side: "brand" | "creative" }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["deliverables", project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliverables")
        .select("*")
        .eq("project_id", project.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const canSubmit =
    side === "creative" && ["in_progress", "revision_requested"].includes(project.status);

  async function open(path: string) {
    try {
      window.open(await signedDeliverableUrl(path), "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(errMessage(e, "Could not open this file."));
    }
  }

  return (
    <div className="space-y-6">
      {canSubmit && <SubmitDeliverable projectId={project.id} />}
      {isLoading ? (
        <PageLoader />
      ) : error ? (
        <ErrorNote error={error} retry={() => refetch()} />
      ) : (data ?? []).length === 0 ? (
        <EmptyState
          title="Nothing submitted yet"
          description={
            side === "creative"
              ? "Start the project, then submit files or links here for review."
              : "Submitted work will appear here for your review."
          }
        />
      ) : (
        <div className="space-y-3">
          {data!.map((d) => (
            <Card key={d.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display font-bold">{d.title}</p>
                <Badge
                  tone={
                    d.status === "approved"
                      ? "green"
                      : d.status === "revision_requested"
                        ? "coral"
                        : "gold"
                  }
                >
                  {d.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{timeAgo(d.submitted_at)}</p>
              {d.note && <p className="mt-2 text-sm">{d.note}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {d.file_path && (
                  <Button size="sm" variant="outline" onClick={() => open(d.file_path!)}>
                    <FileDown className="h-3.5 w-3.5" /> {d.file_name ?? "Download file"}
                  </Button>
                )}
                {d.external_url && (
                  <Button asChild size="sm" variant="outline">
                    <a href={d.external_url} target="_blank" rel="noopener noreferrer nofollow">
                      <ExternalLink className="h-3.5 w-3.5" /> Open link
                    </a>
                  </Button>
                )}
              </div>
              {d.feedback && (
                <p className="mt-3 rounded-xl bg-coral/10 p-3 text-sm">
                  <span className="font-bold">Feedback: </span>
                  {d.feedback}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SubmitDeliverable({ projectId }: { projectId: string }) {
  const { run, isBusy } = useAction();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 2) return setError("Give this delivery a title.");
    if (!file && !url.trim()) return setError("Attach a file or add a link.");
    if (url.trim() && !/^https?:\/\//i.test(url.trim()))
      return setError("Links must start with https://");
    if (file) {
      const p = validateDeliverable(file);
      if (p) return setError(p);
    }
    setError(null);
    let uploaded: { path: string; name: string } | null = null;
    try {
      if (file) uploaded = await uploadDeliverableFile(projectId, file);
    } catch (err) {
      return setError(errMessage(err, "Upload failed."));
    }
    const ok = await run(
      "submit",
      () =>
        supabase.rpc("submit_deliverable", {
          p_project_id: projectId,
          p_title: title.trim(),
          p_note: note,
          p_file_path: uploaded?.path ?? null,
          p_file_name: uploaded?.name ?? null,
          p_url: url.trim() || null,
        } as never),
      "Submitted for review.",
    );
    if (ok) {
      setTitle("");
      setNote("");
      setUrl("");
      setFile(null);
    }
  }

  return (
    <SectionCard title="Submit work for review">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Title" htmlFor="dl-title">
          <Input
            id="dl-title"
            value={title}
            maxLength={140}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. First batch of reels"
          />
        </Field>
        <Field label="Note (optional)" htmlFor="dl-note">
          <Textarea
            id="dl-note"
            className="min-h-20"
            value={note}
            maxLength={2000}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Upload a file"
            htmlFor="dl-file"
            hint="Images, MP4/MOV, PDF, DOCX or ZIP up to 50 MB."
          >
            <input
              id="dl-file"
              type="file"
              className="block w-full text-sm"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          <Field label="…or share a link" htmlFor="dl-url">
            <Input
              id="dl-url"
              type="url"
              placeholder="https://drive.google.com/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </Field>
        </div>
        {error && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={isBusy("submit")}>
          {isBusy("submit") && <Loader2 className="h-4 w-4 animate-spin" />}Submit for review
        </Button>
      </form>
    </SectionCard>
  );
}

function Activity({ projectId }: { projectId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["events", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_events")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (isLoading) return <PageLoader />;
  if ((data ?? []).length === 0)
    return (
      <EmptyState
        title="No activity yet"
        description="Key changes will be recorded here with timestamps."
      />
    );
  return (
    <Card className="divide-y divide-border">
      {data!.map((e) => (
        <div key={e.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
          <span>{e.message}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {new Date(e.created_at).toLocaleString("en-NG", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </div>
      ))}
    </Card>
  );
}

function PaymentTab({
  project,
  contract,
  payment,
  side,
}: {
  project: P;
  contract: C;
  payment: NonNullable<C["payment"]>[number] | null;
  side: "brand" | "creative";
}) {
  const { run, isBusy } = useAction();
  const [ref, setRef] = useState("");
  const [note, setNote] = useState("");
  if (!payment)
    return (
      <EmptyState
        title="No payment record"
        description="A payment record is created when a creative is hired."
      />
    );
  return (
    <SectionCard title="Payment">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Agreed amount</p>
          <p className="font-display text-2xl font-extrabold">{formatNaira(payment.amount)}</p>
        </div>
        <StatusBadge kind="payment" status={payment.status} />
      </div>
      <p className="mt-3 rounded-xl bg-gold-soft/50 p-3 text-xs text-muted-foreground">
        Pilot payments are arranged directly between you and the other party (for example by bank
        transfer). Sabi records the payment so you both have a receipt, but it does not hold funds
        or provide escrow or payment protection.
      </p>
      {payment.provider_reference && (
        <p className="mt-3 text-sm">
          <span className="font-semibold">Reference: </span>
          {payment.provider_reference}
          {payment.note ? ` — ${payment.note}` : ""}
        </p>
      )}
      {payment.reported_at && (
        <p className="text-xs text-muted-foreground">
          Reported {timeAgo(payment.reported_at)}
          {payment.confirmed_at ? ` · confirmed ${timeAgo(payment.confirmed_at)}` : ""}
        </p>
      )}
      {side === "brand" &&
        ["pending", "failed"].includes(payment.status) &&
        !["cancelled"].includes(project.status) && (
          <form
            className="mt-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run(
                  "pay",
                  () =>
                    supabase.rpc("report_payment", {
                      p_project_id: project.id,
                      p_reference: ref,
                      p_note: note,
                    }),
                  "Payment recorded. The creative will be asked to confirm.",
                )
              ) {
                setRef("");
                setNote("");
              }
            }}
          >
            <Field label="Transfer reference or receipt number" htmlFor="pay-ref">
              <Input
                id="pay-ref"
                value={ref}
                maxLength={120}
                onChange={(e) => setRef(e.target.value)}
              />
            </Field>
            <Field label="Note (optional)" htmlFor="pay-note">
              <Input
                id="pay-note"
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Bank transfer, 31 Oct"
              />
            </Field>
            <Button type="submit" disabled={isBusy("pay") || ref.trim().length < 3}>
              I've paid — record it
            </Button>
          </form>
        )}
      {side === "creative" && payment.status === "reported" && (
        <Confirm
          title="Confirm you received this payment?"
          description={`Only confirm if ${formatNaira(payment.amount)} has actually reached you.`}
          confirmLabel="Yes, I received it"
          onConfirm={() =>
            run(
              "confirm",
              () => supabase.rpc("confirm_payment", { p_project_id: project.id }),
              "Payment confirmed.",
            )
          }
        >
          <Button className="mt-4" disabled={isBusy("confirm")}>
            Confirm payment received
          </Button>
        </Confirm>
      )}
      {side === "creative" && payment.status === "pending" && (
        <p className="mt-3 text-sm text-muted-foreground">
          The brand hasn't recorded a payment yet.
        </p>
      )}
      {side === "brand" && payment.status === "reported" && (
        <p className="mt-3 text-sm text-muted-foreground">
          Waiting for {contract.creative?.name} to confirm receipt.
        </p>
      )}
    </SectionCard>
  );
}

function ReviewTab({
  project,
  contract,
  side,
}: {
  project: P;
  contract: C;
  side: "brand" | "creative";
}) {
  const { run, isBusy } = useAction();
  const myWs = side === "brand" ? contract.brand_workspace_id : contract.creative_workspace_id;
  const { data: mine, isLoading } = useQuery({
    queryKey: ["my-review", project.id, myWs],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("project_id", project.id)
        .eq("reviewer_workspace_id", myWs)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const [r, setR] = useState({
    rating: 0,
    communication: 0,
    quality: 0,
    reliability: 0,
    comment: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  if (project.status !== "completed")
    return (
      <EmptyState
        title="Reviews open after completion"
        description="Once the brand approves the work and the project is completed, you can both leave a review."
      />
    );
  if (isLoading) return <PageLoader />;
  const other = side === "brand" ? contract.creative?.name : contract.brand?.name;
  if (mine)
    return (
      <SectionCard title="Your review">
        <p className="flex items-center gap-1 font-bold">
          <Star className="h-4 w-4 fill-gold text-gold" /> {mine.rating}/5
        </p>
        {mine.comment && <p className="mt-2 text-sm">{mine.comment}</p>}
        <p className="mt-2 text-xs text-muted-foreground">
          Thanks! Your review of {other} is published on their profile.
        </p>
      </SectionCard>
    );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = reviewSchema.safeParse({
      rating: r.rating,
      communication: r.communication || null,
      quality: r.quality || null,
      reliability: r.reliability || null,
      comment: r.comment || null,
    });
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    setErrors({});
    const v = parsed.data;
    await run(
      "review",
      () =>
        supabase.rpc("submit_review", {
          p_project_id: project.id,
          p_rating: v.rating,
          p_communication: v.communication ?? undefined,
          p_quality: v.quality ?? undefined,
          p_reliability: v.reliability ?? undefined,
          p_comment: v.comment ?? undefined,
        } as never),
      "Review published.",
    );
  }
  const Stars = ({
    k,
    label,
  }: {
    k: "rating" | "communication" | "quality" | "reliability";
    label: string;
  }) => (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={r[k] === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setR({ ...r, [k]: n })}
          >
            <Star className={cn("h-6 w-6", n <= r[k] ? "fill-gold text-gold" : "text-border")} />
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <SectionCard title={`Review ${other}`}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Stars k="rating" label="Overall" />
        {errors["rating"] && (
          <p role="alert" className="text-xs font-semibold text-destructive">
            {errors["rating"]}
          </p>
        )}
        <Stars k="communication" label="Communication" />
        <Stars k="quality" label={side === "brand" ? "Quality of work" : "Clarity of brief"} />
        <Stars k="reliability" label="Reliability" />
        <Field label="Written feedback (optional)" htmlFor="rv-comment">
          <Textarea
            id="rv-comment"
            value={r.comment}
            maxLength={2000}
            onChange={(e) => setR({ ...r, comment: e.target.value })}
          />
        </Field>
        <Button type="submit" disabled={isBusy("review")}>
          Publish review
        </Button>
      </form>
    </SectionCard>
  );
}
