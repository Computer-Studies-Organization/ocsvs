import { beforeEach, describe, expect, it, vi } from "vitest";
import { candidates, partyLists } from "@/database/schema";

const chain: any = {
  values: vi.fn(() => chain),
  set: vi.fn(() => chain),
  from: vi.fn(() => chain),
  where: vi.fn(() => chain),
  orderBy: vi.fn(() => chain),
  limit: vi.fn(() => chain),
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

import { partyListRepo } from "./party-list.repository";

beforeEach(() => vi.clearAllMocks());

describe("partyListRepo", () => {
  it("create returns an id and inserts values into partyLists", async () => {
    const id = await partyListRepo.create(mockDb as any, {
      electionId: "e1",
      name: "Innovators Party",
      code: "INNOVATORS",
      color: "#3B82F6",
    });
    expect(typeof id).toBe("string");
    expect(mockDb.insert).toHaveBeenCalledWith(partyLists);
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        electionId: "e1",
        name: "Innovators Party",
        code: "INNOVATORS",
        color: "#3B82F6",
      }),
    );
  });

  it("findById returns row or null", async () => {
    chain.get.mockReturnValueOnce({ id: "pl1", name: "Innovators Party", code: "INNOVATORS" });
    expect(await partyListRepo.findById(mockDb as any, "pl1")).toEqual({
      id: "pl1",
      name: "Innovators Party",
      code: "INNOVATORS",
    });

    chain.get.mockReturnValueOnce(undefined);
    expect(await partyListRepo.findById(mockDb as any, "pl2")).toBeNull();
  });

  it("listByElection returns rows", async () => {
    chain.all.mockReturnValueOnce([{ id: "pl1" }, { id: "pl2" }]);
    const rows = await partyListRepo.listByElection(mockDb as any, "e1");
    expect(rows).toHaveLength(2);
  });

  it("update returns true when row affected", async () => {
    expect(
      await partyListRepo.update(mockDb as any, "pl1", { name: "New Name", code: "NEW" }),
    ).toBe(true);
    expect(mockDb.update).toHaveBeenCalledWith(partyLists);
  });

  it("delete dissociates candidates and deletes party list", async () => {
    const result = await partyListRepo.delete(mockDb as any, "pl1");
    expect(result).toBe(true);
    expect(mockDb.update).toHaveBeenCalledWith(candidates);
    expect(chain.set).toHaveBeenCalledWith({ partyId: null });
    expect(mockDb.delete).toHaveBeenCalledWith(partyLists);
  });
});
