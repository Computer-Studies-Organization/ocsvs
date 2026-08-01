import { beforeEach, describe, expect, it, vi } from "vitest";
import { ballotCaster, computeVoterHash, computeLegacyVoterHash } from "./ballot-caster";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

const {
  mockFindByAccountId,
  mockFindElectionById,
  mockExistsForUserInElection,
  mockHasVoterHashParticipated,
  mockFindActiveByIds,
  mockListByElection,
  mockFindByUserAndElection,
} = vi.hoisted(() => ({
  mockFindByAccountId: vi.fn(),
  mockFindElectionById: vi.fn(),
  mockExistsForUserInElection: vi.fn(),
  mockHasVoterHashParticipated: vi.fn().mockResolvedValue(false),
  mockFindActiveByIds: vi.fn(),
  mockListByElection: vi.fn(),
  mockFindByUserAndElection: vi.fn(),
}));

vi.mock("@/database/repositories/voter-account-store", () => ({
  voterAccountStore: {
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
    hasVoterHashParticipated: mockHasVoterHashParticipated,
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
    const result = await ballotCaster.cast(mockDb, {
      accountId,
      electionId,
      selections: [],
      hmacSecret: "dGVzdC1zZWNyZXQta2V5LTMyLWNoYXJhY3RlcnMtbWluaW11bQ==",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("USER_NOT_FOUND");
      expect(result.error.message).toBe(ERROR_MESSAGES.USER_NOT_FOUND);
    }
  });

  it("should fail with ELECTION_NOT_FOUND when election is missing", async () => {
    mockFindByAccountId.mockResolvedValue({ id: userId });
    mockFindElectionById.mockResolvedValue(null);
    const result = await ballotCaster.cast(mockDb, {
      accountId,
      electionId,
      selections: [],
      hmacSecret: "dGVzdC1zZWNyZXQta2V5LTMyLWNoYXJhY3RlcnMtbWluaW11bQ==",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("ELECTION_NOT_FOUND");
      expect(result.error.message).toBe(ERROR_MESSAGES.ELECTION_NOT_FOUND);
    }
  });

  it("should fail with ELECTION_NOT_OPEN when election status is draft", async () => {
    mockFindByAccountId.mockResolvedValue({ id: userId });
    mockFindElectionById.mockResolvedValue({ id: electionId, status: "draft" });
    const result = await ballotCaster.cast(mockDb, {
      accountId,
      electionId,
      selections: [],
      hmacSecret: "dGVzdC1zZWNyZXQta2V5LTMyLWNoYXJhY3RlcnMtbWluaW11bQ==",
    });
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
    const result = await ballotCaster.cast(mockDb, {
      accountId,
      electionId,
      selections: [],
      hmacSecret: "dGVzdC1zZWNyZXQta2V5LTMyLWNoYXJhY3RlcnMtbWluaW11bQ==",
    });
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
    const result = await ballotCaster.cast(mockDb, {
      accountId,
      electionId,
      selections: [],
      hmacSecret: "dGVzdC1zZWNyZXQta2V5LTMyLWNoYXJhY3RlcnMtbWluaW11bQ==",
    });
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
      hmacSecret: "dGVzdC1zZWNyZXQta2V5LTMyLWNoYXJhY3RlcnMtbWluaW11bQ==",
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
      hmacSecret: "dGVzdC1zZWNyZXQta2V5LTMyLWNoYXJhY3RlcnMtbWluaW11bQ==",
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
      hmacSecret: "dGVzdC1zZWNyZXQta2V5LTMyLWNoYXJhY3RlcnMtbWluaW11bQ==",
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
      hmacSecret: "dGVzdC1zZWNyZXQta2V5LTMyLWNoYXJhY3RlcnMtbWluaW11bQ==",
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
      hmacSecret: "dGVzdC1zZWNyZXQta2V5LTMyLWNoYXJhY3RlcnMtbWluaW11bQ==",
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
      hmacSecret: "dGVzdC1zZWNyZXQta2V5LTMyLWNoYXJhY3RlcnMtbWluaW11bQ==",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.votes).toHaveLength(1);
      expect(result.data.votes[0].id).toBe("vote-1");
    }
  });

  it("should fail with internal error when hmacSecret is missing or too short during cast", async () => {
    mockFindByAccountId.mockResolvedValue({ id: userId, studentId: "2024-0001" });
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

    // Missing hmacSecret
    await expect(
      ballotCaster.cast(mockDb, {
        accountId,
        electionId,
        selections: [{ candidateId, positionId }],
      } as any),
    ).rejects.toThrow("hmacSecret must be valid base64");

    // Invalid base64 hmacSecret
    await expect(
      ballotCaster.cast(mockDb, {
        accountId,
        electionId,
        selections: [{ candidateId, positionId }],
        hmacSecret: "short-key",
      }),
    ).rejects.toThrow("hmacSecret must be valid base64");

    // Too short base64 hmacSecret
    await expect(
      ballotCaster.cast(mockDb, {
        accountId,
        electionId,
        selections: [{ candidateId, positionId }],
        hmacSecret: btoa("short-key"),
      }),
    ).rejects.toThrow("hmacSecret must decode to at least 32 bytes");
  });

  it("should fail with VOTE_ALREADY_CAST if a legacy (SHA-256) participation record exists", async () => {
    const studentId = "2024-0001";
    const legacyHash = await computeLegacyVoterHash(electionId, studentId);

    mockFindByAccountId.mockResolvedValue({ id: userId, studentId });
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

    // mockHasVoterHashParticipated should return true if legacyHash is checked
    mockHasVoterHashParticipated.mockImplementation(async (db, elId, hashes) => {
      return hashes.includes(legacyHash);
    });

    const result = await ballotCaster.cast(mockDb, {
      accountId,
      electionId,
      selections: [{ candidateId, positionId }],
      hmacSecret: "dGVzdC1zZWNyZXQta2V5LTMyLWNoYXJhY3RlcnMtbWluaW11bQ==",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VOTE_ALREADY_CAST");
      expect(result.error.message).toBe(ERROR_MESSAGES.VOTE_ALREADY_CAST);
    }
  });

  it("should block voting if matching record is found under rotated secret (rotation/key change)", async () => {
    const studentId = "2024-0001";
    const oldSecret = "b2xkLXNlY3JldC1rZXktMzItY2hhcmFjdGVycy1taW5pbXVt";
    const newSecret = "bmV3LXNlY3JldC1rZXktMzItY2hhcmFjdGVycy1taW5pbXVt";

    const oldHash = await computeVoterHash(electionId, studentId, oldSecret);

    mockFindByAccountId.mockResolvedValue({ id: userId, studentId });
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

    // Repository reports a match only when the rotated oldHash is checked
    mockHasVoterHashParticipated.mockImplementation(async (db, elId, hashes) => {
      return hashes.includes(oldHash);
    });

    const result = await ballotCaster.cast(mockDb, {
      accountId,
      electionId,
      selections: [{ candidateId, positionId }],
      hmacSecret: newSecret,
      previousHmacSecrets: [oldSecret],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("VOTE_ALREADY_CAST");
      expect(result.error.message).toBe(ERROR_MESSAGES.VOTE_ALREADY_CAST);
    }
  });

  it("should successfully cast when legacy checks do not match but active works", async () => {
    const studentId = "2024-0001";
    mockFindByAccountId.mockResolvedValue({ id: userId, studentId });
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

    // DB has no participating rows matching
    mockHasVoterHashParticipated.mockResolvedValue(false);

    const result = await ballotCaster.cast(mockDb, {
      accountId,
      electionId,
      selections: [{ candidateId, positionId }],
      hmacSecret: "dGVzdC1zZWNyZXQta2V5LTMyLWNoYXJhY3RlcnMtbWluaW11bQ==",
    });

    expect(result.success).toBe(true);
  });
});

describe("computeVoterHash", () => {
  const testSecret = "dGVzdC1zZWNyZXQta2V5LTMyLWNoYXJhY3RlcnMtbWluaW11bQ==";
  const diffSecret = "ZGlmZmVyZW50LXNlY3JldC1rZXktMzItY2hhcnMtbG9uZw==";

  it("should compute deterministic HMAC-SHA256 hash for valid studentId", async () => {
    const hash1 = await computeVoterHash("election-1", "2024-0001", testSecret);
    const hash2 = await computeVoterHash("election-1", "2024-0001", testSecret);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(67);
    expect(hash1.startsWith("v1:")).toBe(true);
  });

  it("should generate distinct hashes for different studentIds or secrets", async () => {
    const hashA = await computeVoterHash("election-1", "2024-0001", testSecret);
    const hashB = await computeVoterHash("election-1", "2024-0002", testSecret);
    const hashC = await computeVoterHash("election-1", "2024-0001", diffSecret);
    expect(hashA).not.toBe(hashB);
    expect(hashA).not.toBe(hashC);
  });

  it("should throw an error if studentId is missing, empty, or whitespace", async () => {
    await expect(computeVoterHash("election-1", undefined, testSecret)).rejects.toThrow(
      "studentId must be a non-empty string for voter hash computation",
    );
    await expect(computeVoterHash("election-1", "", testSecret)).rejects.toThrow(
      "studentId must be a non-empty string for voter hash computation",
    );
    await expect(computeVoterHash("election-1", "   ", testSecret)).rejects.toThrow(
      "studentId must be a non-empty string for voter hash computation",
    );
  });

  it("should throw an error if hmacSecret is missing, empty, or less than 32 characters/bytes", async () => {
    await expect(computeVoterHash("election-1", "2024-0001", "")).rejects.toThrow(
      "hmacSecret must be valid base64",
    );
    await expect(computeVoterHash("election-1", "2024-0001", "!!!")).rejects.toThrow(
      "hmacSecret must be valid base64",
    );
    // Base64 secret that decodes to less than 32 bytes -> should fail
    const shortBase64 = btoa("short-secret-17b");
    await expect(computeVoterHash("election-1", "2024-0001", shortBase64)).rejects.toThrow(
      "hmacSecret must decode to at least 32 bytes",
    );
  });

  it("should pass if hmacSecret is a valid base64 key that decodes to >= 32 bytes", async () => {
    const validBase64 = btoa("this-is-a-very-long-secret-key-that-is-at-least-32-bytes-long");
    const hash = await computeVoterHash("election-1", "2024-0001", validBase64);
    expect(hash.startsWith("v1:")).toBe(true);
  });
});

describe("computeLegacyVoterHash", () => {
  it("should compute deterministic SHA-256 hash for valid studentId without prefix", async () => {
    const hash1 = await computeLegacyVoterHash("election-1", "2024-0001");
    const hash2 = await computeLegacyVoterHash("election-1", "2024-0001");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
    expect(hash1.includes(":")).toBe(false);
  });

  it("should generate distinct legacy hashes for different studentIds", async () => {
    const hashA = await computeLegacyVoterHash("election-1", "2024-0001");
    const hashB = await computeLegacyVoterHash("election-1", "2024-0002");
    expect(hashA).not.toBe(hashB);
  });
});
