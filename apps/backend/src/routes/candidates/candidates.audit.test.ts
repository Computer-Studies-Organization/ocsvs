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
}));

const { mockListByTarget } = vi.hoisted(() => ({ mockListByTarget: vi.fn() }));

vi.mock("@/database/repositories/audit-log.repository", () => ({
  auditLogRepo: { insert: vi.fn(), list: vi.fn(), listByTarget: mockListByTarget },
}));

vi.mock("@/config/db", () => ({ createDb: vi.fn(() => ({ db: {} })) }));

const candidateId = "33333333-3333-4333-8333-333333333333";

describe("candidates audit route", () => {
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

  it("returns 401 when not authenticated", async () => {
    AUTH_ENABLED = false;
    const res = await router.request(`/candidates/${candidateId}/audit`, {
      method: "GET",
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when caller is not admin (handler guard)", async () => {
    TEST_USER = { ...TEST_USER, role: "user" };
    const res = await router.request(`/candidates/${candidateId}/audit`, {
      method: "GET",
    });
    expect(res.status).toBe(403);
    expect(mockListByTarget).not.toHaveBeenCalled();
  });

  it("returns 200 with the items for an admin", async () => {
    const items = [
      {
        id: "audit-c1",
        createdAt: 300,
        action: "candidate.create",
        targetType: "candidate",
        targetId: candidateId,
        actorAccountIdSnapshot: "acc-1",
        actorUsernameSnapshot: "alice",
        description: null,
      },
    ];
    mockListByTarget.mockResolvedValue(items);
    const res = await router.request(`/candidates/${candidateId}/audit`, {
      method: "GET",
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.items).toEqual(items);
  });

  it("calls listByTarget with (candidate, id)", async () => {
    mockListByTarget.mockResolvedValue([]);
    await router.request(`/candidates/${candidateId}/audit`, { method: "GET" });
    expect(mockListByTarget).toHaveBeenCalledWith(expect.anything(), "candidate", candidateId);
  });
});
