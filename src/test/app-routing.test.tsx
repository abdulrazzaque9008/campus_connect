import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it.each([
    ["/events", "/events/"],
    ["/events/6f1c1a4e-8a51-4c41-9f5a-6d1f2c3b4a5e", "/events/$eventId"],
    ["/pass/abc", "/pass/$token"],
    ["/verify/abc", "/verify/$token"],
    ["/my-passes", "/my-passes"],
    ["/admin", "/_authenticated/admin/"],
    ["/admin/events/new", "/_authenticated/admin/events/new"],
    ["/admin/events/6f1c1a4e-8a51-4c41-9f5a-6d1f2c3b4a5e/edit", "/_authenticated/admin/events/$eventId/edit"],
    [
      "/admin/events/6f1c1a4e-8a51-4c41-9f5a-6d1f2c3b4a5e/registrations",
      "/_authenticated/admin/events/$eventId/registrations",
    ],
    ["/admin/verify", "/_authenticated/admin/verify"],
    ["/admin/team", "/_authenticated/admin/team"],
  ])("matches %s", (path, routeId) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(routeId);
  });

  it("keeps the verification page outside the sign-in gate", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const ids = router.matchRoutes("/verify/abc").map((m) => m.routeId);
    expect(ids).not.toContain("/_authenticated");
  });
});
