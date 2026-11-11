import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
const makeRouter = () => createRouter({ routeTree, context: { queryClient: new QueryClient() } });
const uuid = "11111111-1111-4111-8111-111111111111";

describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const matches = makeRouter().matchRoutes("/");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  // Every link in the navigation, cards and dashboards must land on a real page.
  const paths = [
    "/auth",
    "/reset-password",
    "/workspace",
    "/brands",
    "/creatives",
    "/projects",
    `/project/${uuid}`,
    "/brand/the-sunday-table",
    "/creative/tunde-adebayo",
    "/dashboard",
    "/post-project",
    "/profile",
    "/my-brand",
    "/available-projects",
    "/my-proposals",
    "/posted-projects",
    "/proposals-received",
    "/hired-creatives",
    "/messages",
    "/earnings",
    "/payments",
    "/settings",
    "/admin",
    `/work/${uuid}`,
  ];
  it.each(paths)("has a route for %s", (path) => {
    const matches = makeRouter().matchRoutes(path);
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("falls back to not found for unknown pages", () => {
    expect(makeRouter().matchRoutes("/definitely-not-a-page").at(-1)?.routeId).toBe(rootRouteId);
  });
});
