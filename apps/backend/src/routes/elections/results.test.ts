import { beforeEach, describe, expect, it, vi } from "vitest";
import router from "./index";

let TEST_USER = {
  id: "test-user-id",
  email: "test@example.com",
  username: "testuser",
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
    groupBy: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    all: vi.fn(),
    get: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    run: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
}

mockDb = createMockDb();

vi.mock("@/config/db", () => ({
  createDb: vi.fn(() => ({ db: mockDb })),
}));

const { mockGetResults } = vi.hoisted(() => ({
  mockGetResults: vi.fn(),
}));

vi.mock("@/database/queries/election.queries", () => ({
  electionQueries: {
    getCurrentElection: vi.fn(),
    getElectionWithPositions: vi.fn(),
    countPositions: vi.fn(),
    getResults: mockGetResults,
  },
}));

const electionId = "elec-001";

describe("election results route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockGetResults.mockReset();
    TEST_USER = {
      id: "test-user-id",
      email: "test@example.com",
      username: "testuser",
      role: "user",
    };
    AUTH_ENABLED = true;
  });

  describe("authentication", () => {
    it("returns 401 when not authenticated", async () => {
      AUTH_ENABLED = false;
      const res = await router.request(`/elections/${electionId}/results`, { method: "GET" });
      expect(res.status).toBe(401);
    });
  });

  describe("gET /elections/:id/results", () => {
    it("returns 200 with per-position results", async () => {
      const results = [
        {
          positionId: "pos-1",
          positionName: "President",
          totalVotes: 2,
          candidates: [{ candidateId: "cand-1", fullName: "Alice", voteCount: 2, percentage: 100 }],
        },
      ];
      mockGetResults.mockResolvedValue(results);
      const res = await router.request(`/elections/${electionId}/results`, { method: "GET" });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json).toHaveLength(1);
      expect(json[0].positionName).toBe("President");
      expect(mockGetResults).toHaveBeenCalledWith(mockDb, electionId);
    });

    it("returns 200 with empty array when election has no positions", async () => {
      mockGetResults.mockResolvedValue([]);
      const res = await router.request(`/elections/${electionId}/results`, { method: "GET" });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json).toEqual([]);
    });
  });
});
