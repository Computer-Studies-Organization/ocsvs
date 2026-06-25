import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
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

const { mockGetResults, mockFindById, mockFindByAccountId, mockFindByUserAndElection } = vi.hoisted(
  () => ({
    mockGetResults: vi.fn(),
    mockFindById: vi.fn(),
    mockFindByAccountId: vi.fn(),
    mockFindByUserAndElection: vi.fn(),
  }),
);

vi.mock("@/database/queries/election.queries", () => ({
  electionQueries: {
    getCurrentElection: vi.fn(),
    getElectionWithPositions: vi.fn(),
    countPositions: vi.fn(),
    getResults: mockGetResults,
  },
}));

vi.mock("@/database/repositories/election.repository", () => ({
  electionRepo: {
    findById: mockFindById,
  },
}));

vi.mock("@/database/repositories/users.repository", () => ({
  userRepo: {
    findByAccountId: mockFindByAccountId,
  },
}));

vi.mock("@/database/repositories/votes.repository", () => ({
  voteRepo: {
    findByUserAndElection: mockFindByUserAndElection,
  },
}));

const electionId = "elec-001";

describe("election results route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockGetResults.mockReset();
    mockFindById.mockReset();
    mockFindByAccountId.mockReset();
    mockFindByUserAndElection.mockReset();
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

  describe("GET /elections/:id/results", () => {
    const results = [
      {
        positionId: "pos-1",
        positionName: "President",
        totalVotes: 2,
        candidates: [{ candidateId: "cand-1", fullName: "Alice", voteCount: 2, percentage: 100 }],
      },
    ];

    it("returns 404 when election not found", async () => {
      mockFindById.mockResolvedValue(undefined);
      const res = await router.request(`/elections/${electionId}/results`, { method: "GET" });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ message: ERROR_MESSAGES.ELECTION_NOT_FOUND });
    });

    it("returns 200 with results when election is closed", async () => {
      mockFindById.mockResolvedValue({ id: electionId, status: "closed" });
      mockGetResults.mockResolvedValue(results);
      const res = await router.request(`/elections/${electionId}/results`, { method: "GET" });
      expect(res.status).toBe(200);
      expect(await res.json()).toHaveLength(1);
    });

    it("returns 403 when election is open and user has not voted", async () => {
      mockFindById.mockResolvedValue({ id: electionId, status: "open" });
      mockFindByAccountId.mockResolvedValue({ id: "student-user-id" });
      mockFindByUserAndElection.mockResolvedValue([]); // No votes cast

      const res = await router.request(`/elections/${electionId}/results`, { method: "GET" });
      expect(res.status).toBe(403);
    });

    it("returns 200 with results when election is open and user has voted", async () => {
      mockFindById.mockResolvedValue({ id: electionId, status: "open" });
      mockFindByAccountId.mockResolvedValue({ id: "student-user-id" });
      mockFindByUserAndElection.mockResolvedValue([{ candidateId: "cand-1" }]); // Voted
      mockGetResults.mockResolvedValue(results);

      const res = await router.request(`/elections/${electionId}/results`, { method: "GET" });
      expect(res.status).toBe(200);
    });

    it("returns 200 with results when election is open and user is admin (even if not voted)", async () => {
      TEST_USER.role = "admin";
      mockFindById.mockResolvedValue({ id: electionId, status: "open" });
      mockGetResults.mockResolvedValue(results);

      const res = await router.request(`/elections/${electionId}/results`, { method: "GET" });
      expect(res.status).toBe(200);
      expect(mockFindByUserAndElection).not.toHaveBeenCalled();
    });
  });
});
