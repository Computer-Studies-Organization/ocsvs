import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { positions } from "@/database/schema";

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
import { positionRepo } from "./position.repository";

beforeEach(() => vi.clearAllMocks());

describe("positionRepo", () => {
  it("create returns an id and auto-increments displayOrder when omitted", async () => {
    chain.get.mockReturnValueOnce({ maxOrder: 2 });
    const id = await positionRepo.create(mockDb as any, { electionId: "e1", name: "Chairman" });
    expect(typeof id).toBe("string");
    expect(mockDb.insert).toHaveBeenCalledWith(positions);
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        displayOrder: 3,
      }),
    );
  });

  it("create uses provided displayOrder when present", async () => {
    const id = await positionRepo.create(mockDb as any, {
      electionId: "e1",
      name: "Chairman",
      displayOrder: 5,
    });
    expect(typeof id).toBe("string");
    expect(mockDb.insert).toHaveBeenCalledWith(positions);
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        displayOrder: 5,
      }),
    );
  });

  it("findById returns row or null", async () => {
    chain.get.mockReturnValueOnce({ id: "p1", name: "Chairman" });
    expect(await positionRepo.findById(mockDb as any, "p1")).toEqual({
      id: "p1",
      name: "Chairman",
    });
    chain.get.mockReturnValueOnce(undefined);
    expect(await positionRepo.findById(mockDb as any, "p2")).toBeNull();
  });

  it("listByElection returns rows", async () => {
    chain.all.mockReturnValueOnce([{ id: "p1" }, { id: "p2" }]);
    const rows = await positionRepo.listByElection(mockDb as any, "e1");
    expect(rows).toHaveLength(2);
  });

  it("update returns true when a row is affected", async () => {
    expect(await positionRepo.update(mockDb as any, "p1", { name: "Vice Chair" })).toBe(true);
  });

  it("delete returns true when a row is affected", async () => {
    expect(await positionRepo.delete(mockDb as any, "p1")).toBe(true);
  });

  it("swaps positions without violating the unique display-order constraint", async () => {
    const client = createClient({ url: "file::memory:" });
    try {
      await client.execute(`
        CREATE TABLE positions (
          id TEXT PRIMARY KEY,
          election_id TEXT NOT NULL,
          name TEXT NOT NULL,
          display_order INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          UNIQUE (election_id, display_order)
        )
      `);
      await client.execute({
        sql: "INSERT INTO positions VALUES (?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?)",
        args: ["p1", "e1", "President", 0, 0, 0, "p2", "e1", "Vice President", 1, 0, 0],
      });
      const db = drizzle(client, { schema: { positions } });

      await positionRepo.reorder(db as any, ["p2", "p1"]);

      const result = await client.execute(
        "SELECT id, display_order FROM positions ORDER BY display_order",
      );
      expect(result.rows).toEqual([
        { id: "p2", display_order: 0 },
        { id: "p1", display_order: 1 },
      ]);
    } finally {
      client.close();
    }
  });
});
