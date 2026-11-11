import { z } from "zod";
import { CATEGORIES } from "@/lib/sabi";

const categoryNames = CATEGORIES.map((c) => c.name) as [string, ...string[]];
const today = () => new Date(new Date().setHours(0, 0, 0, 0));
const httpUrl = z
  .string()
  .trim()
  .url("Enter a full link starting with https://")
  .refine((v) => /^https?:\/\//i.test(v), "Links must start with http:// or https://");

export const projectSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Give the project a title (3+ characters).")
      .max(140, "Keep the title under 140 characters."),
    category: z.enum(categoryNames, { errorMap: () => ({ message: "Choose a category." }) }),
    description: z
      .string()
      .trim()
      .min(20, "Describe the work in at least 20 characters.")
      .max(6000),
    deliverables: z
      .array(z.string().trim().min(1).max(200))
      .min(1, "Add at least one deliverable.")
      .max(25, "No more than 25 deliverables."),
    budget_type: z.enum(["fixed", "range"]),
    budget_min: z
      .number({ invalid_type_error: "Enter a budget." })
      .positive("Budget must be above zero.")
      .max(1_000_000_000),
    budget_max: z.number().positive().max(1_000_000_000).nullable(),
    deadline: z
      .string()
      .min(1, "Choose a deadline.")
      .refine((v) => new Date(v) >= today(), "The deadline can't be in the past."),
    proposal_deadline: z
      .string()
      .nullable()
      .refine((v) => !v || new Date(v) >= today(), "The proposal deadline can't be in the past."),
    location: z.string().trim().max(80).nullable(),
    is_remote: z.boolean(),
    skills: z.array(z.string().trim().min(1).max(40)).max(15),
    preferred_experience: z.string().trim().max(500).nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.budget_type === "range") {
      if (v.budget_max == null)
        ctx.addIssue({
          code: "custom",
          path: ["budget_max"],
          message: "Enter the top of your range.",
        });
      else if (v.budget_max < v.budget_min)
        ctx.addIssue({
          code: "custom",
          path: ["budget_max"],
          message: "Maximum must be at least the minimum.",
        });
    }
    if (v.proposal_deadline && v.deadline && new Date(v.proposal_deadline) > new Date(v.deadline)) {
      ctx.addIssue({
        code: "custom",
        path: ["proposal_deadline"],
        message: "Proposals must close on or before the project deadline.",
      });
    }
  });
export type ProjectInput = z.infer<typeof projectSchema>;

export const proposalSchema = z.object({
  price: z
    .number({ invalid_type_error: "Enter your price." })
    .positive("Price must be above zero.")
    .max(1_000_000_000),
  delivery_time: z.string().min(1, "Choose a delivery time."),
  cover_message: z
    .string()
    .trim()
    .min(20, "Introduce yourself in at least 20 characters.")
    .max(3000),
  approach: z
    .string()
    .trim()
    .min(20, "Describe your approach in at least 20 characters.")
    .max(5000),
  milestones: z.string().trim().max(3000).nullable(),
  portfolio_links: z.array(httpUrl).max(6, "Add up to 6 portfolio links."),
});
export type ProposalInput = z.infer<typeof proposalSchema>;

export const workspaceSchema = z.object({
  name: z.string().trim().min(2, "Enter a name (2+ characters).").max(80),
  tagline: z.string().trim().max(200).nullable(),
  description: z.string().trim().max(3000).nullable(),
  industry: z.string().trim().max(60).nullable(),
  location: z.string().trim().max(60).nullable(),
  website_url: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .refine((v) => !v || /^https?:\/\//i.test(v), "Website must start with https://"),
  skills: z.array(z.string().trim().min(1).max(40)).max(20),
  services: z.array(z.string().trim().min(1).max(60)).max(20),
  starting_price: z.number().min(0).max(1_000_000_000).nullable(),
  availability: z.string().trim().max(60),
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Choose an overall rating.").max(5),
  communication: z.number().int().min(1).max(5).nullable(),
  quality: z.number().int().min(1).max(5).nullable(),
  reliability: z.number().int().min(1).max(5).nullable(),
  comment: z.string().trim().max(2000).nullable(),
});

export const portfolioSchema = z
  .object({
    title: z.string().trim().min(2, "Give it a title.").max(120),
    description: z.string().trim().max(1000).nullable(),
    external_url: z.string().trim().nullable(),
    media_url: z.string().nullable(),
  })
  .superRefine((v, ctx) => {
    if (!v.media_url && !v.external_url)
      ctx.addIssue({
        code: "custom",
        path: ["external_url"],
        message: "Upload an image or add a link.",
      });
    if (v.external_url && !/^https?:\/\//i.test(v.external_url))
      ctx.addIssue({
        code: "custom",
        path: ["external_url"],
        message: "Link must start with https://",
      });
  });

/** Collects zod issues into { field: message } for inline form errors. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "workspace"}-${Math.random().toString(36).slice(2, 6)}`;
}
