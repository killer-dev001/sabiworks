import { formatDistanceToNow, differenceInDays } from "date-fns";

export function formatNaira(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function budgetLabel(
  type: string | null,
  min: number | null | undefined,
  max: number | null | undefined,
): string {
  if (type === "fixed") return formatNaira(min ?? max);
  if (min != null && max != null) return `${formatNaira(min)} – ${formatNaira(max)}`;
  return formatNaira(min ?? max);
}

export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return "";
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
}

export function daysUntil(date: string | null | undefined): string {
  if (!date) return "";
  try {
    const days = differenceInDays(new Date(date), new Date());
    if (days <= 0) return "Closing soon";
    if (days === 1) return "1 day left";
    return `${days} days left`;
  } catch {
    return "";
  }
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Open",
  in_discussion: "In discussion",
  hired: "Hired",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  shortlisted: "Shortlisted",
  accepted: "Accepted",
  declined: "Declined",
  withdrawn: "Withdrawn",
};
