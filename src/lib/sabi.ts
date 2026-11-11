import type { Database } from "@/integrations/supabase/types";

export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type Proposal = Database["public"]["Tables"]["proposals"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type SavedProject = Database["public"]["Tables"]["saved_projects"]["Row"];

export const CATEGORIES = [
  { name: "Design", icon: "pen-tool" },
  { name: "Photography", icon: "camera" },
  { name: "Video", icon: "video" },
  { name: "Social Media", icon: "megaphone" },
  { name: "Writing", icon: "pen-line" },
  { name: "Other", icon: "sparkles" },
] as const;

export const INDUSTRIES = [
  "Food & Hospitality",
  "Fashion & Lifestyle",
  "Education",
  "Real Estate",
  "Tech & Startups",
  "Media & Entertainment",
  "Health & Wellness",
  "Retail & E-commerce",
  "Other",
];

export const LOCATIONS = ["Lagos", "Abuja", "Port Harcourt", "Ibadan", "Kano", "Enugu", "Remote"];

export const SERVICES = [
  "Logo & identity design",
  "Content calendars",
  "Event photography",
  "Monthly social management",
  "Video production",
  "Brand shoots",
  "Copywriting",
  "Web design",
];

export const DELIVERY_TIMES = [
  "Within 3 days",
  "Within 1 week",
  "Within 2 weeks",
  "Within 3 weeks",
  "Within 1 month",
  "Flexible",
];

export const ACTIVE_WORKSPACE_KEY = "sabi.activeWorkspaceId";

export function isActiveDemo(row: { is_demo: boolean | null } | null | undefined): boolean {
  return row?.is_demo === true;
}
