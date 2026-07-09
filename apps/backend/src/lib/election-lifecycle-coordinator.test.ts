import { beforeEach, describe, expect, it, vi } from "vitest";
import { ElectionLifecycleCoordinator } from "./election-lifecycle-coordinator";

const {
  mockFindById,
  mockCreate,
  mockUpdateStatus,
  mockFindOpen,
  mockCountPositions,
  mockAuditInsert,
} = vi.hoisted(() => ({
  mockFindById: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdateStatus: vi.fn(),
  mockFindOpen: vi.fn(),
  mockCountPositions: vi.fn(),
  mockAuditInsert: vi.fn(),
}));

vi.mock("@/database/repositories/election.repository", () => ({
  electionRepo: {
    findById: mockFindById,
    create: mockCreate,
    updateStatus: mockUpdateStatus,
    findOpen: mockFindOpen,
  },
}));

vi.mock("@/database/queries/election.queries", () => ({
  electionQueries: {
    countPositions: mockCountPositions,
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

  describe("transition", () => {
    it("successfully opens a draft election", async () => {
      mockFindById.mockResolvedValueOnce({
        id: "e1",
        status: "draft",
        opensAt: null,
        closesAt: null,
      });
      mockCountPositions.mockResolvedValueOnce(3);
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
  });
});
