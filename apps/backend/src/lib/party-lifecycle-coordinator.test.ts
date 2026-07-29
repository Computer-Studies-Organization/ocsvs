import { beforeEach, describe, expect, it, vi } from "vitest";
import { partyLifecycleCoordinator } from "./party-lifecycle-coordinator";

const {
  mockPartyCreate,
  mockPartyFindById,
  mockPartyUpdate,
  mockPartyDelete,
  mockElectionFindById,
  mockAuditInsert,
} = vi.hoisted(() => ({
  mockPartyCreate: vi.fn(),
  mockPartyFindById: vi.fn(),
  mockPartyUpdate: vi.fn(),
  mockPartyDelete: vi.fn(),
  mockElectionFindById: vi.fn(),
  mockAuditInsert: vi.fn(),
}));

vi.mock("@/database/repositories/party-list.repository", () => ({
  partyListRepo: {
    create: mockPartyCreate,
    findById: mockPartyFindById,
    update: mockPartyUpdate,
    delete: mockPartyDelete,
  },
}));

vi.mock("@/database/repositories/election.repository", () => ({
  electionRepo: {
    findById: mockElectionFindById,
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

describe("PartyLifecycleCoordinator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("successfully creates a party list and inserts audit log", async () => {
      mockElectionFindById.mockResolvedValueOnce({
        id: "e1",
        name: "CSO 2026",
        status: "draft",
      });
      mockPartyCreate.mockResolvedValueOnce("pl1");
      mockPartyFindById.mockResolvedValueOnce({
        id: "pl1",
        electionId: "e1",
        name: "Innovators",
        code: "INNOV",
        color: "#3B82F6",
      });

      const result = await partyLifecycleCoordinator.create(
        mockDb,
        { electionId: "e1", name: "Innovators", code: "INNOV", color: "#3B82F6" },
        actor,
      );

      expect(result.id).toBe("pl1");
      expect(mockPartyCreate).toHaveBeenCalledWith(mockDb, {
        electionId: "e1",
        name: "Innovators",
        code: "INNOV",
        color: "#3B82F6",
      });
      expect(mockAuditInsert).toHaveBeenCalledWith(mockDb, {
        action: "party.create",
        targetType: "party",
        targetId: "pl1",
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
        description: "Created party 'Innovators' (INNOV) in election 'CSO 2026'",
      });
    });

    it("throws ELECTION_NOT_FOUND when election does not exist", async () => {
      mockElectionFindById.mockResolvedValueOnce(null);

      await expect(
        partyLifecycleCoordinator.create(
          mockDb,
          { electionId: "e1", name: "Innovators", code: "INNOV" },
          actor,
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "ELECTION_NOT_FOUND", status: 404 }));
    });

    it("throws PARTY_LIST_ALREADY_EXISTS on unique constraint failure", async () => {
      mockElectionFindById.mockResolvedValueOnce({
        id: "e1",
        name: "CSO 2026",
        status: "draft",
      });
      const uniqueError = new Error("UNIQUE constraint failed: party_lists.code");
      mockPartyCreate.mockRejectedValueOnce(uniqueError);

      await expect(
        partyLifecycleCoordinator.create(
          mockDb,
          { electionId: "e1", name: "Innovators", code: "INNOV" },
          actor,
        ),
      ).rejects.toThrow(
        expect.objectContaining({ code: "PARTY_LIST_ALREADY_EXISTS", status: 409 }),
      );
    });

    it.each(["open", "closed", "archived"])(
      "throws ELECTION_NOT_IN_DRAFT when election status is %s",
      async (status) => {
        mockElectionFindById.mockResolvedValueOnce({ id: "e1", name: "CSO 2026", status });

        await expect(
          partyLifecycleCoordinator.create(
            mockDb,
            { electionId: "e1", name: "Innovators", code: "INNOV" },
            actor,
          ),
        ).rejects.toThrow(expect.objectContaining({ code: "ELECTION_NOT_IN_DRAFT", status: 409 }));

        expect(mockPartyCreate).not.toHaveBeenCalled();
        expect(mockAuditInsert).not.toHaveBeenCalled();
      },
    );
  });

  describe("update", () => {
    it("successfully updates a party list and logs action", async () => {
      mockPartyFindById.mockResolvedValueOnce({
        id: "pl1",
        electionId: "e1",
        name: "Innovators",
        code: "INNOV",
      });
      mockElectionFindById.mockResolvedValueOnce({
        id: "e1",
        name: "CSO 2026",
        status: "draft",
      });
      mockPartyUpdate.mockResolvedValueOnce(true);
      mockPartyFindById.mockResolvedValueOnce({
        id: "pl1",
        electionId: "e1",
        name: "New Innovators",
        code: "INNOV",
      });

      const result = await partyLifecycleCoordinator.update(
        mockDb,
        { electionId: "e1", partyId: "pl1", name: "New Innovators" },
        actor,
      );

      expect(result.name).toBe("New Innovators");
      expect(mockPartyUpdate).toHaveBeenCalledWith(mockDb, "pl1", {
        name: "New Innovators",
        code: undefined,
        color: undefined,
      });
      expect(mockAuditInsert).toHaveBeenCalledWith(mockDb, {
        action: "party.update",
        targetType: "party",
        targetId: "pl1",
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
        description: "Updated party 'New Innovators' (INNOV)",
      });
    });

    it("throws PARTY_LIST_NOT_FOUND when party belongs to a different election", async () => {
      mockPartyFindById.mockResolvedValueOnce({ id: "pl1", electionId: "other-election" });

      await expect(
        partyLifecycleCoordinator.update(
          mockDb,
          { electionId: "e1", partyId: "pl1", name: "New Name" },
          actor,
        ),
      ).rejects.toThrow(expect.objectContaining({ code: "PARTY_LIST_NOT_FOUND", status: 404 }));
    });

    it.each(["open", "closed", "archived"])(
      "throws ELECTION_NOT_IN_DRAFT when election status is %s",
      async (status) => {
        mockPartyFindById.mockResolvedValueOnce({
          id: "pl1",
          electionId: "e1",
          name: "Innovators",
          code: "INNOV",
        });
        mockElectionFindById.mockResolvedValueOnce({ id: "e1", name: "CSO 2026", status });

        await expect(
          partyLifecycleCoordinator.update(
            mockDb,
            { electionId: "e1", partyId: "pl1", name: "New Name" },
            actor,
          ),
        ).rejects.toThrow(expect.objectContaining({ code: "ELECTION_NOT_IN_DRAFT", status: 409 }));

        expect(mockPartyUpdate).not.toHaveBeenCalled();
        expect(mockAuditInsert).not.toHaveBeenCalled();
      },
    );
  });

  describe("delete", () => {
    it("successfully deletes party list and inserts audit log", async () => {
      mockPartyFindById.mockResolvedValueOnce({
        id: "pl1",
        electionId: "e1",
        name: "Innovators",
        code: "INNOV",
      });
      mockElectionFindById.mockResolvedValueOnce({
        id: "e1",
        name: "CSO 2026",
        status: "draft",
      });
      mockPartyDelete.mockResolvedValueOnce(true);

      await partyLifecycleCoordinator.delete(mockDb, { electionId: "e1", partyId: "pl1" }, actor);

      expect(mockPartyDelete).toHaveBeenCalledWith(mockDb, "pl1");
      expect(mockAuditInsert).toHaveBeenCalledWith(mockDb, {
        action: "party.delete",
        targetType: "party",
        targetId: "pl1",
        actorAccountIdSnapshot: actor.id,
        actorUsernameSnapshot: actor.username,
        description: "Deleted party 'Innovators' (INNOV)",
      });
    });

    it("throws PARTY_LIST_NOT_FOUND when party is not found", async () => {
      mockPartyFindById.mockResolvedValueOnce(null);

      await expect(
        partyLifecycleCoordinator.delete(mockDb, { electionId: "e1", partyId: "pl1" }, actor),
      ).rejects.toThrow(expect.objectContaining({ code: "PARTY_LIST_NOT_FOUND", status: 404 }));
    });

    it.each(["open", "closed", "archived"])(
      "throws ELECTION_NOT_IN_DRAFT when election status is %s",
      async (status) => {
        mockPartyFindById.mockResolvedValueOnce({
          id: "pl1",
          electionId: "e1",
          name: "Innovators",
          code: "INNOV",
        });
        mockElectionFindById.mockResolvedValueOnce({ id: "e1", name: "CSO 2026", status });

        await expect(
          partyLifecycleCoordinator.delete(mockDb, { electionId: "e1", partyId: "pl1" }, actor),
        ).rejects.toThrow(expect.objectContaining({ code: "ELECTION_NOT_IN_DRAFT", status: 409 }));

        expect(mockPartyDelete).not.toHaveBeenCalled();
        expect(mockAuditInsert).not.toHaveBeenCalled();
      },
    );
  });
});
