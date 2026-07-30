import { beforeEach, describe, expect, it, vi } from "vitest";
import { candidateLifecycleCoordinator } from "./candidate-lifecycle-coordinator";
import { ImageValidationError } from "@/lib/b2-client";

const {
  mockCandidateFindActiveByIds,
  mockCandidateExistsActive,
  mockCandidateCreate,
  mockCandidateUpdate,
  mockCandidateUpdateImageUrl,
  mockCandidateSoftDelete,
  mockCandidateGetForAdminView,
  mockPositionFindById,
  mockElectionFindById,
  mockPartyFindById,
  mockAuditInsert,
  mockSelectGet,
} = vi.hoisted(() => ({
  mockCandidateFindActiveByIds: vi.fn(),
  mockCandidateExistsActive: vi.fn(),
  mockCandidateCreate: vi.fn(),
  mockCandidateUpdate: vi.fn(),
  mockCandidateUpdateImageUrl: vi.fn(),
  mockCandidateSoftDelete: vi.fn(),
  mockCandidateGetForAdminView: vi.fn(),
  mockPositionFindById: vi.fn(),
  mockElectionFindById: vi.fn(),
  mockPartyFindById: vi.fn(),
  mockAuditInsert: vi.fn(),
  mockSelectGet: vi.fn(),
}));

vi.mock("@/database/repositories/candidates.repository", () => ({
  candidateRepo: {
    findActiveByIds: mockCandidateFindActiveByIds,
    existsActiveForAccountPosition: mockCandidateExistsActive,
    create: mockCandidateCreate,
    update: mockCandidateUpdate,
    updateImageUrl: mockCandidateUpdateImageUrl,
    softDelete: mockCandidateSoftDelete,
    getForAdminView: mockCandidateGetForAdminView,
  },
}));

vi.mock("@/database/repositories/position.repository", () => ({
  positionRepo: {
    findById: mockPositionFindById,
  },
}));

vi.mock("@/database/repositories/election.repository", () => ({
  electionRepo: {
    findById: mockElectionFindById,
  },
}));

vi.mock("@/database/repositories/party-list.repository", () => ({
  partyListRepo: {
    findById: mockPartyFindById,
  },
}));

vi.mock("@/database/repositories/audit-log.repository", () => ({
  auditLogRepo: {
    insert: mockAuditInsert,
  },
}));

const mockTx: any = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        get: mockSelectGet,
      })),
    })),
  })),
};

const mockDb: any = {
  transaction: vi.fn(async (cb) => await cb(mockTx)),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        get: mockSelectGet,
      })),
    })),
  })),
};

const mockStorage: any = {
  upload: vi.fn(),
  delete: vi.fn(),
};

describe("CandidateLifecycleCoordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("successfully creates a candidate, checking invariants and writing audit log", async () => {
      mockSelectGet.mockResolvedValueOnce({ id: "acc-id" }); // account exists
      mockPositionFindById.mockResolvedValueOnce({ id: "pos-id", electionId: "el-id" }); // position exists
      mockElectionFindById.mockResolvedValueOnce({ id: "el-id", status: "draft" }); // election draft
      mockCandidateExistsActive.mockResolvedValueOnce(false); // candidate doesn't exist yet
      mockCandidateCreate.mockResolvedValueOnce("cand-uuid");
      mockCandidateGetForAdminView.mockResolvedValueOnce({
        id: "cand-uuid",
        fullName: "Juan Dela Cruz",
        accountId: "acc-id",
        positionId: "pos-id",
        partyId: null,
        manifesto: "No to corruption",
        isActive: 1,
        imageUrl: null,
        createdAt: 1000,
        updatedAt: 1000,
      });

      const result = await candidateLifecycleCoordinator.create(
        mockDb,
        {
          fullName: "Juan Dela Cruz",
          accountId: "acc-id",
          positionId: "pos-id",
          manifesto: "No to corruption",
        },
        { id: "admin-id", username: "admin" },
      );

      expect(result.id).toBe("cand-uuid");
      expect(mockCandidateCreate).toHaveBeenCalledWith(mockTx, {
        fullName: "Juan Dela Cruz",
        accountId: "acc-id",
        positionId: "pos-id",
        manifesto: "No to corruption",
      });
      expect(mockAuditInsert).toHaveBeenCalledWith(mockTx, {
        action: "candidate.create",
        targetType: "candidate",
        targetId: "cand-uuid",
        actorAccountIdSnapshot: "admin-id",
        actorUsernameSnapshot: "admin",
      });
    });

    it("throws ACCOUNT_NOT_FOUND when account does not exist", async () => {
      mockSelectGet.mockResolvedValueOnce(undefined); // account doesn't exist

      await expect(
        candidateLifecycleCoordinator.create(
          mockDb,
          {
            fullName: "Juan Dela Cruz",
            accountId: "acc-id",
            positionId: "pos-id",
            manifesto: "Manifesto",
          },
          { id: "admin-id", username: "admin" },
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "ACCOUNT_NOT_FOUND", status: 400 }));
    });

    it("throws POSITION_NOT_FOUND when position does not exist", async () => {
      mockSelectGet.mockResolvedValueOnce({ id: "acc-id" });
      mockPositionFindById.mockResolvedValueOnce(null);

      await expect(
        candidateLifecycleCoordinator.create(
          mockDb,
          {
            fullName: "Juan Dela Cruz",
            accountId: "acc-id",
            positionId: "pos-id",
            manifesto: "Manifesto",
          },
          { id: "admin-id", username: "admin" },
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "POSITION_NOT_FOUND", status: 404 }));
    });

    it("throws ELECTION_NOT_IN_DRAFT when election is not in draft status", async () => {
      mockSelectGet.mockResolvedValueOnce({ id: "acc-id" });
      mockPositionFindById.mockResolvedValueOnce({ id: "pos-id", electionId: "el-id" });
      mockElectionFindById.mockResolvedValueOnce({ id: "el-id", status: "open" });

      await expect(
        candidateLifecycleCoordinator.create(
          mockDb,
          {
            fullName: "Juan",
            accountId: "acc-id",
            positionId: "pos-id",
            manifesto: "Manifesto",
          },
          { id: "admin-id", username: "admin" },
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "ELECTION_NOT_IN_DRAFT", status: 409 }));
    });

    it("throws CANDIDATE_ALREADY_EXISTS when candidate is already registered for position", async () => {
      mockSelectGet.mockResolvedValueOnce({ id: "acc-id" });
      mockPositionFindById.mockResolvedValueOnce({ id: "pos-id", electionId: "el-id" });
      mockElectionFindById.mockResolvedValueOnce({ id: "el-id", status: "draft" });
      mockCandidateExistsActive.mockResolvedValueOnce(true);

      await expect(
        candidateLifecycleCoordinator.create(
          mockDb,
          {
            fullName: "Juan",
            accountId: "acc-id",
            positionId: "pos-id",
            manifesto: "Manifesto",
          },
          { id: "admin-id", username: "admin" },
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "CANDIDATE_ALREADY_EXISTS", status: 409 }));
    });

    it("creates a candidate with a party from the position's election", async () => {
      mockSelectGet.mockResolvedValueOnce({ id: "acc-id" });
      mockPositionFindById.mockResolvedValueOnce({ id: "pos-id", electionId: "el-id" });
      mockElectionFindById.mockResolvedValueOnce({ id: "el-id", status: "draft" });
      mockPartyFindById.mockResolvedValueOnce({ id: "party-id", electionId: "el-id" });
      mockCandidateExistsActive.mockResolvedValueOnce(false);
      mockCandidateCreate.mockResolvedValueOnce("cand-id");
      mockCandidateGetForAdminView.mockResolvedValueOnce({
        id: "cand-id",
        fullName: "Juan",
        accountId: "acc-id",
        positionId: "pos-id",
        partyId: "party-id",
        manifesto: "Manifesto",
        isActive: 1,
        imageUrl: null,
        createdAt: 1000,
        updatedAt: 1000,
      });

      await candidateLifecycleCoordinator.create(
        mockDb,
        {
          fullName: "Juan",
          accountId: "acc-id",
          positionId: "pos-id",
          partyId: "party-id",
          manifesto: "Manifesto",
        },
        { id: "admin-id", username: "admin" },
      );

      expect(mockPartyFindById).toHaveBeenCalledWith(mockTx, "party-id");
      expect(mockCandidateCreate).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ partyId: "party-id" }),
      );
    });

    it.each([
      ["missing", null],
      ["from another election", { id: "party-id", electionId: "other-election" }],
    ])("throws PARTY_LIST_NOT_FOUND when the party is %s", async (_label, party) => {
      mockSelectGet.mockResolvedValueOnce({ id: "acc-id" });
      mockPositionFindById.mockResolvedValueOnce({ id: "pos-id", electionId: "el-id" });
      mockElectionFindById.mockResolvedValueOnce({ id: "el-id", status: "draft" });
      mockPartyFindById.mockResolvedValueOnce(party);

      await expect(
        candidateLifecycleCoordinator.create(
          mockDb,
          {
            fullName: "Juan",
            accountId: "acc-id",
            positionId: "pos-id",
            partyId: "party-id",
            manifesto: "Manifesto",
          },
          { id: "admin-id", username: "admin" },
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "PARTY_LIST_NOT_FOUND", status: 404 }));

      expect(mockCandidateCreate).not.toHaveBeenCalled();
      expect(mockAuditInsert).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("successfully updates metadata of a candidate and writes audit log", async () => {
      mockCandidateGetForAdminView
        .mockResolvedValueOnce({ id: "cand-1", fullName: "Old Name" }) // check exist
        .mockResolvedValueOnce({ id: "cand-1", fullName: "New Name" }); // return updated
      mockCandidateUpdate.mockResolvedValueOnce(true);

      const result = await candidateLifecycleCoordinator.update(
        mockDb,
        "cand-1",
        { fullName: "New Name" },
        { id: "admin-id", username: "admin" },
      );

      expect(result.fullName).toBe("New Name");
      expect(mockCandidateUpdate).toHaveBeenCalledWith(mockTx, "cand-1", { fullName: "New Name" });
      expect(mockAuditInsert).toHaveBeenCalledWith(mockTx, {
        action: "candidate.update",
        targetType: "candidate",
        targetId: "cand-1",
        actorAccountIdSnapshot: "admin-id",
        actorUsernameSnapshot: "admin",
      });
    });

    it("throws CANDIDATE_NOT_FOUND when trying to update non-existent candidate", async () => {
      mockCandidateGetForAdminView.mockResolvedValueOnce(null);

      await expect(
        candidateLifecycleCoordinator.update(
          mockDb,
          "non-existent",
          { fullName: "New Name" },
          { id: "admin-id", username: "admin" },
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "CANDIDATE_NOT_FOUND", status: 404 }));
    });

    it("throws CANDIDATE_NOT_FOUND if re-fetching candidate after update returns null", async () => {
      mockCandidateGetForAdminView
        .mockResolvedValueOnce({ id: "cand-1", fullName: "Old Name" }) // check exist
        .mockResolvedValueOnce(null); // reload returns null
      mockCandidateUpdate.mockResolvedValueOnce(true);

      await expect(
        candidateLifecycleCoordinator.update(
          mockDb,
          "cand-1",
          { fullName: "New Name" },
          { id: "admin-id", username: "admin" },
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "CANDIDATE_NOT_FOUND", status: 404 }));
    });

    it("rolls back transaction if audit log write fails", async () => {
      mockCandidateGetForAdminView.mockResolvedValueOnce({ id: "cand-1", fullName: "Old Name" });
      mockCandidateUpdate.mockResolvedValueOnce(true);
      mockAuditInsert.mockRejectedValueOnce(new Error("Audit failure"));

      await expect(
        candidateLifecycleCoordinator.update(
          mockDb,
          "cand-1",
          { fullName: "New Name" },
          { id: "admin-id", username: "admin" },
        ),
      ).rejects.toThrow("Audit failure");
    });

    it.each([
      ["missing", null],
      ["from another election", { id: "party-new", electionId: "other-election" }],
    ])("throws PARTY_LIST_NOT_FOUND when the new party is %s", async (_label, party) => {
      mockCandidateGetForAdminView.mockResolvedValueOnce({
        id: "cand-1",
        positionId: "pos-1",
        partyId: "party-old",
        isActive: 1,
      });
      mockPositionFindById.mockResolvedValueOnce({ id: "pos-1", electionId: "el-1" });
      mockElectionFindById.mockResolvedValueOnce({ id: "el-1", status: "draft" });
      mockPartyFindById.mockResolvedValueOnce(party);

      await expect(
        candidateLifecycleCoordinator.update(
          mockDb,
          "cand-1",
          { partyId: "party-new" },
          { id: "admin-id", username: "admin" },
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "PARTY_LIST_NOT_FOUND", status: 404 }));

      expect(mockCandidateUpdate).not.toHaveBeenCalled();
      expect(mockAuditInsert).not.toHaveBeenCalled();
    });

    it("validates a supplied party even when it matches the stored party ID", async () => {
      mockCandidateGetForAdminView.mockResolvedValueOnce({
        id: "cand-1",
        positionId: "pos-1",
        partyId: "party-existing",
        isActive: 1,
      });
      mockPositionFindById.mockResolvedValueOnce({ id: "pos-1", electionId: "el-1" });
      mockPartyFindById.mockResolvedValueOnce({
        id: "party-existing",
        electionId: "other-election",
      });

      await expect(
        candidateLifecycleCoordinator.update(
          mockDb,
          "cand-1",
          { partyId: "party-existing" },
          { id: "admin-id", username: "admin" },
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "PARTY_LIST_NOT_FOUND", status: 404 }));

      expect(mockCandidateUpdate).not.toHaveBeenCalled();
      expect(mockAuditInsert).not.toHaveBeenCalled();
    });

    it.each([
      ["assigning a party", "party-new"],
      ["clearing a party", null],
    ])("throws ELECTION_NOT_IN_DRAFT when %s after draft", async (_label, partyId) => {
      mockCandidateGetForAdminView.mockResolvedValueOnce({
        id: "cand-1",
        positionId: "pos-1",
        partyId: "party-old",
        isActive: 1,
      });
      mockPositionFindById.mockResolvedValueOnce({ id: "pos-1", electionId: "el-1" });
      mockElectionFindById.mockResolvedValueOnce({ id: "el-1", status: "open" });

      await expect(
        candidateLifecycleCoordinator.update(
          mockDb,
          "cand-1",
          { partyId },
          { id: "admin-id", username: "admin" },
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "ELECTION_NOT_IN_DRAFT", status: 409 }));

      expect(mockCandidateUpdate).not.toHaveBeenCalled();
      expect(mockAuditInsert).not.toHaveBeenCalled();
    });
  });

  describe("deactivate", () => {
    it("successfully deactivates a candidate and writes audit log", async () => {
      mockCandidateGetForAdminView.mockResolvedValueOnce({
        id: "cand-1",
        positionId: "pos-1",
        isActive: 1,
      });
      mockPositionFindById.mockResolvedValueOnce({ id: "pos-1", electionId: "elec-1" });
      mockElectionFindById.mockResolvedValueOnce({ id: "elec-1", status: "draft" });
      mockCandidateSoftDelete.mockResolvedValueOnce(true);

      await candidateLifecycleCoordinator.deactivate(mockDb, "cand-1", {
        id: "admin-id",
        username: "admin",
      });

      expect(mockCandidateSoftDelete).toHaveBeenCalledWith(mockTx, "cand-1");
      expect(mockAuditInsert).toHaveBeenCalledWith(mockTx, {
        action: "candidate.deactivate",
        targetType: "candidate",
        targetId: "cand-1",
        actorAccountIdSnapshot: "admin-id",
        actorUsernameSnapshot: "admin",
      });
    });

    it("throws CANDIDATE_NOT_FOUND when trying to deactivate non-existent candidate", async () => {
      mockCandidateGetForAdminView.mockResolvedValueOnce(null);

      await expect(
        candidateLifecycleCoordinator.deactivate(mockDb, "non-existent", {
          id: "admin-id",
          username: "admin",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CANDIDATE_NOT_FOUND", status: 404 }));

      expect(mockCandidateSoftDelete).not.toHaveBeenCalled();
      expect(mockAuditInsert).not.toHaveBeenCalled();
    });

    it("throws POSITION_NOT_FOUND when position does not exist", async () => {
      mockCandidateGetForAdminView.mockResolvedValueOnce({
        id: "cand-1",
        positionId: "pos-missing",
        isActive: 1,
      });
      mockPositionFindById.mockResolvedValueOnce(null);

      await expect(
        candidateLifecycleCoordinator.deactivate(mockDb, "cand-1", {
          id: "admin-id",
          username: "admin",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "POSITION_NOT_FOUND", status: 404 }));

      expect(mockCandidateSoftDelete).not.toHaveBeenCalled();
      expect(mockAuditInsert).not.toHaveBeenCalled();
    });

    it("throws ELECTION_NOT_FOUND when election does not exist", async () => {
      mockCandidateGetForAdminView.mockResolvedValueOnce({
        id: "cand-1",
        positionId: "pos-1",
        isActive: 1,
      });
      mockPositionFindById.mockResolvedValueOnce({ id: "pos-1", electionId: "elec-missing" });
      mockElectionFindById.mockResolvedValueOnce(null);

      await expect(
        candidateLifecycleCoordinator.deactivate(mockDb, "cand-1", {
          id: "admin-id",
          username: "admin",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "ELECTION_NOT_FOUND", status: 404 }));

      expect(mockCandidateSoftDelete).not.toHaveBeenCalled();
      expect(mockAuditInsert).not.toHaveBeenCalled();
    });

    it("throws ELECTION_NOT_IN_DRAFT when election is not in draft status", async () => {
      mockCandidateGetForAdminView.mockResolvedValueOnce({
        id: "cand-1",
        positionId: "pos-1",
        isActive: 1,
      });
      mockPositionFindById.mockResolvedValueOnce({ id: "pos-1", electionId: "elec-1" });
      mockElectionFindById.mockResolvedValueOnce({ id: "elec-1", status: "open" });

      await expect(
        candidateLifecycleCoordinator.deactivate(mockDb, "cand-1", {
          id: "admin-id",
          username: "admin",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "ELECTION_NOT_IN_DRAFT", status: 409 }));

      expect(mockCandidateSoftDelete).not.toHaveBeenCalled();
      expect(mockAuditInsert).not.toHaveBeenCalled();
    });
  });

  describe("uploadAvatar", () => {
    it("successfully uploads a new image, updates DB, cleans up old image, and logs", async () => {
      mockCandidateGetForAdminView
        .mockResolvedValueOnce({ id: "cand-1", imageUrl: "https://old.url" }) // step 1 check
        .mockResolvedValueOnce({ id: "cand-1", imageUrl: "https://old.url" }) // step 3 tx check
        .mockResolvedValueOnce({ id: "cand-1", imageUrl: "https://new.url" }); // step 5 return updated
      mockStorage.upload.mockResolvedValueOnce({ url: "https://new.url" });
      mockCandidateUpdateImageUrl.mockResolvedValueOnce(true);

      const file = new File([new ArrayBuffer(100)], "image.png", { type: "image/png" });

      const result = await candidateLifecycleCoordinator.uploadAvatar(
        mockDb,
        "cand-1",
        file,
        mockStorage,
        { id: "admin-id", username: "admin" },
      );

      expect(result.imageUrl).toBe("https://new.url");
      expect(mockStorage.upload).toHaveBeenCalledWith("cand-1", file);
      expect(mockCandidateUpdateImageUrl).toHaveBeenCalledWith(mockTx, "cand-1", "https://new.url");
      expect(mockStorage.delete).toHaveBeenCalledWith("https://old.url");
      expect(mockAuditInsert).toHaveBeenCalledWith(mockTx, {
        action: "candidate.update",
        targetType: "candidate",
        targetId: "cand-1",
        actorAccountIdSnapshot: "admin-id",
        actorUsernameSnapshot: "admin",
      });
    });

    it("cleans up the newly uploaded image if database transaction fails", async () => {
      mockCandidateGetForAdminView
        .mockResolvedValueOnce({ id: "cand-1", imageUrl: null }) // step 1 check
        .mockResolvedValueOnce({ id: "cand-1", imageUrl: null }); // step 3 tx check
      mockStorage.upload.mockResolvedValueOnce({ url: "https://new.url" });
      mockCandidateUpdateImageUrl.mockRejectedValueOnce(new Error("Database error"));

      const file = new File([new ArrayBuffer(100)], "image.png", { type: "image/png" });

      await expect(
        candidateLifecycleCoordinator.uploadAvatar(mockDb, "cand-1", file, mockStorage, {
          id: "admin-id",
          username: "admin",
        }),
      ).rejects.toThrow("Database error");

      expect(mockStorage.delete).toHaveBeenCalledWith("https://new.url");
    });

    it("throws CANDIDATE_NOT_FOUND when candidate does not exist", async () => {
      mockCandidateGetForAdminView.mockResolvedValueOnce(null);
      const file = new File([new ArrayBuffer(100)], "image.png", { type: "image/png" });

      await expect(
        candidateLifecycleCoordinator.uploadAvatar(mockDb, "non-existent", file, mockStorage, {
          id: "admin-id",
          username: "admin",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CANDIDATE_NOT_FOUND", status: 404 }));
    });

    it("throws UNSUPPORTED_MEDIA_TYPE when image validation fails", async () => {
      mockCandidateGetForAdminView.mockResolvedValueOnce({ id: "cand-1", imageUrl: null });
      mockStorage.upload.mockRejectedValueOnce(new ImageValidationError("Invalid file type"));

      const file = new File([new ArrayBuffer(100)], "image.png", { type: "image/png" });

      await expect(
        candidateLifecycleCoordinator.uploadAvatar(mockDb, "cand-1", file, mockStorage, {
          id: "admin-id",
          username: "admin",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "UNSUPPORTED_MEDIA_TYPE", status: 415 }));
    });

    it("throws CANDIDATE_NOT_FOUND if candidate gets deleted between step 1 and the transaction", async () => {
      mockCandidateGetForAdminView
        .mockResolvedValueOnce({ id: "cand-1", imageUrl: null }) // step 1 check
        .mockResolvedValueOnce(null); // step 3 transaction check
      mockStorage.upload.mockResolvedValueOnce({ url: "https://new.url" });

      const file = new File([new ArrayBuffer(100)], "image.png", { type: "image/png" });

      await expect(
        candidateLifecycleCoordinator.uploadAvatar(mockDb, "cand-1", file, mockStorage, {
          id: "admin-id",
          username: "admin",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CANDIDATE_NOT_FOUND", status: 404 }));
    });
  });

  describe("deleteAvatar", () => {
    it("successfully clears imageUrl in DB, deletes image in storage, and logs", async () => {
      mockCandidateGetForAdminView
        .mockResolvedValueOnce({ id: "cand-1", imageUrl: "https://old.url" }) // step 1 check
        .mockResolvedValueOnce({ id: "cand-1", imageUrl: "https://old.url" }) // step 2 tx check
        .mockResolvedValueOnce({ id: "cand-1", imageUrl: null }); // step 4 return updated
      mockCandidateUpdateImageUrl.mockResolvedValueOnce(true);

      const result = await candidateLifecycleCoordinator.deleteAvatar(
        mockDb,
        "cand-1",
        mockStorage,
        { id: "admin-id", username: "admin" },
      );

      expect(result.imageUrl).toBeNull();
      expect(mockCandidateUpdateImageUrl).toHaveBeenCalledWith(mockTx, "cand-1", null);
      expect(mockStorage.delete).toHaveBeenCalledWith("https://old.url");
      expect(mockAuditInsert).toHaveBeenCalledWith(mockTx, {
        action: "candidate.update",
        targetType: "candidate",
        targetId: "cand-1",
        actorAccountIdSnapshot: "admin-id",
        actorUsernameSnapshot: "admin",
      });
    });

    it("throws CANDIDATE_NOT_FOUND when candidate does not exist", async () => {
      mockCandidateGetForAdminView.mockResolvedValueOnce(null);

      await expect(
        candidateLifecycleCoordinator.deleteAvatar(mockDb, "non-existent", mockStorage, {
          id: "admin-id",
          username: "admin",
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "CANDIDATE_NOT_FOUND", status: 404 }));
    });

    it("skips storage deletion if imageUrl is null", async () => {
      mockCandidateGetForAdminView
        .mockResolvedValueOnce({ id: "cand-1", imageUrl: null })
        .mockResolvedValueOnce({ id: "cand-1", imageUrl: null })
        .mockResolvedValueOnce({ id: "cand-1", imageUrl: null });
      mockCandidateUpdateImageUrl.mockResolvedValueOnce(true);

      const result = await candidateLifecycleCoordinator.deleteAvatar(
        mockDb,
        "cand-1",
        mockStorage,
        { id: "admin-id", username: "admin" },
      );

      expect(result.imageUrl).toBeNull();
      expect(mockStorage.delete).not.toHaveBeenCalled();
    });
  });
});
