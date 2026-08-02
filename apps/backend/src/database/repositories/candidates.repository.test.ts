import { beforeEach, describe, expect, it, vi } from "vitest";

// Spy on Drizzle operators so tests can verify the built where clauses
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn(actual.eq),
    and: vi.fn(actual.and),
    inArray: vi.fn(actual.inArray),
    ne: vi.fn(actual.ne),
    desc: vi.fn(actual.desc),
    count: vi.fn(actual.count),
  };
});

import { and, eq, inArray, ne } from "drizzle-orm";
import { candidates, elections, positions } from "@/database/schema";
import { candidateRepo } from "./candidates.repository";

function createMockChain() {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    groupBy: vi.fn(() => chain),
    all: vi.fn(() => []),
    get: vi.fn(() => undefined),
    run: vi.fn(() => ({ rowsAffected: 1 })),
    values: vi.fn(() => chain),
    set: vi.fn(() => chain),
  };
  return chain;
}

const dataQueryChain = createMockChain();
const countQueryChain = createMockChain();

const mockDb = {
  select: vi.fn((arg) => {
    // If selecting count, return countQueryChain, otherwise dataQueryChain
    if (arg && typeof arg === "object" && "count" in arg) {
      return countQueryChain;
    }
    return dataQueryChain;
  }),
  insert: vi.fn(() => dataQueryChain),
  update: vi.fn(() => dataQueryChain),
};

describe("candidateRepo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dataQueryChain.from.mockReturnValue(dataQueryChain);
    dataQueryChain.where.mockReturnValue(dataQueryChain);
    dataQueryChain.orderBy.mockReturnValue(dataQueryChain);
    dataQueryChain.limit.mockReturnValue(dataQueryChain);
    dataQueryChain.offset.mockReturnValue(dataQueryChain);
    dataQueryChain.leftJoin.mockReturnValue(dataQueryChain);
    dataQueryChain.innerJoin.mockReturnValue(dataQueryChain);
    dataQueryChain.groupBy.mockReturnValue(dataQueryChain);
    dataQueryChain.all.mockReturnValue([]);
    dataQueryChain.get.mockReturnValue(undefined);
    dataQueryChain.run.mockReturnValue({ rowsAffected: 1 });
    dataQueryChain.values.mockReturnValue(dataQueryChain);
    dataQueryChain.set.mockReturnValue(dataQueryChain);

    countQueryChain.from.mockReturnValue(countQueryChain);
    countQueryChain.innerJoin.mockReturnValue(countQueryChain);
    countQueryChain.where.mockReturnValue(countQueryChain);
    countQueryChain.get.mockReturnValue({ count: 0 });
  });

  describe("listForAdminTable (query branch & metadata parity)", () => {
    it("Branch 1: default options filter by active candidates (includeInactive=false, positionId=undefined)", async () => {
      dataQueryChain.all.mockResolvedValueOnce([{ id: "c1" }]);
      countQueryChain.get.mockResolvedValueOnce({ count: 1 });

      const result = await candidateRepo.listForAdminTable(mockDb as any);

      expect(eq).toHaveBeenCalledWith(candidates.isActive, 1);
      expect(dataQueryChain.where).toHaveBeenCalled();
      expect(countQueryChain.where).toHaveBeenCalled();
      expect(result.data).toEqual([{ id: "c1" }]);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });

    it("Branch 2: includeInactive=true without positionId omits where clause completely", async () => {
      dataQueryChain.all.mockResolvedValueOnce([{ id: "c1" }, { id: "c2" }]);
      countQueryChain.get.mockResolvedValueOnce({ count: 2 });

      const result = await candidateRepo.listForAdminTable(mockDb as any, {
        includeInactive: true,
      });

      expect(dataQueryChain.where).not.toHaveBeenCalled();
      expect(countQueryChain.where).not.toHaveBeenCalled();
      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 10, totalPages: 1 });
    });

    it("Branch 3: includeInactive=false with positionId applies AND condition", async () => {
      dataQueryChain.all.mockResolvedValueOnce([{ id: "c1", positionId: "p1" }]);
      countQueryChain.get.mockResolvedValueOnce({ count: 1 });

      const result = await candidateRepo.listForAdminTable(mockDb as any, {
        includeInactive: false,
        positionId: "p1",
      });

      expect(and).toHaveBeenCalled();
      expect(eq).toHaveBeenCalledWith(candidates.positionId, "p1");
      expect(dataQueryChain.where).toHaveBeenCalled();
      expect(countQueryChain.where).toHaveBeenCalled();
      expect(result.data).toEqual([{ id: "c1", positionId: "p1" }]);
    });

    it("Branch 4: includeInactive=true with positionId filters by positionId only", async () => {
      dataQueryChain.all.mockResolvedValueOnce([{ id: "c2", positionId: "p1" }]);
      countQueryChain.get.mockResolvedValueOnce({ count: 1 });

      const result = await candidateRepo.listForAdminTable(mockDb as any, {
        includeInactive: true,
        positionId: "p1",
      });

      expect(eq).toHaveBeenCalledWith(candidates.positionId, "p1");
      expect(dataQueryChain.where).toHaveBeenCalled();
      expect(countQueryChain.where).toHaveBeenCalled();
      expect(result.data).toEqual([{ id: "c2", positionId: "p1" }]);
    });

    it("calculates pagination metadata correctly for multiline pages", async () => {
      dataQueryChain.all.mockResolvedValueOnce([{ id: "c6" }]);
      countQueryChain.get.mockResolvedValueOnce({ count: 12 });

      const result = await candidateRepo.listForAdminTable(mockDb as any, {
        page: 2,
        limit: 5,
      });

      expect(dataQueryChain.limit).toHaveBeenCalledWith(5);
      expect(dataQueryChain.offset).toHaveBeenCalledWith(5);
      expect(result.meta).toEqual({ total: 12, page: 2, limit: 5, totalPages: 3 });
    });
  });

  it("excludes candidates from draft elections when requested", async () => {
    dataQueryChain.all.mockResolvedValueOnce([]);
    countQueryChain.get.mockResolvedValueOnce({ count: 0 });

    await candidateRepo.listForAdminTable(mockDb as any, { excludeDraft: true });

    expect(dataQueryChain.innerJoin).toHaveBeenCalledWith(positions, expect.anything());
    expect(dataQueryChain.innerJoin).toHaveBeenCalledWith(elections, expect.anything());
    expect(countQueryChain.innerJoin).toHaveBeenCalledWith(positions, expect.anything());
    expect(countQueryChain.innerJoin).toHaveBeenCalledWith(elections, expect.anything());
    expect(ne).toHaveBeenCalledWith(elections.status, "draft");
  });

  describe("listForBallot", () => {
    it("fetches active candidates with minimal fields", async () => {
      dataQueryChain.all.mockResolvedValueOnce([
        { id: "c1", fullName: "Alice", positionId: "p1", partyId: null },
      ]);

      const result = await candidateRepo.listForBallot(mockDb as any);

      expect(eq).toHaveBeenCalledWith(candidates.isActive, 1);
      expect(result).toHaveLength(1);
    });
  });

  describe("getForValidation", () => {
    it("returns candidate minimal validation row or null", async () => {
      dataQueryChain.get.mockResolvedValueOnce({ id: "c1", positionId: "p1" });
      expect(await candidateRepo.getForValidation(mockDb as any, "c1")).toEqual({
        id: "c1",
        positionId: "p1",
      });
      expect(eq).toHaveBeenCalledWith(candidates.id, "c1");
      expect(eq).toHaveBeenCalledWith(candidates.isActive, 1);
      expect(and).toHaveBeenCalled();

      vi.clearAllMocks();
      dataQueryChain.get.mockResolvedValueOnce(undefined);
      expect(await candidateRepo.getForValidation(mockDb as any, "c2")).toBeNull();
      expect(eq).toHaveBeenCalledWith(candidates.id, "c2");
      expect(eq).toHaveBeenCalledWith(candidates.isActive, 1);
      expect(and).toHaveBeenCalled();
    });
  });

  describe("getForAdminView", () => {
    it("queries active-only candidate by default", async () => {
      dataQueryChain.get.mockResolvedValueOnce({ id: "c1", fullName: "Alice", isActive: 1 });

      const res = await candidateRepo.getForAdminView(mockDb as any, "c1");

      expect(eq).toHaveBeenCalledWith(candidates.id, "c1");
      expect(eq).toHaveBeenCalledWith(candidates.isActive, 1);
      expect(and).toHaveBeenCalled();
      expect(res?.id).toBe("c1");
    });

    it("queries inactive candidate when includeInactive=true", async () => {
      dataQueryChain.get.mockResolvedValueOnce({ id: "c2", fullName: "Bob", isActive: 0 });

      const res = await candidateRepo.getForAdminView(mockDb as any, "c2", {
        includeInactive: true,
      });

      expect(eq).toHaveBeenCalledWith(candidates.id, "c2");
      expect(res?.isActive).toBe(0);
    });
  });

  it("excludes a candidate from a draft election when requested", async () => {
    dataQueryChain.get.mockResolvedValueOnce(undefined);

    const result = await candidateRepo.getForAdminView(mockDb as any, "c1", {
      excludeDraft: true,
    });

    expect(result).toBeNull();
    expect(dataQueryChain.innerJoin).toHaveBeenCalledWith(positions, expect.anything());
    expect(dataQueryChain.innerJoin).toHaveBeenCalledWith(elections, expect.anything());
    expect(ne).toHaveBeenCalledWith(elections.status, "draft");
  });

  describe("counts & batch lookups", () => {
    it("countActive returns count or 0 default", async () => {
      countQueryChain.get.mockResolvedValueOnce({ count: 4 });
      expect(await candidateRepo.countActive(mockDb as any)).toBe(4);

      countQueryChain.get.mockResolvedValueOnce(null);
      expect(await candidateRepo.countActive(mockDb as any)).toBe(0);
    });

    it("countByPositionId respects includeInactive option", async () => {
      countQueryChain.get.mockResolvedValueOnce({ count: 2 });
      expect(await candidateRepo.countByPositionId(mockDb as any, "p1")).toBe(2);
      expect(eq).toHaveBeenCalledWith(candidates.positionId, "p1");
      expect(eq).toHaveBeenCalledWith(candidates.isActive, 1);
      expect(and).toHaveBeenCalled();

      vi.clearAllMocks();
      countQueryChain.get.mockResolvedValueOnce({ count: 3 });
      expect(
        await candidateRepo.countByPositionId(mockDb as any, "p1", { includeInactive: true }),
      ).toBe(3);
      expect(eq).toHaveBeenCalledWith(candidates.positionId, "p1");
      expect(eq).not.toHaveBeenCalledWith(candidates.isActive, 1);
    });

    it("findActiveByIds returns Map keyed by candidate ID", async () => {
      dataQueryChain.all.mockResolvedValueOnce([
        { id: "c1", positionId: "p1" },
        { id: "c2", positionId: "p2" },
      ]);

      const map = await candidateRepo.findActiveByIds(mockDb as any, ["c1", "c2"]);

      expect(inArray).toHaveBeenCalledWith(candidates.id, ["c1", "c2"]);
      expect(map.size).toBe(2);
      expect(map.get("c1")).toEqual({ id: "c1", positionId: "p1" });
    });
  });

  describe("mutations", () => {
    it("create inserts candidate with generated UUID", async () => {
      const id = await candidateRepo.create(mockDb as any, {
        fullName: "Alice Smith",
        accountId: "acc-1",
        positionId: "pos-1",
        manifesto: "Vote Alice",
      });

      expect(typeof id).toBe("string");
      expect(mockDb.insert).toHaveBeenCalledWith(candidates);
      expect(dataQueryChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: "Alice Smith",
          accountId: "acc-1",
          positionId: "pos-1",
          manifesto: "Vote Alice",
          isActive: 1,
        }),
      );
    });

    it("update sets updated fields and updates timestamp", async () => {
      dataQueryChain.run.mockReturnValueOnce({ rowsAffected: 1 });

      const updated = await candidateRepo.update(mockDb as any, "c1", { fullName: "Alice B." });

      expect(updated).toBe(true);
      expect(mockDb.update).toHaveBeenCalledWith(candidates);
      expect(dataQueryChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: "Alice B.",
          updatedAt: expect.any(Number),
        }),
      );
      expect(eq).toHaveBeenCalledWith(candidates.id, "c1");
      expect(dataQueryChain.where).toHaveBeenCalled();
    });

    it("updateImageUrl updates imageUrl column", async () => {
      dataQueryChain.run.mockReturnValueOnce({ rowsAffected: 1 });

      expect(await candidateRepo.updateImageUrl(mockDb as any, "c1", "https://img.com/a.jpg")).toBe(
        true,
      );
      expect(mockDb.update).toHaveBeenCalledWith(candidates);
      expect(dataQueryChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl: "https://img.com/a.jpg",
          updatedAt: expect.any(Number),
        }),
      );
      expect(eq).toHaveBeenCalledWith(candidates.id, "c1");
      expect(dataQueryChain.where).toHaveBeenCalled();
    });

    it("softDelete sets isActive=0", async () => {
      dataQueryChain.run.mockReturnValueOnce({ rowsAffected: 1 });

      expect(await candidateRepo.softDelete(mockDb as any, "c1")).toBe(true);
      expect(mockDb.update).toHaveBeenCalledWith(candidates);
      expect(dataQueryChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: 0,
          updatedAt: expect.any(Number),
        }),
      );
      expect(eq).toHaveBeenCalledWith(candidates.id, "c1");
      expect(dataQueryChain.where).toHaveBeenCalled();
    });
  });

  describe("predicate queries & vote counting", () => {
    it("existsActiveForAccountPosition checks active record existence", async () => {
      dataQueryChain.get.mockResolvedValueOnce({ id: "c1" });
      expect(await candidateRepo.existsActiveForAccountPosition(mockDb as any, "a1", "p1")).toBe(
        true,
      );
      expect(eq).toHaveBeenCalledWith(candidates.accountId, "a1");
      expect(eq).toHaveBeenCalledWith(candidates.positionId, "p1");
      expect(eq).toHaveBeenCalledWith(candidates.isActive, 1);
      expect(and).toHaveBeenCalled();

      vi.clearAllMocks();
      dataQueryChain.get.mockResolvedValueOnce(undefined);
      expect(await candidateRepo.existsActiveForAccountPosition(mockDb as any, "a2", "p1")).toBe(
        false,
      );
      expect(eq).toHaveBeenCalledWith(candidates.accountId, "a2");
      expect(eq).toHaveBeenCalledWith(candidates.positionId, "p1");
      expect(eq).toHaveBeenCalledWith(candidates.isActive, 1);
      expect(and).toHaveBeenCalled();
    });

    it("existsActiveForPartyPosition filters active candidates and excludes the candidate being updated", async () => {
      dataQueryChain.get.mockResolvedValueOnce({ id: "c2" });

      expect(
        await candidateRepo.existsActiveForPartyPosition(mockDb as any, "party-1", "p1", "c1"),
      ).toBe(true);

      expect(eq).toHaveBeenCalledWith(candidates.partyId, "party-1");
      expect(eq).toHaveBeenCalledWith(candidates.positionId, "p1");
      expect(eq).toHaveBeenCalledWith(candidates.isActive, 1);
      expect(ne).toHaveBeenCalledWith(candidates.id, "c1");
      expect(and).toHaveBeenCalled();
    });

    it("isCandidate checks account candidate existence", async () => {
      dataQueryChain.get.mockResolvedValueOnce({ id: "c1" });
      expect(await candidateRepo.isCandidate(mockDb as any, "a1")).toBe(true);
      expect(eq).toHaveBeenCalledWith(candidates.accountId, "a1");

      vi.clearAllMocks();
      dataQueryChain.get.mockResolvedValueOnce(undefined);
      expect(await candidateRepo.isCandidate(mockDb as any, "a2")).toBe(false);
      expect(eq).toHaveBeenCalledWith(candidates.accountId, "a2");
    });

    it("listWithVoteCount runs left join query for candidate votes", async () => {
      dataQueryChain.all.mockResolvedValueOnce([
        {
          candidateId: "c1",
          candidateName: "Alice",
          positionId: "p1",
          positionName: "President",
          voteCount: 10,
        },
      ]);

      const list = await candidateRepo.listWithVoteCount(mockDb as any);

      expect(dataQueryChain.leftJoin).toHaveBeenCalledTimes(2);
      expect(dataQueryChain.groupBy).toHaveBeenCalled();
      expect(list).toHaveLength(1);
      expect(list[0].voteCount).toBe(10);
    });
  });
});
