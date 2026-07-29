import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatUrl, candidateStore, type CandidateRow } from "./candidate-store";
import { candidateRepo } from "./candidates.repository";

vi.mock("./candidates.repository", () => ({
  candidateRepo: {
    getForAdminView: vi.fn(),
    listForAdminTable: vi.fn(),
    listForBallot: vi.fn(),
    getForValidation: vi.fn(),
    countActive: vi.fn(),
    countByPositionId: vi.fn(),
    findActiveByIds: vi.fn(),
    existsActiveForAccountPosition: vi.fn(),
    isCandidate: vi.fn(),
    listWithVoteCount: vi.fn(),
    updateImageUrl: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock("@/lib/b2-client", () => ({
  resolveCandidateImageUrl: vi.fn((url: string | null, id: string, _env: any, _reqUrl: string) =>
    url ? `https://resolved.com/candidates/${id}/image` : null,
  ),
}));

const sampleCandidate: CandidateRow = {
  id: "cand-1",
  fullName: "Alice Smith",
  accountId: "acc-1",
  positionId: "pos-1",
  partyId: "party-1",
  manifesto: "Vote for Alice",
  isActive: 1,
  imageUrl: "https://b2.com/bucket/candidates/cand-1/pic.jpg",
  createdAt: 1700000000,
  updatedAt: 1700000000,
};

const mockDb = {} as any;

describe("candidate-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("formatUrl", () => {
    it("returns null when candidate is null", () => {
      expect(formatUrl(null)).toBeNull();
      expect(formatUrl(null, { env: {}, requestUrl: "http://localhost/api" })).toBeNull();
    });

    it("returns candidate with raw imageUrl when urlCtx is missing or incomplete", () => {
      expect(formatUrl(sampleCandidate)).toEqual(sampleCandidate);
      expect(formatUrl(sampleCandidate, {})).toEqual(sampleCandidate);
      expect(formatUrl(sampleCandidate, { env: {} })).toEqual(sampleCandidate);
      expect(formatUrl(sampleCandidate, { requestUrl: "http://localhost" })).toEqual(
        sampleCandidate,
      );
    });

    it("resolves imageUrl when urlCtx contains env and requestUrl", () => {
      const urlCtx = {
        env: { B2_BUCKET_NAME: "test-bucket" },
        requestUrl: "http://localhost:3001/candidates",
      };
      const formatted = formatUrl(sampleCandidate, urlCtx);
      expect(formatted).toEqual({
        ...sampleCandidate,
        imageUrl: "https://resolved.com/candidates/cand-1/image",
      });
    });
  });

  describe("candidateStore methods", () => {
    it("findById / getForAdminView delegates to candidateRepo and formats image URL", async () => {
      vi.mocked(candidateRepo.getForAdminView).mockResolvedValueOnce(sampleCandidate);
      const urlCtx = {
        env: { B2_BUCKET_NAME: "b" },
        requestUrl: "http://localhost/candidates",
      };

      const result = await candidateStore.findById(
        mockDb,
        "cand-1",
        { includeInactive: true },
        urlCtx,
      );

      expect(candidateRepo.getForAdminView).toHaveBeenCalledWith(mockDb, "cand-1", {
        includeInactive: true,
      });
      expect(result?.imageUrl).toBe("https://resolved.com/candidates/cand-1/image");

      vi.mocked(candidateRepo.getForAdminView).mockResolvedValueOnce(sampleCandidate);
      const adminViewResult = await candidateStore.getForAdminView(mockDb, "cand-1", {}, urlCtx);
      expect(adminViewResult?.imageUrl).toBe("https://resolved.com/candidates/cand-1/image");
    });

    it("listForAdminTable delegates to candidateRepo and formats mapped candidates", async () => {
      vi.mocked(candidateRepo.listForAdminTable).mockResolvedValueOnce({
        data: [sampleCandidate],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });
      const urlCtx = {
        env: { B2_BUCKET_NAME: "b" },
        requestUrl: "http://localhost/candidates",
      };

      const result = await candidateStore.listForAdminTable(
        mockDb,
        { page: 1, limit: 10, positionId: "pos-1" },
        urlCtx,
      );

      expect(candidateRepo.listForAdminTable).toHaveBeenCalledWith(mockDb, {
        page: 1,
        limit: 10,
        positionId: "pos-1",
      });
      expect(result.data[0].imageUrl).toBe("https://resolved.com/candidates/cand-1/image");
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 });
    });

    it("delegates read and count helper methods directly to candidateRepo", async () => {
      vi.mocked(candidateRepo.listForBallot).mockResolvedValueOnce([
        { id: "cand-1", fullName: "Alice", positionId: "pos-1", partyId: null },
      ]);
      expect(await candidateStore.listForBallot(mockDb)).toHaveLength(1);
      expect(candidateRepo.listForBallot).toHaveBeenCalledWith(mockDb);

      vi.mocked(candidateRepo.getForValidation).mockResolvedValueOnce({
        id: "cand-1",
        positionId: "pos-1",
      });
      expect(await candidateStore.getForValidation(mockDb, "cand-1")).toEqual({
        id: "cand-1",
        positionId: "pos-1",
      });
      expect(candidateRepo.getForValidation).toHaveBeenCalledWith(mockDb, "cand-1");

      vi.mocked(candidateRepo.countActive).mockResolvedValueOnce(5);
      expect(await candidateStore.countActive(mockDb)).toBe(5);
      expect(candidateRepo.countActive).toHaveBeenCalledWith(mockDb);

      vi.mocked(candidateRepo.countByPositionId).mockResolvedValueOnce(2);
      expect(
        await candidateStore.countByPositionId(mockDb, "pos-1", { includeInactive: true }),
      ).toBe(2);
      expect(candidateRepo.countByPositionId).toHaveBeenCalledWith(mockDb, "pos-1", {
        includeInactive: true,
      });

      const mapResult = new Map([["cand-1", { id: "cand-1", positionId: "pos-1" }]]);
      vi.mocked(candidateRepo.findActiveByIds).mockResolvedValueOnce(mapResult);
      expect(await candidateStore.findActiveByIds(mockDb, ["cand-1"])).toBe(mapResult);
      expect(candidateRepo.findActiveByIds).toHaveBeenCalledWith(mockDb, ["cand-1"]);

      vi.mocked(candidateRepo.existsActiveForAccountPosition).mockResolvedValueOnce(true);
      expect(await candidateStore.existsActiveForAccountPosition(mockDb, "acc-1", "pos-1")).toBe(
        true,
      );
      expect(candidateRepo.existsActiveForAccountPosition).toHaveBeenCalledWith(
        mockDb,
        "acc-1",
        "pos-1",
      );

      vi.mocked(candidateRepo.isCandidate).mockResolvedValueOnce(true);
      expect(await candidateStore.isCandidate(mockDb, "acc-1")).toBe(true);
      expect(candidateRepo.isCandidate).toHaveBeenCalledWith(mockDb, "acc-1");

      vi.mocked(candidateRepo.listWithVoteCount).mockResolvedValueOnce([]);
      expect(await candidateStore.listWithVoteCount(mockDb)).toEqual([]);
      expect(candidateRepo.listWithVoteCount).toHaveBeenCalledWith(mockDb);

      vi.mocked(candidateRepo.updateImageUrl).mockResolvedValueOnce(true);
      expect(await candidateStore.updateImageUrl(mockDb, "cand-1", "new-url")).toBe(true);
      expect(candidateRepo.updateImageUrl).toHaveBeenCalledWith(mockDb, "cand-1", "new-url");

      vi.mocked(candidateRepo.softDelete).mockResolvedValueOnce(true);
      expect(await candidateStore.softDelete(mockDb, "cand-1")).toBe(true);
      expect(candidateRepo.softDelete).toHaveBeenCalledWith(mockDb, "cand-1");
    });
  });
});
