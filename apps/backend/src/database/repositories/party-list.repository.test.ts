import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "@/database/schema";
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

  it("round-trips descriptions through create, list, and update", async () => {
    const client = createClient({ url: "file::memory:" });

    try {
      await client.execute(
        "CREATE TABLE party_lists (created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, id TEXT PRIMARY KEY, election_id TEXT NOT NULL, name TEXT NOT NULL, code TEXT NOT NULL, color TEXT, description TEXT)",
      );
      const db = drizzle(client, { schema });
      const description = "A student-first platform.";
      const id = await partyListRepo.create(db, {
        electionId: "e1",
        name: "Innovators Party",
        code: "INNOVATORS",
        color: "#3B82F6",
        description,
      });

      expect((await partyListRepo.listByElection(db, "e1"))[0]?.description).toBe(description);

      await partyListRepo.update(db, id, { description: null });
      expect((await partyListRepo.findById(db, id))?.description).toBeNull();
    } finally {
      client.close();
    }
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
