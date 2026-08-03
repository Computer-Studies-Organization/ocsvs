import { beforeEach, describe, expect, it, vi } from "vitest";
import router from "./index";

let TEST_USER = {
  id: "test-user-id",
  email: "t@e.com",
  username: "tuser",
  role: "user",
};
let AUTH_ENABLED = true;

vi.mock("@/middleware/auth", () => ({
  requireAuth: async (c: any, next: any) => {
    if (!AUTH_ENABLED) return c.json({ message: "Unauthorized" }, 401);
    c.set("authUser", { ...TEST_USER });
    await next();
  },
  requireAdmin: async (c: any, next: any) => {
    // Mirror the real middleware: requireAuth must run first; requireAdmin
    // checks the authUser set by requireAuth. Here we re-check role.
    if (!AUTH_ENABLED) return c.json({ message: "Unauthorized" }, 401);
    if (TEST_USER.role !== "admin") {
      return c.json({ message: "Forbidden" }, 403);
    }
    await next();
  },
}));

const { mockListByTarget, mockGetAccountId } = vi.hoisted(() => ({
  mockListByTarget: vi.fn(),
  mockGetAccountId: vi.fn(),
}));

vi.mock("@/database/repositories/audit-log.repository", () => ({
  auditLogRepo: { insert: vi.fn(), list: vi.fn(), listByTarget: mockListByTarget },
}));

vi.mock("@/database/repositories/voter-account-store", () => ({
  voterAccountStore: { getAccountId: mockGetAccountId },
}));

vi.mock("@/config/db", () => ({ createDb: vi.fn(() => ({ db: {} })) }));

const userId = "44444444-4444-4444-8444-444444444444";

describe("users audit route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    TEST_USER = {
      id: "test-user-id",
      email: "t@e.com",
      username: "tuser",
      role: "admin",
    };
    AUTH_ENABLED = true;
    mockListByTarget.mockReset();
    mockGetAccountId.mockReset();
    mockGetAccountId.mockResolvedValue(null);
  });

  describe("middleware-layer guards (routes/users/index.ts wires requireAdmin)", () => {
    it("returns 401 when not authenticated", async () => {
      AUTH_ENABLED = false;
      const res = await router.request(`/users/${userId}/audit`, { method: "GET" });
      expect(res.status).toBe(401);
    });

    it("returns 403 at the middleware layer when caller is not admin", async () => {
      TEST_USER = { ...TEST_USER, role: "user" };
      const res = await router.request(`/users/${userId}/audit`, { method: "GET" });
      expect(res.status).toBe(403);
      expect(mockListByTarget).not.toHaveBeenCalled();
    });
  });

  describe("admin happy path", () => {
    it("returns 200 with the items", async () => {
      const items = [
        {
          id: "audit-u1",
          createdAt: 400,
          action: "user.update",
          targetType: "user",
          targetId: userId,
          actorAccountIdSnapshot: "acc-1",
          actorUsernameSnapshot: "alice",
          description: null,
        },
      ];
      mockListByTarget.mockResolvedValue(items);
      const res = await router.request(`/users/${userId}/audit`, { method: "GET" });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.items).toEqual(items);
    });

    it("calls listByTarget with (user, id)", async () => {
      mockListByTarget.mockResolvedValue([]);
      await router.request(`/users/${userId}/audit`, { method: "GET" });
      expect(mockListByTarget).toHaveBeenCalledWith(expect.anything(), "user", userId);
    });

    it("includes legacy account-keyed entries while migration is pending", async () => {
      mockGetAccountId.mockResolvedValue({ accountId: "account-id" });
      mockListByTarget.mockImplementation((_db, _targetType, targetId) =>
        Promise.resolve(
          targetId === userId
            ? [{ id: "current", createdAt: 200, targetId: userId }]
            : [{ id: "legacy", createdAt: 100, targetId: "account-id" }],
        ),
      );

      const res = await router.request(`/users/${userId}/audit`, { method: "GET" });
      const json = (await res.json()) as any;

      expect(json.items.map((item: { id: string }) => item.id)).toEqual(["current", "legacy"]);
      expect(mockListByTarget).toHaveBeenNthCalledWith(2, expect.anything(), "user", "account-id");
    });
  });
});
