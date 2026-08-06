import { beforeEach, describe, expect, it, vi } from "vitest";
import candidates from "./candidates";
import users from "./users";
import votes from "./votes";

const { authState, authCalls, adminCalls } = vi.hoisted(() => ({
  authState: { mode: "unauthenticated" as "unauthenticated" | "non-admin" },
  authCalls: vi.fn(),
  adminCalls: vi.fn(),
}));

vi.mock("@/middleware/auth", () => ({
  requireAuth: async (c: any, next: any) => {
    authCalls();
    if (authState.mode === "unauthenticated") {
      return c.json({ message: "Unauthorized" }, 401);
    }

    c.set("authUser", {
      id: "test-user-id",
      email: "test@example.com",
      username: "testuser",
      role: "user",
    });
    await next();
  },
  requireAdmin: async (c: any, next: any) => {
    adminCalls();
    if (c.get("authUser")?.role !== "admin") {
      return c.json({ message: "Forbidden" }, 403);
    }
    await next();
  },
  withAdmin: (handler: any) => async (c: any, next: any) => {
    if (c.get("authUser")?.role !== "admin") {
      return c.json({ message: "Forbidden" }, 403);
    }
    return handler(c, next);
  },
}));

type RouterWithRoutes = {
  routes: Array<{ method: string; path: string }>;
};

type RouterWithRequest = {
  request(path: string, init?: RequestInit): Promise<Response>;
};

function middlewareCount(router: RouterWithRoutes, path: string): number {
  return router.routes.filter((route) => route.method === "ALL" && route.path === path).length;
}

describe("resource middleware scope", () => {
  beforeEach(() => {
    authState.mode = "unauthenticated";
    authCalls.mockClear();
    adminCalls.mockClear();
  });

  it("uses wildcard middleware without duplicate exact-path registrations", () => {
    expect(middlewareCount(users, "/users")).toBe(0);
    expect(middlewareCount(users, "/users/*")).toBe(2);

    expect(middlewareCount(candidates, "/candidates")).toBe(0);
    expect(middlewareCount(candidates, "/candidates/*")).toBe(1);

    expect(middlewareCount(votes, "/votes")).toBe(0);
    expect(middlewareCount(votes, "/votes/*")).toBe(1);
  });

  it("executes authentication middleware on exact resource paths", async () => {
    const requests: Array<[RouterWithRequest, string, RequestInit?]> = [
      [candidates as RouterWithRequest, "/candidates"],
      [users as RouterWithRequest, "/users"],
      [
        votes as RouterWithRequest,
        "/votes",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ electionId: "election-id", votes: [] }),
        },
      ],
    ];

    for (const [router, path, init] of requests) {
      const response = await router.request(path, init);

      expect(response.status).toBe(401);
      expect(authCalls).toHaveBeenCalledTimes(1);
      authCalls.mockClear();
    }
  });

  it("executes the admin middleware on the exact users path", async () => {
    authState.mode = "non-admin";

    const response = await (users as RouterWithRequest).request("/users");

    expect(response.status).toBe(403);
    expect(authCalls).toHaveBeenCalledTimes(1);
    expect(adminCalls).toHaveBeenCalledTimes(1);
  });
});
