import { beforeEach, describe, expect, it, vi } from "vitest";
import { electionRepo } from "@/database/repositories/election.repository";
import { electionQueries } from "@/database/queries/election.queries";
import { userRepo } from "@/database/repositories/users.repository";
import { voteRepo } from "@/database/repositories/votes.repository";
import { getVotingState } from "./voting-state.queries";

vi.mock("@/database/repositories/election.repository", () => ({
  electionRepo: {
    findOpen: vi.fn(),
    findEarliestDraft: vi.fn(),
    findLatestClosed: vi.fn(),
  },
}));
vi.mock("@/database/queries/election.queries", () => ({
  electionQueries: { getResults: vi.fn() },
}));
vi.mock("@/database/repositories/users.repository", () => ({
  userRepo: { findByAccountId: vi.fn() },
}));
vi.mock("@/database/repositories/votes.repository", () => ({
  voteRepo: { findByUserAndElection: vi.fn() },
}));

const db = {} as any;
const accountId = "acc-1";

const mockUser = { id: "user-1" } as any;

beforeEach(() => {
  vi.mocked(electionRepo.findOpen).mockReset();
  vi.mocked(electionRepo.findEarliestDraft).mockReset();
  vi.mocked(electionRepo.findLatestClosed).mockReset();
  vi.mocked(electionQueries.getResults).mockReset();
  vi.mocked(userRepo.findByAccountId).mockReset();
  vi.mocked(voteRepo.findByUserAndElection).mockReset();
});

describe("getVotingState", () => {
  it("returns all-null shape when no elections exist and no votes", async () => {
    vi.mocked(electionRepo.findOpen).mockResolvedValue(null);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(null);

    const result = await getVotingState(db, accountId);

    expect(result).toEqual({
      open: null,
      nextDraft: null,
      lastClosed: null,
      myVotes: { electionId: null, votes: [] },
    });
    expect(userRepo.findByAccountId).not.toHaveBeenCalled();
    expect(voteRepo.findByUserAndElection).not.toHaveBeenCalled();
  });

  it("returns the open election when one exists", async () => {
    const openRow = {
      id: "e1",
      name: "Spring 2026",
      description: null,
      status: "open",
      opensAt: 1,
      closesAt: 2,
      createdAt: 1,
      updatedAt: 1,
    };
    vi.mocked(electionRepo.findOpen).mockResolvedValue(openRow as any);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(null);
    vi.mocked(userRepo.findByAccountId).mockResolvedValue(mockUser);
    vi.mocked(voteRepo.findByUserAndElection).mockResolvedValue([]);

    const result = await getVotingState(db, accountId);

    expect(result.open).toEqual(openRow);
    expect(result.nextDraft).toBeNull();
    expect(result.lastClosed).toBeNull();
  });

  it("returns nextDraft with id/name/opensAt/closesAt when findEarliestDraft returns a row", async () => {
    const draft = {
      id: "d1",
      name: "Summer",
      description: null,
      status: "draft",
      opensAt: 100,
      closesAt: 200,
      createdAt: 1,
      updatedAt: 1,
    };
    vi.mocked(electionRepo.findOpen).mockResolvedValue(null);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(draft as any);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(null);

    const result = await getVotingState(db, accountId);

    expect(result.nextDraft).toEqual({
      id: "d1",
      name: "Summer",
      opensAt: 100,
      closesAt: 200,
    });
  });

  it("falls back to opensAt for closesAt when closesAt is null on a draft row", async () => {
    const draft = {
      id: "d1",
      name: "Summer",
      description: null,
      status: "draft",
      opensAt: 100,
      closesAt: null,
      createdAt: 1,
      updatedAt: 1,
    };
    vi.mocked(electionRepo.findOpen).mockResolvedValue(null);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(draft as any);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(null);

    const result = await getVotingState(db, accountId);

    expect(result.nextDraft?.closesAt).toBe(100);
  });

  it("returns lastClosed with results when findLatestClosed returns a row", async () => {
    const closed = {
      id: "c2",
      name: "Recent",
      description: null,
      status: "closed",
      opensAt: 1,
      closesAt: 200,
      createdAt: 2,
      updatedAt: 2,
    };
    vi.mocked(electionRepo.findOpen).mockResolvedValue(null);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(closed as any);
    vi.mocked(electionQueries.getResults).mockResolvedValue([
      {
        positionId: "p1",
        positionName: "President",
        totalVotes: 42,
        candidates: [{ candidateId: "c1", fullName: "Alice", voteCount: 30, percentage: 71.43 }],
      },
    ] as any);

    const result = await getVotingState(db, accountId);

    expect(result.lastClosed).toEqual({
      id: "c2",
      name: "Recent",
      closesAt: 200,
      results: [
        {
          positionId: "p1",
          positionName: "President",
          totalVotes: 42,
          candidates: [{ candidateId: "c1", fullName: "Alice", voteCount: 30, percentage: 71.43 }],
        },
      ],
    });
    expect(electionQueries.getResults).toHaveBeenCalledWith(db, "c2");
  });

  it("returns user-scoped myVotes when an open election exists", async () => {
    const openRow = {
      id: "e-open",
      name: "Now",
      description: null,
      status: "open",
      opensAt: 1,
      closesAt: 2,
      createdAt: 1,
      updatedAt: 1,
    };
    vi.mocked(electionRepo.findOpen).mockResolvedValue(openRow as any);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(null);
    vi.mocked(userRepo.findByAccountId).mockResolvedValue(mockUser);
    vi.mocked(voteRepo.findByUserAndElection).mockResolvedValue([
      { candidateId: "c1", positionId: "p1" },
    ] as any);

    const result = await getVotingState(db, accountId);

    expect(result.myVotes).toEqual({
      electionId: "e-open",
      votes: [{ candidateId: "c1", positionId: "p1" }],
    });
    expect(userRepo.findByAccountId).toHaveBeenCalledWith(db, accountId);
    expect(voteRepo.findByUserAndElection).toHaveBeenCalledWith(db, "user-1", "e-open");
  });

  it("returns empty myVotes when there is no open election even if the account has a user row", async () => {
    vi.mocked(electionRepo.findOpen).mockResolvedValue(null);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(null);

    const result = await getVotingState(db, accountId);

    expect(result.myVotes).toEqual({ electionId: null, votes: [] });
    expect(userRepo.findByAccountId).not.toHaveBeenCalled();
  });

  it("returns empty myVotes when the account has no associated user", async () => {
    const openRow = {
      id: "e-open",
      name: "Now",
      description: null,
      status: "open",
      opensAt: 1,
      closesAt: 2,
      createdAt: 1,
      updatedAt: 1,
    };
    vi.mocked(electionRepo.findOpen).mockResolvedValue(openRow as any);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(null);
    vi.mocked(userRepo.findByAccountId).mockResolvedValue(null);

    const result = await getVotingState(db, accountId);

    expect(result.myVotes).toEqual({ electionId: "e-open", votes: [] });
    expect(voteRepo.findByUserAndElection).not.toHaveBeenCalled();
  });
});
