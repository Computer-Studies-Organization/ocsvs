import { beforeEach, describe, expect, it, vi } from "vitest";
import { ballotCaster } from "./ballot-caster";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

const {
  mockFindByAccountId,
  mockFindElectionById,
  mockExistsForUserInElection,
  mockFindActiveByIds,
  mockListByElection,
  mockFindByUserAndElection,
} = vi.hoisted(() => ({
  mockFindByAccountId: vi.fn(),
  mockFindElectionById: vi.fn(),
  mockExistsForUserInElection: vi.fn(),
  mockFindActiveByIds: vi.fn(),
  mockListByElection: vi.fn(),
  mockFindByUserAndElection: vi.fn(),
}));

vi.mock("@/database/repositories/users.repository", () => ({
  userRepo: {
    findByAccountId: mockFindByAccountId,
  },
}));

vi.mock("@/database/repositories/election.repository", () => ({
  electionRepo: {
    findById: mockFindElectionById,
  },
}));

vi.mock("@/database/repositories/votes.repository", () => ({
  voteRepo: {
    existsForUserInElection: mockExistsForUserInElection,
    findByUserAndElection: mockFindByUserAndElection,
  },
}));

vi.mock("@/database/repositories/candidates.repository", () => ({
  candidateRepo: {
    findActiveByIds: mockFindActiveByIds,
  },
}));

vi.mock("@/database/repositories/position.repository", () => ({
  positionRepo: {
    listByElection: mockListByElection,
  },
}));

const mockDb: any = {
  batch: vi.fn().mockResolvedValue(undefined),
  insert: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
};

describe("DrizzleBallotCaster", () => {
  const accountId = "acc-1";
  const userId = "usr-1";
  const electionId = "ele-1";
  const candidateId = "cand-1";
  const positionId = "pos-1";
  const now = Math.floor(Date.now() / 1000);

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByAccountId.mockReset();
    mockFindElectionById.mockReset();
    mockExistsForUserInElection.mockReset();
    mockFindActiveByIds.mockReset();
    mockListByElection.mockReset();
    mockFindByUserAndElection.mockReset();
  });

  it("should fail with USER_NOT_FOUND when user is missing", async () => {
    mockFindByAccountId.mockResolvedValue(null);
    const result = await ballotCaster.cast(mockDb, { accountId, electionId, selections: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("USER_NOT_FOUND");
      expect(result.error.message).toBe(ERROR_MESSAGES.USER_NOT_FOUND);
    }
  });

  it("should fail with ELECTION_NOT_FOUND when election is missing", async () => {
    mockFindByAccountId.mockResolvedValue({ id: userId });
    mockFindElectionById.mockResolvedValue(null);
    const result = await ballotCaster.cast(mockDb, { accountId, electionId, selections: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("ELECTION_NOT_FOUND");
      expect(result.error.message).toBe(ERROR_MESSAGES.ELECTION_NOT_FOUND);
    }
  });

  it("should fail with ELECTION_NOT_OPEN when election status is draft", async () => {
    mockFindByAccountId.mockResolvedValue({ id: userId });
    mockFindElectionById.mockResolvedValue({ id: electionId, status: "draft" });
    const result = await ballotCaster.cast(mockDb, { accountId, electionId, selections: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("ELECTION_NOT_OPEN");
      expect(result.error.message).toBe(ERROR_MESSAGES.ELECTION_NOT_OPEN);
    }
  });

  it("should fail with ELECTION_NOT_OPEN when election hasn't started", async () => {
    mockFindByAccountId.mockResolvedValue({ id: userId });
    mockFindElectionById.mockResolvedValue({
      id: electionId,
      status: "open",
      opensAt: now + 3600,
      closesAt: now + 7200,
    });
    const result = await ballotCaster.cast(mockDb, { accountId, electionId, selections: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("ELECTION_NOT_OPEN");
      expect(result.error.message).toBe(ERROR_MESSAGES.ELECTION_NOT_OPEN);
    }
  });

  it("should fail with VOTE_ALREADY_CAST if user has already voted", async () => {
    mockFindByAccountId.mockResolvedValue({ id: userId });
    mockFindElectionById.mockResolvedValue({
      id: electionId,
      status: "open",
      opensAt: now - 3600,
      closesAt: now + 3600,
    });
    mockExistsForUserInElection.mockResolvedValue(true);
    const result = await ballotCaster.cast(mockDb, { accountId, electionId, selections: [] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VOTE_ALREADY_CAST");
      expect(result.error.message).toBe(ERROR_MESSAGES.VOTE_ALREADY_CAST);
    }
  });

  it("should fail with CANDIDATE_NOT_FOUND when active candidate checks mismatch selections length", async () => {
    mockFindByAccountId.mockResolvedValue({ id: userId });
    mockFindElectionById.mockResolvedValue({
      id: electionId,
      status: "open",
      opensAt: now - 3600,
      closesAt: now + 3600,
    });
    mockExistsForUserInElection.mockResolvedValue(false);
    mockFindActiveByIds.mockResolvedValue(new Map());

    const result = await ballotCaster.cast(mockDb, {
      accountId,
      electionId,
      selections: [{ candidateId, positionId }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("CANDIDATE_NOT_FOUND");
      expect(result.error.message).toBe(ERROR_MESSAGES.CANDIDATE_NOT_FOUND);
    }
  });

  it("should fail with INVALID_CANDIDATE when candidate positionId doesn't match selection", async () => {
    mockFindByAccountId.mockResolvedValue({ id: userId });
    mockFindElectionById.mockResolvedValue({
      id: electionId,
      status: "open",
      opensAt: now - 3600,
      closesAt: now + 3600,
    });
    mockExistsForUserInElection.mockResolvedValue(false);
    mockFindActiveByIds.mockResolvedValue(
      new Map([[candidateId, { id: candidateId, positionId: "different-pos" }]]),
    );

    const result = await ballotCaster.cast(mockDb, {
      accountId,
      electionId,
      selections: [{ candidateId, positionId }],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INVALID_CANDIDATE");
      expect(result.error.message).toBe(ERROR_MESSAGES.INVALID_CANDIDATE);
    }
  });

  it("should fail with INVALID_CANDIDATE when candidate belongs to a different election (cross-election injection)", async () => {
    // A candidate from Election B is submitted into a ballot for Election A.
    // The candidate exists, is active, and its positionId matches the submitted positionId —
    // so step 6 (positional mismatch check) passes. The cross-election injection is caught
    // at step 7, when the Election B positionId is absent from Election A's position list.
    const electionBPositionId = "pos-from-election-b";
    const electionAPositionId = "pos-from-election-a";

    mockFindByAccountId.mockResolvedValue({ id: userId });
    mockFindElectionById.mockResolvedValue({
      id: electionId, // Election A
      status: "open",
      opensAt: now - 3600,
      closesAt: now + 3600,
    });
    mockExistsForUserInElection.mockResolvedValue(false);
    // Candidate exists and is active; its positionId is from Election B
    mockFindActiveByIds.mockResolvedValue(
      new Map([[candidateId, { id: candidateId, positionId: electionBPositionId }]]),
    );
    // Election A only has its own position — not the Election B position
    mockListByElection.mockResolvedValue([{ id: electionAPositionId, electionId }]);

    const result = await ballotCaster.cast(mockDb, {
      accountId,
      electionId, // Election A
      selections: [{ candidateId, positionId: electionBPositionId }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      // Step 7: Election B's positionId not found in Election A → INVALID_CANDIDATE
      expect(result.error.code).toBe("INVALID_CANDIDATE");
      expect(result.error.message).toBe(ERROR_MESSAGES.INVALID_CANDIDATE);
    }
  });

  it("should fail with DUPLICATE_POSITION_VOTE when voting twice for same position", async () => {
    mockFindByAccountId.mockResolvedValue({ id: userId });
    mockFindElectionById.mockResolvedValue({
      id: electionId,
      status: "open",
      opensAt: now - 3600,
      closesAt: now + 3600,
    });
    mockExistsForUserInElection.mockResolvedValue(false);
    mockFindActiveByIds.mockResolvedValue(
      new Map([
        [candidateId, { id: candidateId, positionId }],
        ["cand-2", { id: "cand-2", positionId }],
      ]),
    );

    const result = await ballotCaster.cast(mockDb, {
      accountId,
      electionId,
      selections: [
        { candidateId, positionId },
        { candidateId: "cand-2", positionId },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("DUPLICATE_POSITION_VOTE");
      expect(result.error.message).toBe(ERROR_MESSAGES.DUPLICATE_POSITION_VOTE);
    }
  });

  it("should fail with INCOMPLETE_BALLOT when one or more positions are left unvoted", async () => {
    mockFindByAccountId.mockResolvedValue({ id: userId });
    mockFindElectionById.mockResolvedValue({
      id: electionId,
      status: "open",
      opensAt: now - 3600,
      closesAt: now + 3600,
    });
    mockExistsForUserInElection.mockResolvedValue(false);
    mockFindActiveByIds.mockResolvedValue(
      new Map([[candidateId, { id: candidateId, positionId }]]),
    );
    mockListByElection.mockResolvedValue([
      { id: positionId, electionId },
      { id: "pos-2", electionId },
    ]);

    const result = await ballotCaster.cast(mockDb, {
      accountId,
      electionId,
      selections: [{ candidateId, positionId }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("INCOMPLETE_BALLOT");
      expect(result.error.message).toBe(ERROR_MESSAGES.INCOMPLETE_BALLOT);
    }
  });

  it("should successfully cast votes when all conditions are satisfied", async () => {
    mockFindByAccountId.mockResolvedValue({ id: userId });
    mockFindElectionById.mockResolvedValue({
      id: electionId,
      status: "open",
      opensAt: now - 3600,
      closesAt: now + 3600,
    });
    mockExistsForUserInElection.mockResolvedValue(false);
    mockFindActiveByIds.mockResolvedValue(
      new Map([[candidateId, { id: candidateId, positionId }]]),
    );
    mockListByElection.mockResolvedValue([{ id: positionId, electionId }]);
    mockFindByUserAndElection.mockResolvedValue([
      { id: "vote-1", userId, candidateId, positionId, electionId },
    ]);

    const result = await ballotCaster.cast(mockDb, {
      accountId,
      electionId,
      selections: [{ candidateId, positionId }],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.votes).toHaveLength(1);
      expect(result.data.votes[0].id).toBe("vote-1");
    }
  });
});
