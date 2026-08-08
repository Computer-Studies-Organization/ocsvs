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

let mockDb: any;

function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: vi.fn(),
    all: vi.fn(),
  };
}

mockDb = createMockDb();

vi.mock("@/config/db", () => ({
  createDb: vi.fn(() => ({ db: mockDb })),
}));

describe("admin stats routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    TEST_USER = {
      id: "test-user-id",
      email: "t@e.com",
      username: "tuser",
      role: "admin",
    };
    AUTH_ENABLED = true;
  });

  it("returns 401 when not authenticated", async () => {
    AUTH_ENABLED = false;
    const res = await router.request("/admin/stats", { method: "GET" });
    expect(res.status).toBe(401);
  });

  it("returns 403 when authenticated user is not an admin", async () => {
    TEST_USER.role = "user";
    const res = await router.request("/admin/stats", { method: "GET" });
    expect(res.status).toBe(403);
  });

  it("returns 200 with stats when no open election exists", async () => {
    let getCallCount = 0;
    mockDb.get.mockImplementation(() => {
      getCallCount++;
      if (getCallCount === 1) return { count: 42 }; // voters Count
      if (getCallCount === 2) return { count: 3 }; // elections Count
      if (getCallCount === 3) return null; // open election
      return null;
    });

    mockDb.all.mockReturnValue([
      {
        id: "log-1",
        createdAt: 1700000000,
        action: "election.create",
        targetType: "election",
        targetId: "elec-1",
        actorAccountIdSnapshot: "admin-1",
        actorUsernameSnapshot: "admin1",
        description: "created election",
      },
    ]);

    const res = await router.request("/admin/stats", { method: "GET" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.votersCount).toBe(42);
    expect(body.electionsCount).toBe(3);
    expect(body.activeElection).toBeNull();
    expect(body.recentLogs).toHaveLength(1);
    expect(body.recentLogs[0].id).toBe("log-1");
  });

  it("returns 200 with stats when open election exists", async () => {
    let getCallCount = 0;
    mockDb.get.mockImplementation(() => {
      getCallCount++;
      if (getCallCount === 1) return { count: 100 }; // voters Count
      if (getCallCount === 2) return { count: 5 }; // elections Count
      if (getCallCount === 3) {
        return {
          id: "elec-open",
          name: "Open Election",
          opensAt: 1700000000,
          closesAt: 1710000000,
          status: "open",
        };
      }
      if (getCallCount === 4) return { count: 65 }; // unique votes count
      return null;
    });

    mockDb.all.mockReturnValue([]);

    const res = await router.request("/admin/stats", { method: "GET" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.votersCount).toBe(100);
    expect(body.electionsCount).toBe(5);
    expect(body.activeElection).toEqual({
      id: "elec-open",
      name: "Open Election",
      opensAt: 1700000000,
      closesAt: 1710000000,
      votedCount: 65,
      votersCount: 100,
      turnoutPct: 65,
    });
  });

  it("includes soft-deleted voters in the turnout denominator", async () => {
    const whereConditions: unknown[] = [];
    const hasColumn = (value: unknown, name: string, seen = new Set<object>()): boolean => {
      if (value === null || typeof value !== "object" || seen.has(value)) return false;
      seen.add(value);
      if ((value as { name?: string }).name === name) return true;
      if ("queryChunks" in value) {
        return (value as { queryChunks: unknown[] }).queryChunks.some((child) =>
          hasColumn(child, name, seen),
        );
      }
      return false;
    };

    mockDb = createMockDb();
    mockDb.where.mockImplementation((condition: unknown) => {
      whereConditions.push(condition);
      return mockDb;
    });

    let getCallCount = 0;
    mockDb.get.mockImplementation(() => {
      getCallCount++;
      if (getCallCount === 1) {
        return { count: hasColumn(whereConditions[0], "deleted_at") ? 1 : 2 };
      }
      if (getCallCount === 2) return { count: 1 };
      if (getCallCount === 3) {
        return {
          id: "elec-open",
          name: "Open Election",
          opensAt: 1700000000,
          closesAt: 1710000000,
          status: "open",
        };
      }
      if (getCallCount === 4) return { count: 2 };
      return null;
    });
    mockDb.all.mockReturnValue([]);

    const res = await router.request("/admin/stats", { method: "GET" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.activeElection.votersCount).toBe(2);
    expect(body.activeElection.votedCount).toBe(2);
    expect(body.activeElection.turnoutPct).toBe(100);
  });
});
