import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import router from "./index";
import { createTestApp } from "@/lib/create-app";

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

const { mockList } = vi.hoisted(() => ({ mockList: vi.fn() }));

vi.mock("@/database/repositories/audit-log.repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/database/repositories/audit-log.repository")
  >("@/database/repositories/audit-log.repository");
  return {
    ...actual,
    auditLogRepo: { insert: vi.fn(), list: mockList, listByTarget: vi.fn() },
  };
});

vi.mock("@/config/db", () => ({ createDb: vi.fn(() => ({ db: {} })) }));

describe("audit-log route", () => {
  let testApp: any;

  beforeAll(() => {
    // Construct the test app lazily so all vi.mock() factories have been
    // resolved (the requireAuth and OpenAPIHono imports inside the
    // create-app mock must resolve to the mocked modules).
    testApp = createTestApp(router as any);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    TEST_USER = {
      id: "test-user-id",
      email: "t@e.com",
      username: "tuser",
      role: "admin",
    };
    AUTH_ENABLED = true;
    mockList.mockReset();
  });

  describe("authentication & authorization", () => {
    it("returns 401 when not authenticated", async () => {
      AUTH_ENABLED = false;
      const res = await testApp.request("/audit-log", { method: "GET" });
      expect(res.status).toBe(401);
    });

    it("returns 403 when caller is not admin (handler guard fires)", async () => {
      TEST_USER = { ...TEST_USER, role: "user" };
      const res = await testApp.request("/audit-log", { method: "GET" });
      expect(res.status).toBe(403);
      expect(mockList).not.toHaveBeenCalled();
    });
  });

  describe("happy path", () => {
    it("returns 200 with items and nextCursor when admin and no filters", async () => {
      mockList.mockResolvedValue({ items: [], nextCursor: null });
      const res = await testApp.request("/audit-log", { method: "GET" });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json).toEqual({ items: [], nextCursor: null });
      expect(mockList).toHaveBeenCalledWith(expect.anything(), expect.anything());
    });

    it("returns 200 with the items array as returned by the repo", async () => {
      const rows = [
        {
          id: "11111111-1111-4111-8111-111111111111",
          createdAt: 200,
          action: "election.create",
          targetType: "election",
          targetId: "22222222-2222-4222-8222-222222222222",
          actorAccountIdSnapshot: "acc-1",
          actorUsernameSnapshot: "alice",
          description: null,
        },
      ];
      mockList.mockResolvedValue({ items: rows, nextCursor: "abc" });
      const res = await testApp.request("/audit-log", { method: "GET" });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.items).toHaveLength(1);
      expect(json.nextCursor).toBe("abc");
    });
  });

  describe("filter pass-through", () => {
    it("forwards actorId query param", async () => {
      mockList.mockResolvedValue({ items: [], nextCursor: null });
      await testApp.request("/audit-log?actorId=acc-1", { method: "GET" });
      expect(mockList).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ actorId: "acc-1" }),
      );
    });

    it("forwards action query param", async () => {
      mockList.mockResolvedValue({ items: [], nextCursor: null });
      await testApp.request("/audit-log?action=election.create", { method: "GET" });
      expect(mockList).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ action: "election.create" }),
      );
    });

    it("forwards targetType query param", async () => {
      mockList.mockResolvedValue({ items: [], nextCursor: null });
      await testApp.request("/audit-log?targetType=candidate", { method: "GET" });
      expect(mockList).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ targetType: "candidate" }),
      );
    });

    it("forwards targetId query param", async () => {
      mockList.mockResolvedValue({ items: [], nextCursor: null });
      await testApp.request("/audit-log?targetId=tgt-42", { method: "GET" });
      expect(mockList).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ targetId: "tgt-42" }),
      );
    });

    it("forwards since query param (coerced to number)", async () => {
      mockList.mockResolvedValue({ items: [], nextCursor: null });
      await testApp.request("/audit-log?since=1700000000", { method: "GET" });
      expect(mockList).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ since: 1700000000 }),
      );
    });

    it("forwards until query param (coerced to number)", async () => {
      mockList.mockResolvedValue({ items: [], nextCursor: null });
      await testApp.request("/audit-log?until=1800000000", { method: "GET" });
      expect(mockList).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ until: 1800000000 }),
      );
    });
  });

  describe("cursor and limit handling", () => {
    it("forwards cursor query param to the repo", async () => {
      mockList.mockResolvedValue({ items: [], nextCursor: null });
      await testApp.request("/audit-log?cursor=encoded-cursor-value", { method: "GET" });
      expect(mockList).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ cursor: "encoded-cursor-value" }),
      );
    });

    it("round-trips a cursor produced by _encodeCursor", async () => {
      mockList.mockResolvedValue({ items: [], nextCursor: null });
      const { _encodeCursor } = await import("@/database/repositories/audit-log.repository");
      const cursor = _encodeCursor({ createdAt: 1700000000, id: "abc-id-1" });
      await testApp.request(`/audit-log?cursor=${encodeURIComponent(cursor)}`, {
        method: "GET",
      });
      expect(mockList).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ cursor }));
    });

    it("uses default limit of 50 when limit is not supplied (schema default)", async () => {
      mockList.mockResolvedValue({ items: [], nextCursor: null });
      await testApp.request("/audit-log", { method: "GET" });
      // The Zod schema's `.default(50)` applies the default; the repo's
      // clampLimit further guards the upper bound. We assert the route
      // passes the schema default through.
      expect(mockList).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ limit: 50 }),
      );
    });

    it("accepts limit=200 (schema max) and forwards it", async () => {
      mockList.mockResolvedValue({ items: [], nextCursor: null });
      const res = await testApp.request("/audit-log?limit=200", { method: "GET" });
      expect(res.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ limit: 200 }),
      );
    });

    it("rejects limit=999 with 422 (schema .max(200))", async () => {
      const res = await testApp.request("/audit-log?limit=999", { method: "GET" });
      expect(res.status).toBe(422);
      expect(mockList).not.toHaveBeenCalled();
    });

    it("rejects limit=0 with 422 (schema .min(1))", async () => {
      const res = await testApp.request("/audit-log?limit=0", { method: "GET" });
      expect(res.status).toBe(422);
      expect(mockList).not.toHaveBeenCalled();
    });

    it("rejects limit=-5 with 422 (schema .min(1))", async () => {
      const res = await testApp.request("/audit-log?limit=-5", { method: "GET" });
      expect(res.status).toBe(422);
      expect(mockList).not.toHaveBeenCalled();
    });
  });

  describe("enum validation", () => {
    it("rejects an invalid action value with 422", async () => {
      const res = await testApp.request("/audit-log?action=garbage", { method: "GET" });
      expect(res.status).toBe(422);
      expect(mockList).not.toHaveBeenCalled();
    });

    it("rejects an invalid targetType value with 422", async () => {
      const res = await testApp.request("/audit-log?targetType=foo", { method: "GET" });
      expect(res.status).toBe(422);
      expect(mockList).not.toHaveBeenCalled();
    });
  });
});
