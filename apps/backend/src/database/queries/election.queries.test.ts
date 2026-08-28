import { beforeEach, describe, expect, it, vi } from "vitest";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import type { SQL } from "drizzle-orm";
import { electionQueries } from "./election.queries";
import { votes } from "@/database/schema";

const { mockFindCurrentlyOpen } = vi.hoisted(() => ({
  mockFindCurrentlyOpen: vi.fn(),
}));

vi.mock("@/database/repositories/election.repository", () => ({
  electionRepo: {
    findCurrentlyOpen: mockFindCurrentlyOpen,
  },
}));

const chain: any = {
  values: vi.fn(() => chain),
  set: vi.fn(() => chain),
  from: vi.fn(() => chain),
  where: vi.fn(() => chain),
  orderBy: vi.fn(() => chain),
  limit: vi.fn(() => chain),
  offset: vi.fn(() => chain),
  leftJoin: vi.fn(() => chain),
  innerJoin: vi.fn(() => chain),
  groupBy: vi.fn(() => chain),
  get: vi.fn(() => undefined),
  all: vi.fn(() => []),
  run: vi.fn(() => ({ rowsAffected: 1 })),
};
const mockDb = {
  insert: vi.fn(() => chain),
  update: vi.fn(() => chain),
  select: vi.fn(() => chain),
  delete: vi.fn(() => chain),
};
vi.mock("@/config/db", () => ({ createDb: () => ({ db: mockDb }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mockFindCurrentlyOpen.mockReset();
});

describe("electionQueries", () => {
  describe("getCurrentElection", () => {
    it("returns the open election with positions and active candidates nested", async () => {
      const election = {
        id: "e1",
        name: "CSO 2026",
        description: null,
        status: "open",
        opensAt: 1000,
        closesAt: 2000,
        createdAt: 500,
        updatedAt: 600,
      };
      mockFindCurrentlyOpen.mockResolvedValueOnce(election);
      chain.get.mockReturnValueOnce(election);
      chain.all.mockReturnValueOnce([
        {
          id: "p1",
          electionId: "e1",
          name: "President",
          displayOrder: 1,
          createdAt: 700,
          updatedAt: 700,
        },
      ]);
      chain.all.mockReturnValueOnce([
        {
          id: "c1",
          fullName: "Alice",
          accountId: "a1",
          positionId: "p1",
          manifesto: "M",
          isActive: 1,
          createdAt: 800,
          updatedAt: 800,
        },
      ]);

      const result = await electionQueries.getCurrentElection(mockDb as any);

      expect(result).toEqual({
        id: "e1",
        name: "CSO 2026",
        description: null,
        status: "open",
        opensAt: 1000,
        closesAt: 2000,
        createdAt: 500,
        updatedAt: 600,
        positions: [
          {
            id: "p1",
            name: "President",
            displayOrder: 1,
            candidates: [{ id: "c1", fullName: "Alice", isActive: 1, manifesto: "M" }],
          },
        ],
      });
    });

    it("returns null when there is no open election", async () => {
      mockFindCurrentlyOpen.mockResolvedValueOnce(null);
      const result = await electionQueries.getCurrentElection(mockDb as any);
      expect(result).toBeNull();
    });
  });

  describe("getElectionWithPositions", () => {
    it("returns the election with positions and active candidates nested", async () => {
      const election = {
        id: "e1",
        name: "CSO 2026",
        description: null,
        status: "draft",
        opensAt: null,
        closesAt: null,
        createdAt: 500,
        updatedAt: 600,
      };
      chain.get.mockReturnValueOnce(election);
      chain.all.mockReturnValueOnce([
        {
          id: "p1",
          electionId: "e1",
          name: "President",
          displayOrder: 1,
          createdAt: 700,
          updatedAt: 700,
        },
        { id: "p2", electionId: "e1", name: "VP", displayOrder: 2, createdAt: 700, updatedAt: 700 },
      ]);
      chain.all.mockReturnValueOnce([
        {
          id: "c1",
          fullName: "Alice",
          accountId: "a1",
          positionId: "p1",
          manifesto: "M1",
          isActive: 1,
          createdAt: 800,
          updatedAt: 800,
        },
        {
          id: "c2",
          fullName: "Bob",
          accountId: "a2",
          positionId: "p2",
          manifesto: "M2",
          isActive: 1,
          createdAt: 800,
          updatedAt: 800,
        },
      ]);

      const result = await electionQueries.getElectionWithPositions(mockDb as any, "e1");

      expect(result).toEqual({
        id: "e1",
        name: "CSO 2026",
        description: null,
        status: "draft",
        opensAt: null,
        closesAt: null,
        createdAt: 500,
        updatedAt: 600,
        positions: [
          {
            id: "p1",
            name: "President",
            displayOrder: 1,
            candidates: [{ id: "c1", fullName: "Alice", isActive: 1, manifesto: "M1" }],
          },
          {
            id: "p2",
            name: "VP",
            displayOrder: 2,
            candidates: [{ id: "c2", fullName: "Bob", isActive: 1, manifesto: "M2" }],
          },
        ],
      });
    });

    it("returns the election with empty positions when none exist", async () => {
      const election = {
        id: "e1",
        name: "CSO 2026",
        description: null,
        status: "draft",
        opensAt: null,
        closesAt: null,
        createdAt: 500,
        updatedAt: 600,
      };
      chain.get.mockReturnValueOnce(election);
      chain.all.mockReturnValueOnce([]);

      const result = await electionQueries.getElectionWithPositions(mockDb as any, "e1");

      expect(result).toEqual({
        id: "e1",
        name: "CSO 2026",
        description: null,
        status: "draft",
        opensAt: null,
        closesAt: null,
        createdAt: 500,
        updatedAt: 600,
        positions: [],
      });
    });

    it("returns null when the election does not exist", async () => {
      chain.get.mockReturnValueOnce(undefined);
      const result = await electionQueries.getElectionWithPositions(mockDb as any, "missing");
      expect(result).toBeNull();
    });
  });

  describe("countPositions", () => {
    it("returns 0 when no positions exist", async () => {
      chain.get.mockReturnValueOnce(undefined);
      expect(await electionQueries.countPositions(mockDb as any, "e1")).toBe(0);
    });

    it("returns the position count for the election", async () => {
      chain.get.mockReturnValueOnce({ count: 3 });
      expect(await electionQueries.countPositions(mockDb as any, "e1")).toBe(3);
    });

    it("counts positions that have active candidates", async () => {
      chain.get.mockReturnValueOnce({ count: 2 });
      expect(await electionQueries.countPositionsWithActiveCandidates(mockDb as any, "e1")).toBe(2);
    });
  });

  describe("getResults", () => {
    it("returns an empty array when the election has no positions", async () => {
      chain.all.mockReturnValueOnce([]);
      const result = await electionQueries.getResults(mockDb as any, "e1");
      expect(result).toEqual([]);
    });

    it("computes percentages per candidate within each position (3/1 votes => 75/25)", async () => {
      chain.all.mockReturnValueOnce([
        {
          positionId: "p1",
          positionName: "President",
          displayOrder: 1,
          candidateId: "c1",
          candidateName: "Alice",
          candidateImageUrl: "https://example.com/alice.jpg",
          partyName: "Leadership",
          partyCode: "LEAD",
          partyColor: "#3B82F6",
          voteCount: 3,
        },
        {
          positionId: "p1",
          positionName: "President",
          displayOrder: 1,
          candidateId: "c2",
          candidateName: "Bob",
          candidateImageUrl: null,
          partyName: null,
          partyCode: null,
          partyColor: null,
          voteCount: 1,
        },
      ]);

      const result = await electionQueries.getResults(mockDb as any, "e1");

      expect(result).toEqual([
        {
          positionId: "p1",
          positionName: "President",
          displayOrder: 1,
          totalVotes: 4,
          candidates: [
            {
              candidateId: "c1",
              fullName: "Alice",
              voteCount: 3,
              percentage: 75,
              imageUrl: "https://example.com/alice.jpg",
              partyName: "Leadership",
              partyCode: "LEAD",
              partyColor: "#3B82F6",
            },
            {
              candidateId: "c2",
              fullName: "Bob",
              voteCount: 1,
              percentage: 25,
              imageUrl: null,
              partyName: null,
              partyCode: null,
              partyColor: null,
            },
          ],
        },
      ]);
    });

    it("orders positions by displayOrder ASC, createdAt ASC, and voteCount DESC", async () => {
      chain.all.mockReturnValueOnce([]);
      await electionQueries.getResults(mockDb as any, "e1");
      expect(chain.orderBy).toHaveBeenCalled();
      const lastCallArgs = chain.orderBy.mock.calls[0];
      expect(lastCallArgs).toHaveLength(3);
    });

    it("scopes the vote join to the requested election", async () => {
      chain.all.mockReturnValueOnce([]);
      await electionQueries.getResults(mockDb as any, "e1");

      const voteJoin = chain.leftJoin.mock.calls.find(
        ([table]: [unknown, unknown]) => table === votes,
      ) as [typeof votes, SQL] | undefined;
      expect(voteJoin).toBeDefined();
      const query = new SQLiteSyncDialect().sqlToQuery(voteJoin![1]);
      expect(query.sql).toContain('"votes"."election_id" = ?');
      expect(query.params).toContain("e1");
    });
  });

  describe("getTurnout", () => {
    it("calculates turnout percentage from the persisted denominator and ballots cast", async () => {
      chain.get
        .mockReturnValueOnce({ eligibleVotersCount: 100 })
        .mockReturnValueOnce({ count: 75 })
        .mockReturnValueOnce({ count: 75 })
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 75 });
      const result = await electionQueries.getTurnout(mockDb as any, "e1");
      expect(result).toEqual({
        electionId: "e1",
        totalEligibleVoters: 100,
        totalBallotsCast: 75,
        turnoutPercentage: 75,
      });
    });

    it("returns 0% turnout when total eligible voters is 0", async () => {
      chain.get
        .mockReturnValueOnce({ eligibleVotersCount: 0 })
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 0 });
      const result = await electionQueries.getTurnout(mockDb as any, "e1");
      expect(result).toEqual({
        electionId: "e1",
        totalEligibleVoters: 0,
        totalBallotsCast: 0,
        turnoutPercentage: 0,
      });
    });

    it("uses durable participation for legacy ballots and leaves turnout unavailable without a roster snapshot", async () => {
      chain.get
        .mockReturnValueOnce({ eligibleVotersCount: null })
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 3 })
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 6 });

      await expect(electionQueries.getTurnout(mockDb as any, "e1")).resolves.toEqual({
        electionId: "e1",
        totalEligibleVoters: null,
        totalBallotsCast: 3,
        turnoutPercentage: null,
      });
    });

    it("uses disjoint legacy linked ballots instead of overlapping snapshots", async () => {
      chain.get
        .mockReturnValueOnce({ eligibleVotersCount: 100 })
        .mockReturnValueOnce({ count: 2 })
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 3 })
        .mockReturnValueOnce({ count: 6 });

      await expect(electionQueries.getTurnout(mockDb as any, "e1")).resolves.toEqual({
        electionId: "e1",
        totalEligibleVoters: 100,
        totalBallotsCast: 3,
        turnoutPercentage: 3,
      });
    });

    it("combines migrated participation with newer snapshots without double counting", async () => {
      chain.get
        .mockReturnValueOnce({ eligibleVotersCount: 100 })
        .mockReturnValueOnce({ count: 4 })
        .mockReturnValueOnce({ count: 7 })
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 6 });

      await expect(electionQueries.getTurnout(mockDb as any, "e1")).resolves.toEqual({
        electionId: "e1",
        totalEligibleVoters: 100,
        totalBallotsCast: 7,
        turnoutPercentage: 7,
      });
    });

    it("leaves turnout unavailable for anonymous vote rows without a durable count", async () => {
      chain.get
        .mockReturnValueOnce({ eligibleVotersCount: 100 })
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 6 });

      await expect(electionQueries.getTurnout(mockDb as any, "e1")).resolves.toEqual({
        electionId: "e1",
        totalEligibleVoters: 100,
        totalBallotsCast: null,
        turnoutPercentage: null,
      });
    });
  });
});
