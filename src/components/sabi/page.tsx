import { useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, Input } from "@/components/sabi/primitives";
import { BellButton, useWorkspaceContext } from "@/components/sabi/app-shell";
import { EmptyState } from "@/components/sabi/cards";
import { PROJECT_STATUS_LABELS, PROPOSAL_STATUS_LABELS } from "@/lib/format";
import { errMessage } from "@/lib/errors";
import { uploadWorkspaceImage } from "@/lib/storage";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Workspace } from "@/lib/sabi";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        <BellButton />
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-soft text-secondary-foreground">
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="mt-2 font-display text-2xl font-extrabold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Awaiting payment",
  reported: "Payment reported",
  confirmed: "Payment confirmed",
  failed: "Payment failed",
  refunded: "Refunded",
};

export function StatusBadge({
  status,
  kind = "project",
}: {
  status: string;
  kind?: "project" | "proposal" | "payment";
}) {
  const label =
    kind === "project"
      ? (PROJECT_STATUS_LABELS[status] ?? status.replace(/_/g, " "))
      : kind === "proposal"
        ? (PROPOSAL_STATUS_LABELS[status] ?? status)
        : (PAYMENT_LABELS[status] ?? status);
  const tone: "green" | "orange" | "gold" | "coral" | "muted" = [
    "published",
    "accepted",
    "completed",
    "confirmed",
  ].includes(status)
    ? "green"
    : ["shortlisted", "in_discussion", "reported", "in_review"].includes(status)
      ? "gold"
      : ["hired", "in_progress", "revision_requested", "submitted", "pending"].includes(status)
        ? "orange"
        : ["declined", "cancelled", "failed", "refunded", "withdrawn"].includes(status)
          ? "coral"
          : "muted";
  return <Badge tone={tone}>{label}</Badge>;
}

export function Avatar({
  src,
  name,
  className,
}: {
  src?: string | null;
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-forest-soft text-sm font-bold text-secondary-foreground",
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-lg font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </Card>
  );
}

/** Free-text tags (skills, services, deliverables). Enter or comma adds one. */
export function TagInput({
  value,
  onChange,
  placeholder,
  max = 20,
  id,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  max?: number;
  id?: string;
}) {
  const [draft, setDraft] = useState("");
  function commit() {
    const t = draft.trim().replace(/,$/, "").trim();
    if (!t) return;
    if (value.length >= max) {
      toast.error(`You can add up to ${max}.`);
      return;
    }
    if (!value.some((v) => v.toLowerCase() === t.toLowerCase()))
      onChange([...value, t.slice(0, 200)]);
    setDraft("");
  }
  return (
    <div>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-forest-soft px-3 py-1 text-xs font-semibold text-secondary-foreground"
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                aria-label={`Remove ${v}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit();
            }
          }}
          onBlur={commit}
        />
        <Button type="button" variant="soft" onClick={commit}>
          Add
        </Button>
      </div>
    </div>
  );
}

export function ImageUpload({
  value,
  onChange,
  workspaceId,
  folder,
  label,
  shape = "square",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  workspaceId: string;
  folder: string;
  label: string;
  shape?: "square" | "wide" | "round";
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await uploadWorkspaceImage(workspaceId, folder, file));
    } catch (e) {
      toast.error(errMessage(e, "Upload failed."));
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden border border-dashed border-border bg-muted text-muted-foreground",
          shape === "round"
            ? "h-20 w-20 rounded-full"
            : shape === "wide"
              ? "h-20 w-36 rounded-2xl"
              : "h-20 w-20 rounded-2xl",
        )}
      >
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImagePlus className="h-6 w-6" />
        )}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">{label}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => ref.current?.click()}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {value ? "Replace" : "Upload"}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP or GIF up to 5 MB.</p>
        <input
          ref={ref}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

/** Wraps any trigger in a confirmation dialog. */
export function Confirm({
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  children,
  destructive,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  children: ReactNode;
  destructive?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Shows a friendly notice when a page needs the other workspace type. */
export function RequireWorkspaceType({
  type,
  children,
}: {
  type: "brand" | "creative";
  children: ReactNode;
}) {
  const ws: Workspace = useWorkspaceContext();
  if (ws.type === type) return <>{children}</>;
  return (
    <EmptyState
      title={
        type === "brand"
          ? "This page is for brand workspaces"
          : "This page is for creative workspaces"
      }
      description={`You're in your ${ws.type} workspace. Use "Switch Workspace" in the sidebar to open a ${type} workspace, or create one.`}
      action={
        <Button asChild variant="outline">
          <Link to="/workspace">Create a {type} workspace</Link>
        </Button>
      }
    />
  );
}

export function ErrorNote({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <EmptyState
      title="We couldn't load this"
      description={errMessage(error, "Please check your connection and try again.")}
      action={
        retry ? (
          <Button variant="outline" onClick={retry}>
            Try again
          </Button>
        ) : undefined
      }
    />
  );
}
