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
  mockCountByCandidateId,
  mockFindCurrentlyOpen,
  mockHasVoterParticipated,
  mockListByElection,
  mockFindElectionById,
  mockFindLatestClosedOrExpiredOpen,
  mockGetElectionResults,
  mockCast,
} = vi.hoisted(() => ({
  mockFindActiveByIds: vi.fn(),
  mockListWithVoteCount: vi.fn(),
  mockGetForAdminView: vi.fn(),
  mockFindByAccountId: vi.fn(),
  mockCountByCandidateId: vi.fn(),
  mockFindCurrentlyOpen: vi.fn(),
  mockHasVoterParticipated: vi.fn(),
  mockListByElection: vi.fn(),
  mockFindElectionById: vi.fn(),
  mockFindLatestClosedOrExpiredOpen: vi.fn(),
  mockGetElectionResults: vi.fn(),
  mockCast: vi.fn(),
}));

vi.mock("@/lib/ballot-caster", () => ({
  ballotCaster: {
    cast: mockCast,
  },
  hasVoterParticipated: mockHasVoterParticipated,
  normalizePreviousHmacSecrets: () => [],
}));

vi.mock("@/database/repositories/candidates.repository", () => ({
  candidateRepo: {
    findActiveByIds: mockFindActiveByIds,
    listWithVoteCount: mockListWithVoteCount,
    getForAdminView: mockGetForAdminView,
  },
}));

vi.mock("@/database/repositories/voter-account-store", () => ({
  voterAccountStore: {
    findByAccountId: mockFindByAccountId,
    getAccountId: vi.fn(),
    updateUser: vi.fn(),
  },
}));

vi.mock("@/database/repositories/votes.repository", () => ({
  voteRepo: {
    countByCandidateId: mockCountByCandidateId,
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
    findCurrentlyOpen: mockFindCurrentlyOpen,
    findLatestClosedOrExpiredOpen: mockFindLatestClosedOrExpiredOpen,
  },
}));

vi.mock("@/database/queries/election.queries", () => ({
  electionQueries: {
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockFindActiveByIds.mockReset();
    mockListWithVoteCount.mockReset();
    mockGetForAdminView.mockReset();
    mockFindByAccountId.mockReset();
    mockCountByCandidateId.mockReset();
    mockFindCurrentlyOpen.mockReset();
    mockHasVoterParticipated.mockReset();
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
    mockFindLatestClosedOrExpiredOpen.mockReset();
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
      const res = await router.request(
        "/votes",
        {
          method: "POST",
          body: JSON.stringify({ electionId: testElectionId, votes: [] }),
          headers: { "Content-Type": "application/json" },
        },
        {
          HMAC_SECRET: "bW9jay1obWFjLXNlY3JldC1rZXktYXQtbGVhc3QtMzItY2hhcnMtbG9uZw==",
        },
      );
      expect(res.status).toBe(401);
    });

    it.each(["admin", "super_admin"] as const)(
      "returns 403 when authenticated as %s for submitVote",
      async (role) => {
        TEST_USER = { ...TEST_USER, role };
        const res = await router.request(
          "/votes",
          {
            method: "POST",
            body: JSON.stringify({
              electionId: testElectionId,
              votes: [{ candidateId: testCandidateId1, positionId: testPositionId1 }],
            }),
            headers: { "Content-Type": "application/json" },
          },
          { HMAC_SECRET: "test-secret" },
        );

        expect(res.status).toBe(403);
        expect(await res.json()).toEqual({ message: ERROR_MESSAGES.FORBIDDEN });
        expect(mockCast).not.toHaveBeenCalled();
      },
    );

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
    it("should reject more than 100 vote selections before casting", async () => {
      setUser();
      const votes = Array.from({ length: 101 }, (_, index) => ({
        candidateId: `candidate-${index}`,
        positionId: `position-${index}`,
      }));

      const res = await router.request(
        "/votes",
        {
          method: "POST",
          body: JSON.stringify({ electionId: testElectionId, votes }),
          headers: { "Content-Type": "application/json" },
        },
        { HMAC_SECRET: "test-secret" },
      );

      expect(res.status).toBe(422);
      expect(mockCast).not.toHaveBeenCalled();
    });

    it("should reject vote identifiers longer than 128 characters", async () => {
      setUser();
      const res = await router.request(
        "/votes",
        {
          method: "POST",
          body: JSON.stringify({
            electionId: testElectionId,
            votes: [{ candidateId: "c".repeat(129), positionId: testPositionId1 }],
          }),
          headers: { "Content-Type": "application/json" },
        },
        { HMAC_SECRET: "test-secret" },
      );

      expect(res.status).toBe(422);
      expect(mockCast).not.toHaveBeenCalled();
    });

    it("should reject oversized vote bodies before JSON parsing", async () => {
      setUser();
      const res = await router.request(
        "/votes",
        {
          method: "POST",
          body: JSON.stringify({
            electionId: testElectionId,
            votes: [{ candidateId: testCandidateId1, positionId: testPositionId1 }],
          }),
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(64 * 1024 + 1),
          },
        },
        { HMAC_SECRET: "test-secret" },
      );

      expect(res.status).toBe(413);
      expect(mockCast).not.toHaveBeenCalled();
    });

    it("should successfully submit votes for multiple candidates", async () => {
      setUser();
      mockCast.mockResolvedValue({ success: true });

      const res = await router.request(
        "/votes",
        {
          method: "POST",
          body: JSON.stringify({
            electionId: testElectionId,
            votes: [
              { candidateId: testCandidateId1, positionId: testPositionId1 },
              { candidateId: testCandidateId2, positionId: testPositionId2 },
            ],
          }),
          headers: { "Content-Type": "application/json" },
        },
        {
          HMAC_SECRET: "bW9jay1obWFjLXNlY3JldC1rZXktYXQtbGVhc3QtMzItY2hhcnMtbG9uZw==",
        },
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.VOTE_SUBMITTED_SUCCESSFULLY);
      expect(json).not.toHaveProperty("votes");
      expect(json).not.toHaveProperty("userId");
      expect(mockCast).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          hmacSecret: "bW9jay1obWFjLXNlY3JldC1rZXktYXQtbGVhc3QtMzItY2hhcnMtbG9uZw==",
        }),
      );
    });

    it("should return 500 when HMAC_SECRET is missing from environment", async () => {
      setUser();
      const res = await router.request("/votes", {
        method: "POST",
        body: JSON.stringify({
          electionId: testElectionId,
          votes: [{ candidateId: testCandidateId1, positionId: testPositionId1 }],
        }),
        headers: { "content-type": "application/json" },
      });
      expect(res.status).toBe(500);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.INTERNAL_SERVER_ERROR);
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

      const res = await router.request(
        "/votes",
        {
          method: "POST",
          body: JSON.stringify({
            electionId: testElectionId,
            votes: [{ candidateId: testCandidateId1, positionId: testPositionId1 }],
          }),
          headers: { "Content-Type": "application/json" },
        },
        {
          HMAC_SECRET: "bW9jay1obWFjLXNlY3JldC1rZXktYXQtbGVhc3QtMzItY2hhcnMtbG9uZw==",
        },
      );

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

      const res = await router.request(
        "/votes",
        {
          method: "POST",
          body: JSON.stringify({
            electionId: testElectionId,
            votes: [
              { candidateId: testCandidateId1, positionId: testPositionId1 },
              { candidateId: testCandidateId2, positionId: testPositionId1 },
            ],
          }),
          headers: { "Content-Type": "application/json" },
        },
        {
          HMAC_SECRET: "bW9jay1obWFjLXNlY3JldC1rZXktYXQtbGVhc3QtMzItY2hhcnMtbG9uZw==",
        },
      );

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

      const res = await router.request(
        "/votes",
        {
          method: "POST",
          body: JSON.stringify({
            electionId: testElectionId,
            votes: [{ candidateId: testCandidateId1, positionId: testPositionId1 }],
          }),
          headers: { "Content-Type": "application/json" },
        },
        {
          HMAC_SECRET: "bW9jay1obWFjLXNlY3JldC1rZXktYXQtbGVhc3QtMzItY2hhcnMtbG9uZw==",
        },
      );

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

      const res = await router.request(
        "/votes",
        {
          method: "POST",
          body: JSON.stringify({
            electionId: testElectionId,
            votes: [{ candidateId: testCandidateId1, positionId: testPositionId2 }],
          }),
          headers: { "Content-Type": "application/json" },
        },
        {
          HMAC_SECRET: "bW9jay1obWFjLXNlY3JldC1rZXktYXQtbGVhc3QtMzItY2hhcnMtbG9uZw==",
        },
      );

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

      const res = await router.request(
        "/votes",
        {
          method: "POST",
          body: JSON.stringify({
            electionId: "non-existent-election-id",
            votes: [{ candidateId: testCandidateId1, positionId: testPositionId1 }],
          }),
          headers: { "Content-Type": "application/json" },
        },
        {
          HMAC_SECRET: "bW9jay1obWFjLXNlY3JldC1rZXktYXQtbGVhc3QtMzItY2hhcnMtbG9uZw==",
        },
      );

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

      const res = await router.request(
        "/votes",
        {
          method: "POST",
          body: JSON.stringify({
            electionId: testElectionId,
            votes: [{ candidateId: testCandidateId1, positionId: testPositionId1 }],
          }),
          headers: { "Content-Type": "application/json" },
        },
        {
          HMAC_SECRET: "bW9jay1obWFjLXNlY3JldC1rZXktYXQtbGVhc3QtMzItY2hhcnMtbG9uZw==",
        },
      );

      expect(res.status).toBe(409);
      const json = (await res.json()) as any;
      expect(json.message).toBe(ERROR_MESSAGES.ELECTION_NOT_OPEN);
    });
  });

  describe("gET /votes/me - getMyVotes", () => {
    it("returns only participation status for the current open election", async () => {
      setUser();
      mockFindByAccountId.mockResolvedValue({
        id: testUserId,
        accountId: testUserAccountId,
        studentId: "2024-0001",
      });
      mockFindCurrentlyOpen.mockResolvedValue({ id: testElectionId });
      mockHasVoterParticipated.mockResolvedValue(true);

      const res = await router.request(
        "/votes/me",
        { method: "GET" },
        { HMAC_SECRET: "test-secret" },
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json).toEqual({ electionId: testElectionId, hasVoted: true });
      expect(json).not.toHaveProperty("votes");
      expect(json).not.toHaveProperty("userId");
      expect(mockFindCurrentlyOpen).toHaveBeenCalledWith(mockDb);
      expect(mockHasVoterParticipated).toHaveBeenCalledWith(
        mockDb,
        testElectionId,
        "2024-0001",
        "test-secret",
        [],
        testUserId,
      );
    });

    it("returns empty votes when there is no open election", async () => {
      setUser();
      mockFindByAccountId.mockResolvedValue({
        id: testUserId,
        accountId: testUserAccountId,
      });
      mockFindCurrentlyOpen.mockResolvedValue(null);

      const res = await router.request("/votes/me", { method: "GET" });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json).toEqual({ electionId: null, hasVoted: false });
      expect(mockFindCurrentlyOpen).toHaveBeenCalledWith(mockDb);
    });

    it("does not return votes for an expired open election", async () => {
      setUser();
      mockFindByAccountId.mockResolvedValue({ id: testUserId, accountId: testUserAccountId });
      mockFindCurrentlyOpen.mockResolvedValue(null);

      const res = await router.request("/votes/me", { method: "GET" });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ electionId: null, hasVoted: false });
    });

    it("returns empty votes when user has not voted in the current election", async () => {
      setUser();
      mockFindByAccountId.mockResolvedValue({
        id: testUserId,
        accountId: testUserAccountId,
        studentId: "2024-0001",
      });
      mockFindCurrentlyOpen.mockResolvedValue({ id: testElectionId });
      mockHasVoterParticipated.mockResolvedValue(false);

      const res = await router.request(
        "/votes/me",
        { method: "GET" },
        { HMAC_SECRET: "test-secret" },
      );

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.electionId).toBe(testElectionId);
      expect(json.hasVoted).toBe(false);
      expect(json).not.toHaveProperty("votes");
      expect(mockFindCurrentlyOpen).toHaveBeenCalledWith(mockDb);
    });

    it("returns empty votes when user record is missing", async () => {
      setUser();
      mockFindByAccountId.mockResolvedValue(null);

      const res = await router.request("/votes/me", { method: "GET" });

      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json).toEqual({ electionId: null, hasVoted: false });
    });
  });

  describe("gET /votes/results - getVoteResults", () => {
    it("should return vote results grouped by position", async () => {
      setAdmin();
      mockFindCurrentlyOpen.mockResolvedValue({ id: testElectionId });
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
      expect(mockFindCurrentlyOpen).toHaveBeenCalledWith(mockDb);
    });

    it("should include zero-vote candidates", async () => {
      setAdmin();
      mockFindCurrentlyOpen.mockResolvedValue({ id: testElectionId });
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
      expect(mockFindCurrentlyOpen).toHaveBeenCalledWith(mockDb);
    });

    it("uses an expired open election as the legacy results election", async () => {
      setAdmin();
      mockFindCurrentlyOpen.mockResolvedValue(null);
      mockFindLatestClosedOrExpiredOpen.mockResolvedValue({
        id: testElectionId,
        status: "open",
        opensAt: 1,
        closesAt: 2,
      });
      mockGetElectionResults.mockResolvedValue([]);

      const res = await router.request("/votes/results", { method: "GET" });

      expect(res.status).toBe(200);
      expect(mockFindLatestClosedOrExpiredOpen).toHaveBeenCalledWith(mockDb);
      expect(((await res.json()) as any).meta.totalPositions).toBe(0);
    });
  });
});
