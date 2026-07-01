import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import router from "./index";

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => "eq-mock"),
  and: vi.fn(() => "and-mock"),
  asc: vi.fn(() => "asc-mock"),
  count: vi.fn(() => "count-mock"),
  desc: vi.fn(() => "desc-mock"),
  inArray: vi.fn(() => "inArray-mock"),
  sql: vi.fn(() => ({
    get: () => "CURRENT_TIMESTAMP",
    toSQL: () => ({ sql: "CURRENT_TIMESTAMP", params: [] }),
  })),
}));

let TEST_USER = {
  id: "test-user-id",
  accountId: "test-account-id",
  role: "user",
};
let AUTH_ENABLED = true;

vi.mock("@/middleware/auth", () => ({
  requireAuth: async (c: any, next: any) => {
    if (!AUTH_ENABLED) return c.json({ message: "Unauthorized" }, 401);
    c.set("authUser", {
      id: TEST_USER.id,
      email: "test@example.com",
      username: "testuser",
      role: TEST_USER.role,
    });
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
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    desc: vi.fn().mockReturnThis(),
    count: vi.fn().mockReturnThis(),
    inArray: vi.fn().mockReturnThis(),
    get: vi.fn(),
    all: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    run: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    batch: vi.fn().mockResolvedValue(undefined),
  };
}

mockDb = createMockDb();

vi.mock("@/config/db", () => ({
  createDb: vi.fn(() => ({ db: mockDb })),
}));

const {
  mockFindActiveByIds,
  mockListWithVoteCount,
  mockGetForAdminView,
  mockFindByAccountId,
  mockExistsForUser,
  mockExistsForUserInElection,
  mockFindByUserId,
  mockFindByUserAndElection,
  mockCountByCandidateId,
  mockGetCurrentElection,
  mockListByElection,
  mockFindElectionById,
  mockFindLatestClosed,
  mockGetElectionResults,
  mockCast,
} = vi.hoisted(() => ({
  mockFindActiveByIds: vi.fn(),
  mockListWithVoteCount: vi.fn(),
  mockGetForAdminView: vi.fn(),
  mockFindByAccountId: vi.fn(),
  mockExistsForUser: vi.fn(),
  mockExistsForUserInElection: vi.fn(),
  mockFindByUserId: vi.fn(),
  mockFindByUserAndElection: vi.fn(),
  mockCountByCandidateId: vi.fn(),
  mockGetCurrentElection: vi.fn(),
  mockListByElection: vi.fn(),
  mockFindElectionById: vi.fn(),
  mockFindLatestClosed: vi.fn(),
  mockGetElectionResults: vi.fn(),
  mockCast: vi.fn(),
}));

vi.mock("@/lib/ballot-caster", () => ({
  ballotCaster: {
    cast: mockCast,
  },
}));

vi.mock("@/database/repositories/candidates.repository", () => ({
  candidateRepo: {
    findActiveByIds: mockFindActiveByIds,
    listWithVoteCount: mockListWithVoteCount,
    getForAdminView: mockGetForAdminView,
  },
}));

vi.mock("@/database/repositories/users.repository", () => ({
  userRepo: {
    findByAccountId: mockFindByAccountId,
    getAccountId: vi.fn(),
    updateUser: vi.fn(),
  },
}));

vi.mock("@/database/repositories/votes.repository", () => ({
  voteRepo: {
    findByUserId: mockFindByUserId,
    findByUserAndElection: mockFindByUserAndElection,
    existsForUser: mockExistsForUser,
    existsForUserInElection: mockExistsForUserInElection,
    countByCandidateId: mockCountByCandidateId,
    insertMany: vi.fn(),
    deleteByUserId: vi.fn(),
  },
}));

vi.mock("@/database/repositories/position.repository", () => ({
  positionRepo: {
    listByElection: mockListByElection,
  },
}));

vi.mock("@/database/repositories/election.repository", () => ({
  electionRepo: {
    findById: mockFindElectionById,
    findLatestClosed: mockFindLatestClosed,
  },
}));

vi.mock("@/database/queries/election.queries", () => ({
  electionQueries: {
    getCurrentElection: mockGetCurrentElection,
    getResults: mockGetElectionResults,
  },
}));

describe("votes Routes (repository)", () => {
  const testUserId = "test-user-id";
  const testUserAccountId = "test-account-id";
  const testCandidateId1 = "test-candidate-id-1";
  const testCandidateId2 = "test-candidate-id-2";
  const testPositionId1 = "test-position-id-1";
  const testPositionId2 = "test-position-id-2";
  const testElectionId = "test-election-id";
  const testVoteId1 = "test-vote-id-1";
  const testVoteId2 = "test-vote-id-2";

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockFindActiveByIds.mockReset();
    mockListWithVoteCount.mockReset();
    mockGetForAdminView.mockReset();
    mockFindByAccountId.mockReset();
    mockExistsForUser.mockReset();
    mockExistsForUserInElection.mockReset();
    mockFindByUserId.mockReset();
    mockFindByUserAndElection.mockReset();
    mockCountByCandidateId.mockReset();
    mockGetCurrentElection.mockReset();
    mockListByElection.mockReset();
    mockFindElectionById.mockReset();
    mockCast.mockReset();
    const nowSecs = Math.floor(Date.now() / 1000);
    mockFindElectionById.mockResolvedValue({
      id: testElectionId,
      status: "open",
      opensAt: nowSecs - 3600,
      closesAt: nowSecs + 3600,
    });
    mockFindLatestClosed.mockReset();
    mockGetElectionResults.mockReset();
    TEST_USER = {
      id: testUserId,
      accountId: testUserAccountId,
      role: "user",
    };
    AUTH_ENABLED = true;
  });

  const setAdmin = () => {
    TEST_USER = { ...TEST_USER, role: "admin" };
  };
  const setUser = () => {
    TEST_USER = { ...TEST_USER, role: "user" };
  };

  describe("authentication & Authorization", () => {
    it("returns 401 when not authenticated for getMyVoteStatus", async () => {
      AUTH_ENABLED = false;
      const res = await router.request("/votes/me", { method: "GET" });
      expect(res.status).toBe(401);
    });

    it("returns 401 when not authenticated for submitVote", async () => {
      AUTH_ENABLED = false;
      const res = await router.request("/votes", {
        method: "POST",
        body: JSON.stringify({ electionId: testElectionId, votes: [] }),
        headers: { "Content-Type": "application/json" },
      });
      expect(res.status).toBe(401);
    });

    it("returns 401 when not authenticated for getVoteResults", async () => {
      AUTH_ENABLED = false;
      const res = await router.request("/votes/results", { method: "GET" });
      expect(res.status).toBe(401);
    });

    it("returns 403 when authenticated as non-admin for getVoteResults", async () => {
      setUser();
      const res = await router.request("/votes/results", { method: "GET" });
      expect(res.status).toBe(403);
    });

    it("returns 403 when authenticated as non-admin for getCandidateVoteCount", async () => {
      setUser();
      const res = await router.request(`/votes/candidates/${testCandidateId1}/count`, {
        method: "GET",
      });
      expect(res.status).toBe(403);
    });
  });

  describe("pOST /votes - Submit Vote", () => {
    it("should successfully submit votes for multiple candidates", async () => {
      setUser();
      mockCast.mockResolvedValue({
        success: true,
        data: {
          votes: [
            {
              id: testVoteId1,
              userId: testUserId,
              candidateId: testCandidateId1,
              positionId: testPositionId1,
              electionId: testElectionId,
              createdAt: Math.floor(Date.now() / 1000),
              updatedAt: Math.floor(Date.now() / 1000),
            },
            {
              id: testVoteId2,
              userId: testUserId,
              candidateId: testCandidateId2,
              positionId: testPositionId2,
              electionId: testElectionId,
              createdAt: Math.floor(Date.now() / 1000),
              updatedAt: Math.floor(Date.now() / 1000),
            },
          ],
        },
      });

      const res = await router.request("/votes", {
        method: "POST",
        body: JSON.stringify({
          electionId: testElectionId,
          votes: [
            { candidateId: testCandidateId1, positionId: testPositionId1 },
            { candidateId: testCandidateId2, positionId: testPositionId2 },
          ],
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.VOTE_SUBMITTED_SUCCESSFULLY);
      expect(json.votes).toHaveLength(2);
    });

    it("should return 409 if user has already voted", async () => {
      setUser();
      mockCast.mockResolvedValue({
        success: false,
        error: {
          code: "VOTE_ALREADY_CAST",
          message: ERROR_MESSAGES.VOTE_ALREADY_CAST,
          status: 409,
        },
      });

      const res = await router.request("/votes", {
        method: "POST",
        body: JSON.stringify({
          electionId: testElectionId,
          votes: [{ candidateId: testCandidateId1, positionId: testPositionId1 }],
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(409);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.VOTE_ALREADY_CAST);
    });

    it("should return 422 for duplicate position votes", async () => {
      setUser();
      mockCast.mockResolvedValue({
        success: false,
        error: {
          code: "DUPLICATE_POSITION_VOTE",
          message: ERROR_MESSAGES.DUPLICATE_POSITION_VOTE,
          status: 422,
        },
      });

      const res = await router.request("/votes", {
        method: "POST",
        body: JSON.stringify({
          electionId: testElectionId,
          votes: [
            { candidateId: testCandidateId1, positionId: testPositionId1 },
            { candidateId: testCandidateId2, positionId: testPositionId1 },
          ],
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(422);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.DUPLICATE_POSITION_VOTE);
    });

    it("should return 404 for non-existent candidate", async () => {
      setUser();
      mockCast.mockResolvedValue({
        success: false,
        error: {
          code: "CANDIDATE_NOT_FOUND",
          message: ERROR_MESSAGES.CANDIDATE_NOT_FOUND,
          status: 404,
        },
      });

      const res = await router.request("/votes", {
        method: "POST",
        body: JSON.stringify({
          electionId: testElectionId,
          votes: [{ candidateId: testCandidateId1, positionId: testPositionId1 }],
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(404);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.CANDIDATE_NOT_FOUND);
    });

    it("should return 400 when candidate positionId does not match the request", async () => {
      setUser();
      mockCast.mockResolvedValue({
        success: false,
        error: {
          code: "INVALID_CANDIDATE",
          message: ERROR_MESSAGES.INVALID_CANDIDATE,
          status: 400,
        },
      });

      const res = await router.request("/votes", {
        method: "POST",
        body: JSON.stringify({
          electionId: testElectionId,
          votes: [{ candidateId: testCandidateId1, positionId: testPositionId2 }],
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.INVALID_CANDIDATE);
    });

    it("should return 404 when target election is not found", async () => {
      setUser();
      mockCast.mockResolvedValue({
        success: false,
        error: {
          code: "ELECTION_NOT_FOUND",
          message: ERROR_MESSAGES.ELECTION_NOT_FOUND,
          status: 404,
        },
      });

      const res = await router.request("/votes", {
        method: "POST",
        body: JSON.stringify({
          electionId: "non-existent-election-id",
          votes: [{ candidateId: testCandidateId1, positionId: testPositionId1 }],
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(404);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.ELECTION_NOT_FOUND);
    });

    it("should return 409 when target election is not open", async () => {
      setUser();
      mockCast.mockResolvedValue({
        success: false,
        error: {
          code: "ELECTION_NOT_OPEN",
          message: ERROR_MESSAGES.ELECTION_NOT_OPEN,
          status: 409,
        },
      });

      const res = await router.request("/votes", {
        method: "POST",
        body: JSON.stringify({
          electionId: testElectionId,
          votes: [{ candidateId: testCandidateId1, positionId: testPositionId1 }],
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status).toBe(409);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.ELECTION_NOT_OPEN);
    });
  });

  describe("gET /votes/me - getMyVotes", () => {
    it("returns vote picks for the current open election", async () => {
      setUser();
      mockFindByAccountId.mockResolvedValue({
        id: testUserId,
        accountId: testUserAccountId,
      });
      mockGetCurrentElection.mockResolvedValue({ id: testElectionId });
      mockFindByUserAndElection.mockResolvedValue([
        {
          id: testVoteId1,
          userId: testUserId,
          candidateId: testCandidateId1,
          positionId: testPositionId1,
          electionId: testElectionId,
          createdAt: 1000,
          updatedAt: 1000,
        },
      ]);

      const res = await router.request("/votes/me", { method: "GET" });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.electionId).toBe(testElectionId);
      expect(json.votes).toHaveLength(1);
      expect(json.votes[0]).toEqual({
        candidateId: testCandidateId1,
        positionId: testPositionId1,
      });
    });

    it("returns empty votes when there is no open election", async () => {
      setUser();
      mockFindByAccountId.mockResolvedValue({
        id: testUserId,
        accountId: testUserAccountId,
      });
      mockGetCurrentElection.mockResolvedValue(null);

      const res = await router.request("/votes/me", { method: "GET" });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json).toEqual({ electionId: null, votes: [] });
    });

    it("returns empty votes when user has not voted in the current election", async () => {
      setUser();
      mockFindByAccountId.mockResolvedValue({
        id: testUserId,
        accountId: testUserAccountId,
      });
      mockGetCurrentElection.mockResolvedValue({ id: testElectionId });
      mockFindByUserAndElection.mockResolvedValue([]);

      const res = await router.request("/votes/me", { method: "GET" });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.electionId).toBe(testElectionId);
      expect(json.votes).toEqual([]);
    });

    it("returns empty votes when user record is missing", async () => {
      setUser();
      mockFindByAccountId.mockResolvedValue(null);

      const res = await router.request("/votes/me", { method: "GET" });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json).toEqual({ electionId: null, votes: [] });
    });
  });

  describe("gET /votes/results - getVoteResults", () => {
    it("should return vote results grouped by position", async () => {
      setAdmin();
      mockGetCurrentElection.mockResolvedValue({ id: testElectionId });
      mockGetElectionResults.mockResolvedValue([
        {
          positionId: testPositionId1,
          positionName: "President",
          displayOrder: 1,
          totalVotes: 5,
          candidates: [
            {
              candidateId: testCandidateId1,
              fullName: "John Doe",
              voteCount: 5,
              percentage: 100,
            },
          ],
        },
        {
          positionId: testPositionId2,
          positionName: "Vice President",
          displayOrder: 2,
          totalVotes: 3,
          candidates: [
            {
              candidateId: testCandidateId2,
              fullName: "Jane Smith",
              voteCount: 3,
              percentage: 100,
            },
          ],
        },
      ]);

      const res = await router.request("/votes/results", { method: "GET" });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.results).toHaveLength(2);
      expect(json.meta.totalVotes).toBe(8);
      expect(json.meta.totalPositions).toBe(2);
    });

    it("should include zero-vote candidates", async () => {
      setAdmin();
      mockGetCurrentElection.mockResolvedValue({ id: testElectionId });
      mockGetElectionResults.mockResolvedValue([
        {
          positionId: testPositionId1,
          positionName: "President",
          displayOrder: 1,
          totalVotes: 0,
          candidates: [
            {
              candidateId: testCandidateId1,
              fullName: "John Doe",
              voteCount: 0,
              percentage: 0,
            },
          ],
        },
      ]);

      const res = await router.request("/votes/results", { method: "GET" });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.results[0].candidates[0].voteCount).toBe(0);
    });
  });
});
