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
    if (!AUTH_ENABLED || TEST_USER.role !== "admin") {
      return c.json({ message: "Forbidden" }, 403);
    }
    await next();
  },
  withAdmin: (handler: any) => async (c: any, next: any) => {
    if (!AUTH_ENABLED || (TEST_USER.role !== "admin" && TEST_USER.role !== "super_admin")) {
      return c.json({ message: "Forbidden" }, 403);
    }
    return handler(c, next);
  },
}));

const { mockListByTarget } = vi.hoisted(() => ({ mockListByTarget: vi.fn() }));

vi.mock("@/database/repositories/audit-log.repository", () => ({
  auditLogRepo: { insert: vi.fn(), list: vi.fn(), listByTarget: mockListByTarget },
}));

vi.mock("@/config/db", () => ({ createDb: vi.fn(() => ({ db: {} })) }));

const electionId = "11111111-1111-4111-8111-111111111111";
const positionId = "22222222-2222-4222-8222-222222222222";

describe("elections audit routes", () => {
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
  });

  describe("gET /elections/:id/audit", () => {
    it("returns 401 when not authenticated", async () => {
      AUTH_ENABLED = false;
      const res = await router.request(`/elections/${electionId}/audit`, {
        method: "GET",
      });
      expect(res.status).toBe(401);
    });

    it("returns 403 when caller is not admin (handler guard)", async () => {
      TEST_USER = { ...TEST_USER, role: "user" };
      const res = await router.request(`/elections/${electionId}/audit`, {
        method: "GET",
      });
      expect(res.status).toBe(403);
      expect(mockListByTarget).not.toHaveBeenCalled();
    });

    it("returns 200 with the items for an admin", async () => {
      const items = [
        {
          id: "audit-1",
          createdAt: 200,
          action: "election.create",
          targetType: "election",
          targetId: electionId,
          actorAccountIdSnapshot: "acc-1",
          actorUsernameSnapshot: "alice",
          description: null,
        },
      ];
      mockListByTarget.mockResolvedValue(items);
      const res = await router.request(`/elections/${electionId}/audit`, {
        method: "GET",
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.items).toEqual(items);
    });

    it("calls listByTarget with (election, id)", async () => {
      mockListByTarget.mockResolvedValue([]);
      await router.request(`/elections/${electionId}/audit`, { method: "GET" });
      expect(mockListByTarget).toHaveBeenCalledWith(expect.anything(), "election", electionId);
    });
  });

  describe("gET /elections/:id/positions/:positionId/audit", () => {
    const path = `/elections/${electionId}/positions/${positionId}/audit`;

    it("returns 401 when not authenticated", async () => {
      AUTH_ENABLED = false;
      const res = await router.request(path, { method: "GET" });
      expect(res.status).toBe(401);
    });

    it("returns 403 when caller is not admin (handler guard)", async () => {
      TEST_USER = { ...TEST_USER, role: "user" };
      const res = await router.request(path, { method: "GET" });
      expect(res.status).toBe(403);
      expect(mockListByTarget).not.toHaveBeenCalled();
    });

    it("returns 200 with the items for an admin", async () => {
      const items = [
        {
          id: "audit-2",
          createdAt: 100,
          action: "position.create",
          targetType: "position",
          targetId: positionId,
          actorAccountIdSnapshot: "acc-1",
          actorUsernameSnapshot: "alice",
          description: null,
        },
      ];
      mockListByTarget.mockResolvedValue(items);
      const res = await router.request(path, { method: "GET" });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.items).toEqual(items);
    });

    it("calls listByTarget with (position, positionId) — uses positionId, not election id", async () => {
      mockListByTarget.mockResolvedValue([]);
      await router.request(path, { method: "GET" });
      expect(mockListByTarget).toHaveBeenCalledWith(expect.anything(), "position", positionId);
    });
  });
});
