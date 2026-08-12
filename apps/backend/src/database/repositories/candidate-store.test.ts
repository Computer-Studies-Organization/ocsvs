import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatUrl, candidateStore, type CandidateRow } from "./candidate-store";
import { candidateRepo } from "./candidates.repository";

vi.mock("./candidates.repository", () => ({
  candidateRepo: {
    getForAdminView: vi.fn(),
    listForAdminTable: vi.fn(),
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
  userId: "user-1",
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
    it("findById delegates to candidateRepo and formats image URL", async () => {
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
  });
});
