import { beforeEach, describe, expect, it, vi } from "vitest";
import { positionLifecycleCoordinator } from "./position-lifecycle-coordinator";

const {
  mockPositionCreate,
  mockPositionFindById,
  mockPositionUpdate,
  mockPositionDelete,
  mockElectionFindById,
  mockCandidateCountByPositionId,
  mockAuditInsert,
} = vi.hoisted(() => ({
  mockPositionCreate: vi.fn(),
  mockPositionFindById: vi.fn(),
  mockPositionUpdate: vi.fn(),
  mockPositionDelete: vi.fn(),
  mockElectionFindById: vi.fn(),
  mockCandidateCountByPositionId: vi.fn(),
  mockAuditInsert: vi.fn(),
}));

vi.mock("@/database/repositories/position.repository", () => ({
  positionRepo: {
    create: mockPositionCreate,
    findById: mockPositionFindById,
    update: mockPositionUpdate,
    delete: mockPositionDelete,
  },
}));

vi.mock("@/database/repositories/election.repository", () => ({
  electionRepo: {
    findById: mockElectionFindById,
  },
}));

vi.mock("@/database/repositories/candidates.repository", () => ({
  candidateRepo: {
    countByPositionId: mockCandidateCountByPositionId,
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

const actor = { id: "admin-1", username: "admin.jane" };

describe("PositionLifecycleCoordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("successfully creates a position and inserts audit log", async () => {
      mockElectionFindById.mockResolvedValueOnce({ id: "e1", status: "draft" });
      mockPositionCreate.mockResolvedValueOnce("p1");
      mockPositionFindById.mockResolvedValueOnce({
        id: "p1",
        electionId: "e1",
        name: "President",
        displayOrder: 1,
      });

      const result = await positionLifecycleCoordinator.create(
        mockDb,
        { electionId: "e1", name: "President", displayOrder: 1 },
        actor,
      );

      expect(result.id).toBe("p1");
      expect(mockPositionCreate).toHaveBeenCalledWith(mockDb, {
        electionId: "e1",
        name: "President",
        displayOrder: 1,
      });
      expect(mockAuditInsert).toHaveBeenCalledWith(mockDb, {
        action: "position.create",
        targetType: "position",
        targetId: "p1",
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });
    });

    it("throws ELECTION_NOT_FOUND when election does not exist", async () => {
      mockElectionFindById.mockResolvedValueOnce(null);

      await expect(
        positionLifecycleCoordinator.create(mockDb, { electionId: "e1", name: "President" }, actor),
      ).rejects.toThrow(expect.objectContaining({ code: "ELECTION_NOT_FOUND", status: 404 }));
    });

    it("throws ELECTION_NOT_IN_DRAFT when election is not in draft status", async () => {
      mockElectionFindById.mockResolvedValueOnce({ id: "e1", status: "open" });

      await expect(
        positionLifecycleCoordinator.create(mockDb, { electionId: "e1", name: "President" }, actor),
      ).rejects.toThrow(expect.objectContaining({ code: "ELECTION_NOT_IN_DRAFT", status: 409 }));
    });

    it("throws POSITION_ALREADY_EXISTS when database throws unique constraint violation", async () => {
      mockElectionFindById.mockResolvedValueOnce({ id: "e1", status: "draft" });
      const uniqueError = new Error("UNIQUE constraint failed: positions.name");
      mockPositionCreate.mockRejectedValueOnce(uniqueError);

      await expect(
        positionLifecycleCoordinator.create(mockDb, { electionId: "e1", name: "President" }, actor),
      ).rejects.toThrow(expect.objectContaining({ code: "POSITION_ALREADY_EXISTS", status: 409 }));
    });
  });

  describe("update", () => {
    it("successfully updates a position and logs action", async () => {
      mockPositionFindById.mockResolvedValueOnce({ id: "p1", electionId: "e1", name: "President" });
      mockElectionFindById.mockResolvedValueOnce({ id: "e1", status: "draft" });
      mockPositionUpdate.mockResolvedValueOnce(true);
      mockPositionFindById.mockResolvedValueOnce({ id: "p1", electionId: "e1", name: "New Pres" });

      const result = await positionLifecycleCoordinator.update(
        mockDb,
        { electionId: "e1", positionId: "p1", name: "New Pres" },
        actor,
      );

      expect(result.name).toBe("New Pres");
      expect(mockPositionUpdate).toHaveBeenCalledWith(mockDb, "p1", {
        name: "New Pres",
        displayOrder: undefined,
      });
      expect(mockAuditInsert).toHaveBeenCalledWith(mockDb, {
        action: "position.update",
        targetType: "position",
        targetId: "p1",
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });
    });

    it("throws POSITION_NOT_FOUND when position belongs to a different election", async () => {
      mockPositionFindById.mockResolvedValueOnce({ id: "p1", electionId: "other-election" });

      await expect(
        positionLifecycleCoordinator.update(
          mockDb,
          { electionId: "e1", positionId: "p1", name: "New Pres" },
          actor,
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "POSITION_NOT_FOUND", status: 404 }));
    });

    it("throws ELECTION_NOT_IN_DRAFT when election is not draft", async () => {
      mockPositionFindById.mockResolvedValueOnce({ id: "p1", electionId: "e1" });
      mockElectionFindById.mockResolvedValueOnce({ id: "e1", status: "open" });

      await expect(
        positionLifecycleCoordinator.update(
          mockDb,
          { electionId: "e1", positionId: "p1", name: "New Pres" },
          actor,
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "ELECTION_NOT_IN_DRAFT", status: 409 }));
    });
  });

  describe("delete", () => {
    it("successfully deletes position when it has no candidates", async () => {
      mockPositionFindById.mockResolvedValueOnce({ id: "p1", electionId: "e1" });
      mockElectionFindById.mockResolvedValueOnce({ id: "e1", status: "draft" });
      mockCandidateCountByPositionId.mockResolvedValueOnce(0);
      mockPositionDelete.mockResolvedValueOnce(true);

      await positionLifecycleCoordinator.delete(
        mockDb,
        { electionId: "e1", positionId: "p1" },
        actor,
      );

      expect(mockPositionDelete).toHaveBeenCalledWith(mockDb, "p1");
      expect(mockAuditInsert).toHaveBeenCalledWith(mockDb, {
        action: "position.delete",
        targetType: "position",
        targetId: "p1",
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
      });
    });

    it("throws POSITION_HAS_CANDIDATES when position has candidates", async () => {
      mockPositionFindById.mockResolvedValueOnce({ id: "p1", electionId: "e1" });
      mockElectionFindById.mockResolvedValueOnce({ id: "e1", status: "draft" });
      mockCandidateCountByPositionId.mockResolvedValueOnce(2);

      await expect(
        positionLifecycleCoordinator.delete(mockDb, { electionId: "e1", positionId: "p1" }, actor),
      ).rejects.toThrow(expect.objectContaining({ code: "POSITION_HAS_CANDIDATES", status: 409 }));
      expect(mockPositionDelete).not.toHaveBeenCalled();
    });
  });
});
