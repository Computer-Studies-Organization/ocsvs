import { beforeEach, describe, expect, it, vi } from "vitest";
import { electionRepo } from "@/database/repositories/election.repository";
import { electionQueries } from "@/database/queries/election.queries";
import { candidateRepo } from "@/database/repositories/candidates.repository";
import { partyListRepo } from "@/database/repositories/party-list.repository";
import { positionRepo } from "@/database/repositories/position.repository";
import { voterAccountStore } from "@/database/repositories/voter-account-store";
import { voteRepo } from "@/database/repositories/votes.repository";
import { getVotingState } from "./voting-state.queries";

vi.mock("@/database/repositories/election.repository", () => ({
  electionRepo: {
    findOpen: vi.fn(),
    findEarliestDraft: vi.fn(),
    findLatestClosed: vi.fn(),
  },
}));
vi.mock("@/database/repositories/candidates.repository", () => ({
  candidateRepo: { listForBallot: vi.fn() },
}));
vi.mock("@/database/repositories/party-list.repository", () => ({
  partyListRepo: { listByElection: vi.fn() },
}));
vi.mock("@/database/repositories/position.repository", () => ({
  positionRepo: { listByElection: vi.fn() },
}));
vi.mock("@/database/queries/election.queries", () => ({
  electionQueries: { getResults: vi.fn() },
}));
vi.mock("@/database/repositories/voter-account-store", () => ({
  voterAccountStore: { findByAccountId: vi.fn() },
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
  vi.mocked(candidateRepo.listForBallot).mockReset();
  vi.mocked(partyListRepo.listByElection).mockReset();
  vi.mocked(positionRepo.listByElection).mockReset();
  vi.mocked(voterAccountStore.findByAccountId).mockReset();
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
      ballot: null,
      myVotes: { electionId: null, votes: [] },
    });
    expect(voterAccountStore.findByAccountId).not.toHaveBeenCalled();
    expect(voteRepo.findByUserAndElection).not.toHaveBeenCalled();
  });

  it("returns the open election when one exists", async () => {
    const nowSecs = Math.floor(Date.now() / 1000);
    const openRow = {
      id: "e1",
      name: "Spring 2026",
      description: null,
      status: "open",
      opensAt: nowSecs - 3600,
      closesAt: nowSecs + 3600,
      createdAt: 1,
      updatedAt: 1,
    };
    vi.mocked(electionRepo.findOpen).mockResolvedValue(openRow as any);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(null);
    vi.mocked(voterAccountStore.findByAccountId).mockResolvedValue(mockUser);
    vi.mocked(voteRepo.findByUserAndElection).mockResolvedValue([]);

    const result = await getVotingState(db, accountId);

    expect(result.open).toEqual(openRow);
    expect(result.nextDraft).toBeNull();
    expect(result.lastClosed).toBeNull();
    expect(result.ballot).toBeNull();
    expect(positionRepo.listByElection).not.toHaveBeenCalled();
    expect(partyListRepo.listByElection).not.toHaveBeenCalled();
    expect(candidateRepo.listForBallot).not.toHaveBeenCalled();
  });

  it("includes the current election ballot in the state response", async () => {
    const nowSecs = Math.floor(Date.now() / 1000);
    const openRow = {
      id: "e-ballot",
      name: "Spring 2026",
      description: null,
      status: "open",
      opensAt: nowSecs - 3600,
      closesAt: nowSecs + 3600,
      createdAt: 1,
      updatedAt: 1,
    };
    const positions = [{ id: "p1", electionId: "e-ballot", name: "President" }];
    const parties = [{ id: "party-1", electionId: "e-ballot", name: "Innovators" }];
    const candidates = [
      {
        id: "c1",
        fullName: "Alice",
        accountId: "a1",
        positionId: "p1",
        partyId: "party-1",
        manifesto: "Platform",
        isActive: 1,
        imageUrl: null,
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    vi.mocked(electionRepo.findOpen).mockResolvedValue(openRow as any);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(null);
    vi.mocked(positionRepo.listByElection).mockResolvedValue(positions as any);
    vi.mocked(partyListRepo.listByElection).mockResolvedValue(parties as any);
    vi.mocked(candidateRepo.listForBallot).mockResolvedValue(candidates as any);
    vi.mocked(voterAccountStore.findByAccountId).mockResolvedValue(null);

    const result = await getVotingState(db, accountId, { includeBallot: true });

    expect(result.ballot).toEqual({ positions, parties, candidates });
    expect(positionRepo.listByElection).toHaveBeenCalledWith(db, "e-ballot");
    expect(partyListRepo.listByElection).toHaveBeenCalledWith(db, "e-ballot");
    expect(candidateRepo.listForBallot).toHaveBeenCalledWith(db, "e-ballot");
  });

  it("does not aggregate closed results when a usable open election exists", async () => {
    const nowSecs = Math.floor(Date.now() / 1000);
    const openRow = {
      id: "e-open-with-closed",
      name: "Current",
      description: null,
      status: "open",
      opensAt: nowSecs - 3600,
      closesAt: nowSecs + 3600,
      createdAt: 1,
      updatedAt: 1,
    };
    const closedRow = {
      id: "e-previous",
      name: "Previous",
      description: null,
      status: "closed",
      opensAt: nowSecs - 7200,
      closesAt: nowSecs - 3600,
      createdAt: 2,
      updatedAt: 2,
    };
    vi.mocked(electionRepo.findOpen).mockResolvedValue(openRow as any);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(closedRow as any);
    vi.mocked(electionQueries.getResults).mockResolvedValue([]);

    const result = await getVotingState(db, accountId);

    expect(result.open).toEqual(openRow);
    expect(result.lastClosed).toBeNull();
    expect(electionQueries.getResults).not.toHaveBeenCalled();
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

  it("keeps closesAt as null when closesAt is null on a draft row", async () => {
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

    expect(result.nextDraft?.closesAt).toBeNull();
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

  it("reuses closed results for the same election version across accounts", async () => {
    const closed = {
      id: "cache-c1",
      name: "Cached",
      description: null,
      status: "closed",
      opensAt: 1,
      closesAt: 200,
      createdAt: 2,
      updatedAt: 100,
    };
    const results = [
      {
        positionId: "p1",
        positionName: "President",
        totalVotes: 1,
        candidates: [],
      },
    ];
    vi.mocked(electionRepo.findOpen).mockResolvedValue(null);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(closed as any);
    vi.mocked(electionQueries.getResults).mockResolvedValue(results as any);

    await getVotingState(db, "acc-1");
    await getVotingState(db, "acc-2");

    expect(electionQueries.getResults).toHaveBeenCalledTimes(1);
  });

  it("refreshes closed results when the election version changes", async () => {
    const firstVersion = {
      id: "cache-c2",
      name: "Cached",
      description: null,
      status: "closed",
      opensAt: 1,
      closesAt: 200,
      createdAt: 2,
      updatedAt: 200,
    };
    const secondVersion = { ...firstVersion, updatedAt: 201 };
    vi.mocked(electionRepo.findOpen).mockResolvedValue(null);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed)
      .mockResolvedValueOnce(firstVersion as any)
      .mockResolvedValueOnce(secondVersion as any);
    vi.mocked(electionQueries.getResults).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await getVotingState(db, "acc-1");
    await getVotingState(db, "acc-1");

    expect(electionQueries.getResults).toHaveBeenCalledTimes(2);
  });

  it("returns user-scoped myVotes when an open election exists", async () => {
    const nowSecs = Math.floor(Date.now() / 1000);
    const openRow = {
      id: "e-open",
      name: "Now",
      description: null,
      status: "open",
      opensAt: nowSecs - 3600,
      closesAt: nowSecs + 3600,
      createdAt: 1,
      updatedAt: 1,
    };
    vi.mocked(electionRepo.findOpen).mockResolvedValue(openRow as any);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(null);
    vi.mocked(voterAccountStore.findByAccountId).mockResolvedValue(mockUser);
    vi.mocked(voteRepo.findByUserAndElection).mockResolvedValue([
      { candidateId: "c1", positionId: "p1" },
    ] as any);

    const result = await getVotingState(db, accountId);

    expect(result.myVotes).toEqual({
      electionId: "e-open",
      votes: [{ candidateId: "c1", positionId: "p1" }],
    });
    expect(voterAccountStore.findByAccountId).toHaveBeenCalledWith(db, accountId);
    expect(voteRepo.findByUserAndElection).toHaveBeenCalledWith(db, "user-1", "e-open");
  });

  it("returns empty myVotes when there is no open election even if the account has a user row", async () => {
    vi.mocked(electionRepo.findOpen).mockResolvedValue(null);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(null);

    const result = await getVotingState(db, accountId);

    expect(result.myVotes).toEqual({ electionId: null, votes: [] });
    expect(voterAccountStore.findByAccountId).not.toHaveBeenCalled();
  });

  it("returns empty myVotes when the account has no associated user", async () => {
    const nowSecs = Math.floor(Date.now() / 1000);
    const openRow = {
      id: "e-open",
      name: "Now",
      description: null,
      status: "open",
      opensAt: nowSecs - 3600,
      closesAt: nowSecs + 3600,
      createdAt: 1,
      updatedAt: 1,
    };
    vi.mocked(electionRepo.findOpen).mockResolvedValue(openRow as any);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(null);
    vi.mocked(voterAccountStore.findByAccountId).mockResolvedValue(null);

    const result = await getVotingState(db, accountId);

    expect(result.myVotes).toEqual({ electionId: "e-open", votes: [] });
    expect(voteRepo.findByUserAndElection).not.toHaveBeenCalled();
  });

  it("virtualizes open election to nextDraft when it has not started yet", async () => {
    const nowSecs = Math.floor(Date.now() / 1000);
    const openRow = {
      id: "e-upcoming",
      name: "Upcoming",
      description: null,
      status: "open",
      opensAt: nowSecs + 3600,
      closesAt: nowSecs + 7200,
      createdAt: 1,
      updatedAt: 1,
    };
    vi.mocked(electionRepo.findOpen).mockResolvedValue(openRow as any);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(null);

    const result = await getVotingState(db, accountId);

    expect(result.open).toBeNull();
    expect(result.nextDraft).toEqual({
      id: "e-upcoming",
      name: "Upcoming",
      opensAt: nowSecs + 3600,
      closesAt: nowSecs + 7200,
    });
  });

  it("does not expose an open election with a missing time bound", async () => {
    const nowSecs = Math.floor(Date.now() / 1000);
    const openRow = {
      id: "e-incomplete",
      name: "Incomplete",
      description: null,
      status: "open",
      opensAt: nowSecs - 3600,
      closesAt: null,
      createdAt: 1,
      updatedAt: 1,
    };
    vi.mocked(electionRepo.findOpen).mockResolvedValue(openRow as any);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(null);

    const result = await getVotingState(db, accountId);

    expect(result.open).toBeNull();
    expect(result.nextDraft).toBeNull();
    expect(result.lastClosed).toBeNull();
    expect(result.myVotes).toEqual({ electionId: null, votes: [] });
  });

  it("virtualizes open election to lastClosed when it has already ended", async () => {
    const nowSecs = Math.floor(Date.now() / 1000);
    const openRow = {
      id: "e-ended",
      name: "Ended",
      description: null,
      status: "open",
      opensAt: nowSecs - 7200,
      closesAt: nowSecs - 3600,
      createdAt: 1,
      updatedAt: 1,
    };
    vi.mocked(electionRepo.findOpen).mockResolvedValue(openRow as any);
    vi.mocked(electionRepo.findEarliestDraft).mockResolvedValue(null);
    vi.mocked(electionRepo.findLatestClosed).mockResolvedValue(null);
    vi.mocked(electionQueries.getResults).mockResolvedValue([
      {
        positionId: "p1",
        positionName: "President",
        totalVotes: 10,
        candidates: [{ candidateId: "c1", fullName: "Alice", voteCount: 10, percentage: 100 }],
      },
    ] as any);

    const result = await getVotingState(db, accountId);

    expect(result.open).toBeNull();
    expect(result.lastClosed).toEqual({
      id: "e-ended",
      name: "Ended",
      closesAt: nowSecs - 3600,
      results: [
        {
          positionId: "p1",
          positionName: "President",
          totalVotes: 10,
          candidates: [{ candidateId: "c1", fullName: "Alice", voteCount: 10, percentage: 100 }],
        },
      ],
    });
    expect(electionQueries.getResults).toHaveBeenCalledWith(db, "e-ended");
  });
});
