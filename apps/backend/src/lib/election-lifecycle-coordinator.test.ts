import { beforeEach, describe, expect, it, vi } from "vitest";
import { ElectionLifecycleCoordinator } from "./election-lifecycle-coordinator";

const {
  mockFindById,
  mockCreate,
  mockUpdateStatus,
  mockUpdateMetadata,
  mockFindOpen,
  mockCountPositions,
  mockCountPositionsWithActiveCandidates,
  mockAuditInsert,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdateStatus: vi.fn(),
  mockUpdateMetadata: vi.fn(),
  mockFindOpen: vi.fn(),
  mockCountPositions: vi.fn(),
  mockCountPositionsWithActiveCandidates: vi.fn(),
  mockAuditInsert: vi.fn(),
}));

vi.mock("@/database/repositories/election.repository", () => ({
  electionRepo: {
    findById: mockFindById,
    create: mockCreate,
    updateStatus: mockUpdateStatus,
    updateMetadata: mockUpdateMetadata,
    findOpen: mockFindOpen,
  },
}));

vi.mock("@/database/queries/election.queries", () => ({
  electionQueries: {
    countPositions: mockCountPositions,
    countPositionsWithActiveCandidates: mockCountPositionsWithActiveCandidates,
  },
}));

vi.mock("@/database/repositories/audit-log.repository", () => ({
  auditLogRepo: {
    insert: mockAuditInsert,
  },
}));

const mockDb: any = {
  transaction: vi.fn(async (cb) => await cb(mockDb)),
};

describe("ElectionLifecycleCoordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("creates a draft election and inserts an audit log entry", async () => {
      mockCreate.mockResolvedValueOnce("new-uuid");
      const id = await ElectionLifecycleCoordinator.create(
        mockDb,
        { name: "CSO Election 2026" },
        { id: "admin-id", username: "admin" },
      );
      expect(id).toBe("new-uuid");
      expect(mockCreate).toHaveBeenCalledWith(mockDb, { name: "CSO Election 2026" });
      expect(mockAuditInsert).toHaveBeenCalledWith(mockDb, {
        action: "election.create",
        targetType: "election",
        targetId: "new-uuid",
        actorAccountIdSnapshot: "admin-id",
        actorUsernameSnapshot: "admin",
      });
    });
  });

  describe("updateMetadata", () => {
    it("updates metadata for a draft election and inserts an audit log entry", async () => {
      const existing = { id: "e1", name: "Old Name", status: "draft" };
      const updated = { id: "e1", name: "New Name", status: "draft" };
      mockFindById.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);
      mockUpdateMetadata.mockResolvedValueOnce(true);

      const result = await ElectionLifecycleCoordinator.updateMetadata(
        mockDb,
        "e1",
        { name: "New Name" },
        { id: "admin-id", username: "admin" },
      );

      expect(result).toEqual(updated);
      expect(mockUpdateMetadata).toHaveBeenCalledWith(mockDb, "e1", { name: "New Name" });
      expect(mockAuditInsert).toHaveBeenCalledWith(mockDb, {
        action: "election.update",
        targetType: "election",
        targetId: "e1",
        actorAccountIdSnapshot: "admin-id",
        actorUsernameSnapshot: "admin",
      });
    });

    it("throws ELECTION_NOT_FOUND when election does not exist", async () => {
      mockFindById.mockResolvedValueOnce(null);

      await expect(
        ElectionLifecycleCoordinator.updateMetadata(
          mockDb,
          "non-existent",
          { name: "New Name" },
          { id: "admin-id", username: "admin" },
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "ELECTION_NOT_FOUND", status: 404 }));
    });

    it("throws ELECTION_NOT_IN_DRAFT when election is not in draft status", async () => {
      mockFindById.mockResolvedValueOnce({ id: "e1", name: "Open Election", status: "open" });

      await expect(
        ElectionLifecycleCoordinator.updateMetadata(
          mockDb,
          "e1",
          { name: "New Name" },
          { id: "admin-id", username: "admin" },
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "ELECTION_NOT_IN_DRAFT", status: 409 }));
    });
  });

  describe("transition", () => {
    it("successfully opens a draft election", async () => {
      mockFindById.mockResolvedValueOnce({
        id: "e1",
        status: "draft",
        opensAt: null,
        closesAt: null,
      });
      mockCountPositions.mockResolvedValueOnce(3);
      mockCountPositionsWithActiveCandidates.mockResolvedValueOnce(3);
      mockFindOpen.mockResolvedValueOnce(null);
      mockUpdateStatus.mockResolvedValueOnce(true);

      const result = await ElectionLifecycleCoordinator.transition(mockDb, "e1", {
        to: "open",
        actor: { id: "admin-id", username: "admin" },
        opensAt: 1700000000,
        closesAt: 1700003600,
      });

      expect(result.newStatus).toBe("open");
      expect(result.messageKey).toBe("ELECTION_OPENED_SUCCESSFULLY");
      expect(mockUpdateStatus).toHaveBeenCalled();
      expect(mockAuditInsert).toHaveBeenCalledWith(mockDb, {
        action: "election.transition",
        targetType: "election",
        targetId: "e1",
        actorAccountIdSnapshot: "admin-id",
        actorUsernameSnapshot: "admin",
        description: "draft \u2192 open",
      });
    });

    it("throws ELECTION_NOT_FOUND when election does not exist", async () => {
      mockFindById.mockResolvedValueOnce(null);
      await expect(
        ElectionLifecycleCoordinator.transition(mockDb, "non-existent", {
          to: "open",
          actor: { id: "admin-id", username: "admin" },
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "ELECTION_NOT_FOUND", status: 404 }));
    });

    it("throws ANOTHER_ELECTION_IS_OPEN if another election is open", async () => {
      mockFindById.mockResolvedValueOnce({
        id: "e1",
        status: "draft",
        opensAt: null,
        closesAt: null,
      });
      mockCountPositions.mockResolvedValueOnce(3);
      mockCountPositionsWithActiveCandidates.mockResolvedValueOnce(3);
      mockFindOpen.mockResolvedValueOnce({ id: "other-open-id", status: "open" });

      await expect(
        ElectionLifecycleCoordinator.transition(mockDb, "e1", {
          to: "open",
          actor: { id: "admin-id", username: "admin" },
          opensAt: 1700000000,
          closesAt: 1700003600,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "ANOTHER_ELECTION_IS_OPEN", status: 409 }));
    });

    it("closes an expired open election before opening the next one", async () => {
      const now = Math.floor(Date.now() / 1000);
      const expired = {
        id: "expired-open-id",
        status: "open",
        opensAt: now - 7200,
        closesAt: now - 1,
      };
      mockFindById.mockResolvedValueOnce({
        id: "e1",
        status: "draft",
        opensAt: null,
        closesAt: null,
      });
      mockCountPositions.mockResolvedValueOnce(3);
      mockCountPositionsWithActiveCandidates.mockResolvedValueOnce(3);
      mockFindOpen.mockResolvedValueOnce(expired);
      mockUpdateStatus.mockResolvedValue(true);

      const result = await ElectionLifecycleCoordinator.transition(mockDb, "e1", {
        to: "open",
        actor: { id: "admin-id", username: "admin" },
        opensAt: now,
        closesAt: now + 3600,
      });

      expect(result.newStatus).toBe("open");
      expect(mockUpdateStatus).toHaveBeenNthCalledWith(1, mockDb, "expired-open-id", {
        existingStatus: "open",
        status: "closed",
        opensAt: expired.opensAt,
        closesAt: expired.closesAt,
      });
      expect(mockUpdateStatus).toHaveBeenNthCalledWith(2, mockDb, "e1", {
        existingStatus: "draft",
        status: "open",
        opensAt: now,
        closesAt: now + 3600,
      });
      expect(mockAuditInsert).toHaveBeenNthCalledWith(1, mockDb, {
        action: "election.transition",
        targetType: "election",
        targetId: "expired-open-id",
        actorAccountIdSnapshot: "admin-id",
        actorUsernameSnapshot: "admin",
        description: "open → closed",
      });
    });

    it("throws ELECTION_HAS_NO_POSITIONS when opening a draft election with 0 positions", async () => {
      mockFindById.mockResolvedValueOnce({
        id: "e1",
        status: "draft",
        opensAt: null,
        closesAt: null,
      });
      mockCountPositions.mockResolvedValueOnce(0);

      await expect(
        ElectionLifecycleCoordinator.transition(mockDb, "e1", {
          to: "open",
          actor: { id: "admin-id", username: "admin" },
          opensAt: 1700000000,
          closesAt: 1700003600,
        }),
      ).rejects.toThrow(
        expect.objectContaining({ code: "ELECTION_HAS_NO_POSITIONS", status: 409 }),
      );
    });

    it("throws INVALID_TRANSITION when trying to perform an invalid status transition", async () => {
      mockFindById.mockResolvedValueOnce({
        id: "e1",
        status: "draft",
        opensAt: null,
        closesAt: null,
      });
      mockCountPositions.mockResolvedValueOnce(3);

      await expect(
        ElectionLifecycleCoordinator.transition(mockDb, "e1", {
          to: "closed",
          actor: { id: "admin-id", username: "admin" },
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "INVALID_TRANSITION", status: 409 }));
    });

    // Regression: ANOTHER_ELECTION_IS_OPEN must take precedence over
    // ELECTION_HAS_NO_POSITIONS / INVALID_TRANSITION when both conditions hold.
    // assertTransition was moved AFTER the duplicate-open check (step 5) so
    // validation sees resolved dates; this test locks in the resulting error
    // ordering. All three are 409 so callers see the same status — only the
    // message differs.
    it("throws ANOTHER_ELECTION_IS_OPEN before ELECTION_HAS_NO_POSITIONS when both hold", async () => {
      mockFindById.mockResolvedValueOnce({
        id: "e1",
        status: "draft",
        opensAt: null,
        closesAt: null,
      });
      mockCountPositions.mockResolvedValueOnce(0);
      mockFindOpen.mockResolvedValueOnce({ id: "other-open-id", status: "open" });

      await expect(
        ElectionLifecycleCoordinator.transition(mockDb, "e1", {
          to: "open",
          actor: { id: "admin-id", username: "admin" },
          opensAt: 1700000000,
          closesAt: 1700003600,
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "ANOTHER_ELECTION_IS_OPEN", status: 409 }));
    });

    it("throws ANOTHER_ELECTION_IS_OPEN before INVALID_TRANSITION when both hold", async () => {
      // closed -> open is not a valid transition, AND another election is open.
      // The duplicate-open check (gated on toStatus === "open") runs in step 3,
      // before assertTransition in step 5.
      mockFindById.mockResolvedValueOnce({
        id: "e1",
        status: "closed",
        opensAt: null,
        closesAt: null,
      });
      mockCountPositions.mockResolvedValueOnce(3);
      mockFindOpen.mockResolvedValueOnce({ id: "other-open-id", status: "open" });

      await expect(
        ElectionLifecycleCoordinator.transition(mockDb, "e1", {
          to: "open",
          actor: { id: "admin-id", username: "admin" },
        }),
      ).rejects.toThrow(expect.objectContaining({ code: "ANOTHER_ELECTION_IS_OPEN", status: 409 }));
    });

    it("successfully transitions closed -> draft and clears timestamps", async () => {
      mockFindById.mockResolvedValueOnce({
        id: "e1",
        status: "closed",
        opensAt: 1700000000,
        closesAt: 1700003600,
      });
      mockCountPositions.mockResolvedValueOnce(3);
      mockUpdateStatus.mockResolvedValueOnce(true);

      const result = await ElectionLifecycleCoordinator.transition(mockDb, "e1", {
        to: "draft",
        actor: { id: "admin-id", username: "admin" },
      });

      expect(result.newStatus).toBe("draft");
      expect(result.messageKey).toBe("ELECTION_REOPENED_SUCCESSFULLY");
      expect(mockUpdateStatus).toHaveBeenCalledWith(
        mockDb,
        "e1",
        expect.objectContaining({
          existingStatus: "closed",
          status: "draft",
          opensAt: null,
          closesAt: null,
        }),
      );
    });
  });
});
