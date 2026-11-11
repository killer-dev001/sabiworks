import { describe, expect, it } from "vitest";
import {
  fieldErrors,
  projectSchema,
  proposalSchema,
  reviewSchema,
  slugify,
  workspaceSchema,
} from "@/lib/validation";
import { errMessage } from "@/lib/errors";
import { budgetLabel, formatNaira } from "@/lib/format";

const future = (days: number) =>
  new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const validProject = {
  title: "Instagram posts for a restaurant",
  category: "Social Media",
  description: "Twelve posts including four short videos and captions.",
  deliverables: ["8 static posts", "4 reels"],
  budget_type: "range" as const,
  budget_min: 100000,
  budget_max: 150000,
  deadline: future(14),
  proposal_deadline: future(7),
  location: "Lagos",
  is_remote: false,
  skills: [],
  preferred_experience: null,
};

describe("projectSchema", () => {
  it("accepts a complete brief", () => {
    expect(projectSchema.safeParse(validProject).success).toBe(true);
  });
  it("requires at least one deliverable and a real description", () => {
    const r = projectSchema.safeParse({ ...validProject, deliverables: [], description: "short" });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(Object.keys(fieldErrors(r.error))).toEqual(
        expect.arrayContaining(["deliverables", "description"]),
      );
  });
  it("rejects a range whose maximum is below its minimum", () => {
    const r = projectSchema.safeParse({ ...validProject, budget_min: 200000, budget_max: 100000 });
    expect(r.success).toBe(false);
  });
  it("rejects a deadline in the past and proposals closing after the deadline", () => {
    expect(projectSchema.safeParse({ ...validProject, deadline: future(-2) }).success).toBe(false);
    expect(
      projectSchema.safeParse({ ...validProject, proposal_deadline: future(20) }).success,
    ).toBe(false);
  });
});

describe("proposalSchema", () => {
  const ok = {
    price: 90000,
    delivery_time: "Within 1 week",
    cover_message: "I love this brief and have done similar work.",
    approach: "Plan, shoot, edit and deliver in two rounds.",
    milestones: null,
    portfolio_links: ["https://example.com/work"],
  };
  it("accepts a good proposal", () => expect(proposalSchema.safeParse(ok).success).toBe(true));
  it("rejects zero price, missing delivery time and non-http links", () => {
    expect(proposalSchema.safeParse({ ...ok, price: 0 }).success).toBe(false);
    expect(proposalSchema.safeParse({ ...ok, delivery_time: "" }).success).toBe(false);
    expect(
      proposalSchema.safeParse({ ...ok, portfolio_links: ["javascript:alert(1)"] }).success,
    ).toBe(false);
  });
});

describe("other schemas and helpers", () => {
  it("validates reviews between 1 and 5", () => {
    expect(
      reviewSchema.safeParse({
        rating: 5,
        communication: null,
        quality: null,
        reliability: null,
        comment: null,
      }).success,
    ).toBe(true);
    expect(
      reviewSchema.safeParse({
        rating: 0,
        communication: null,
        quality: null,
        reliability: null,
        comment: null,
      }).success,
    ).toBe(false);
  });
  it("rejects workspaces with a one-character name or a non-https website", () => {
    const base = {
      name: "Ab",
      tagline: null,
      description: null,
      industry: null,
      location: null,
      website_url: null,
      skills: [],
      services: [],
      starting_price: null,
      availability: "Available now",
    };
    expect(workspaceSchema.safeParse(base).success).toBe(true);
    expect(workspaceSchema.safeParse({ ...base, name: "A" }).success).toBe(false);
    expect(workspaceSchema.safeParse({ ...base, website_url: "ftp://x" }).success).toBe(false);
  });
  it("creates URL-safe, unique-looking slugs that satisfy the database format", () => {
    const s = slugify("Ayo Studio & Co. — Lagos!");
    expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(slugify("Ayo Studio")).not.toBe(slugify("Ayo Studio"));
  });
  it("turns database errors into readable messages", () => {
    expect(errMessage({ code: "23505", message: "dup" })).toMatch(/already/);
    expect(errMessage({ code: "42501", message: "x" })).toMatch(/permission/);
    expect(errMessage({ message: "You have already reviewed this project." })).toBe(
      "You have already reviewed this project.",
    );
  });
  it("formats money in naira", () => {
    expect(formatNaira(100000)).toContain("100,000");
    expect(budgetLabel("range", 80000, 120000)).toContain("–");
  });
});
